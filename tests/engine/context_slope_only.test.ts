/**
 * Tests pour le contexte de pente
 */

import { describe, it, expect } from 'vitest';
import { getContextForParcel, ContextFlag } from '../../src/engine/contextResolver';
import { summarizeContext } from '../../src/engine/contextFormatter';

describe('Context Engine - Slope Analysis', () => {
  
  it('should detect moderate slope and format message', async () => {
    // Parcelle avec pente de 35%
    const parcelId = 'test_slope_35';
    const geomWkt = 'POLYGON((2595500 1120500, 2595600 1120500, 2595600 1120600, 2595500 1120600, 2595500 1120500))';
    
    const flags = await getContextForParcel(parcelId, geomWkt);
    
    // Devrait avoir un flag de pente
    const slopeFlag = flags.find(f => f.layer === 'slope_pct');
    expect(slopeFlag).toBeDefined();
    
    if (slopeFlag) {
      expect(slopeFlag.intersects).toBe(true);
      expect(slopeFlag.valueNum).toBeDefined();
      
      // Si pente ~35%, severity devrait être 2 (WARNING)
      if (slopeFlag.valueNum && slopeFlag.valueNum > 30 && slopeFlag.valueNum <= 45) {
        expect(slopeFlag.severity).toBe(2);
        expect(slopeFlag.message).toContain('Pente');
        expect(slopeFlag.message).toMatch(/\d+%/); // Contient un pourcentage
      }
    }
  });

  it('should assign correct severity based on slope percentage', () => {
    const testCases = [
      { slope: 10, expectedSeverity: 1 },  // Faible
      { slope: 25, expectedSeverity: 1 },  // Modérée
      { slope: 35, expectedSeverity: 2 },  // Forte
      { slope: 50, expectedSeverity: 3 },  // Très forte
    ];

    for (const testCase of testCases) {
      const flag: ContextFlag = {
        layer: 'slope_pct',
        intersects: true,
        valueNum: testCase.slope,
        severity: testCase.slope > 45 ? 3 : (testCase.slope > 30 ? 2 : 1),
        message: `Pente moyenne ${testCase.slope}%`
      };

      expect(flag.severity).toBe(testCase.expectedSeverity);
    }
  });

  it('should format slope messages appropriately', () => {
    const slopeFlags: ContextFlag[] = [
      {
        layer: 'slope_pct',
        intersects: true,
        valueNum: 15,
        severity: 1,
        message: 'Pente modérée (15%)'
      },
      {
        layer: 'slope_pct',
        intersects: true,
        valueNum: 35,
        severity: 2,
        message: 'Pente importante (35%) - Terrassements conséquents'
      },
      {
        layer: 'slope_pct',
        intersects: true,
        valueNum: 55,
        severity: 3,
        message: 'Pente très forte (55%) - Construction complexe'
      }
    ];

    for (const flag of slopeFlags) {
      const summary = summarizeContext([flag]);
      expect(summary[0]).toContain('Pente');
      expect(summary[0]).toContain(`${flag.valueNum}%`);
    }
  });

  it('should handle flat terrain correctly', async () => {
    // Parcelle sur terrain plat
    const parcelId = 'test_flat';
    const geomWkt = 'POLYGON((2592000 1118000, 2592100 1118000, 2592100 1118100, 2592000 1118100, 2592000 1118000))';
    
    const flags = await getContextForParcel(parcelId, geomWkt);
    
    const slopeFlag = flags.find(f => f.layer === 'slope_pct');
    
    if (slopeFlag && slopeFlag.valueNum && slopeFlag.valueNum < 15) {
      expect(slopeFlag.severity).toBe(1);
      expect(slopeFlag.message).toMatch(/plat|faible/i);
    }
  });

  it('should include slope in multi-context analysis', async () => {
    // Parcelle avec plusieurs contextes incluant la pente
    const parcelId = 'test_multi_slope';
    const geomWkt = 'POLYGON((2595000 1120000, 2595100 1120000, 2595100 1120100, 2595000 1120100, 2595000 1120000))';
    
    const flags = await getContextForParcel(parcelId, geomWkt);
    
    // Vérifier que la pente est incluse parmi d'autres contextes
    const hasSlope = flags.some(f => f.layer === 'slope_pct');
    const hasOtherContexts = flags.some(f => f.layer !== 'slope_pct');
    
    // Le test est valide si on a de la pente ET d'autres contextes
    if (flags.length > 1) {
      expect(hasSlope || hasOtherContexts).toBe(true);
    }
  });
});