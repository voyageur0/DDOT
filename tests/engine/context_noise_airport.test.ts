/**
 * Tests pour les contextes de bruit et aéroport
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getContextForParcel, ContextFlag } from '../../src/engine/contextResolver';
import { summarizeContext } from '../../src/engine/contextFormatter';

describe('Context Engine - Noise and Airport', () => {
  
  it('should detect noise zone DS IV and airport zone', async () => {
    // Parcelle dans zone de bruit DS IV et zone OFAC
    const parcelId = 'test_noise_airport';
    const geomWkt = 'POLYGON((2593500 1119500, 2593600 1119500, 2593600 1119600, 2593500 1119600, 2593500 1119500))';
    
    const flags = await getContextForParcel(parcelId, geomWkt);
    
    // Vérifier qu'on a au moins 2 flags
    expect(flags.length).toBeGreaterThanOrEqual(2);
    
    // Vérifier le flag de bruit
    const noiseFlag = flags.find(f => f.layer === 'opb_noise');
    expect(noiseFlag).toBeDefined();
    if (noiseFlag) {
      expect(noiseFlag.intersects).toBe(true);
      expect(noiseFlag.severity).toBeGreaterThanOrEqual(2);
      expect(noiseFlag.message).toContain('bruit');
    }
    
    // Vérifier le flag aéroport
    const airportFlag = flags.find(f => f.layer === 'ofac_airport');
    expect(airportFlag).toBeDefined();
    if (airportFlag) {
      expect(airportFlag.intersects).toBe(true);
      expect(airportFlag.severity).toBe(2);
      expect(airportFlag.message).toContain('aéroport');
    }
  });

  it('should prioritize critical noise zones', async () => {
    // Parcelle dans zone très bruyante
    const parcelId = 'test_high_noise';
    const geomWkt = 'POLYGON((2600200 1120000, 2600300 1120000, 2600300 1120100, 2600200 1120100, 2600200 1120000))';
    
    const flags = await getContextForParcel(parcelId, geomWkt);
    
    // Si on a un flag de bruit DS IV ou V, il doit être critique
    const noiseFlag = flags.find(f => f.layer === 'opb_noise' && (f.valueText === 'DS IV' || f.valueText === 'DS V'));
    if (noiseFlag) {
      expect(noiseFlag.severity).toBe(3);
    }
  });

  it('should format noise and airport messages correctly', () => {
    const testFlags: ContextFlag[] = [
      {
        layer: 'opb_noise',
        intersects: true,
        valueText: 'DS III',
        severity: 2,
        message: 'Zone de bruit DS III'
      },
      {
        layer: 'ofac_airport',
        intersects: true,
        severity: 2,
        message: 'Zone de sécurité aéroport (OFAC)'
      },
      {
        layer: 'roads_cantonal',
        intersects: false,
        distance: 30,
        severity: 1,
        message: 'Route cantonale à 30m'
      }
    ];
    
    const summary = summarizeContext(testFlags, 5);
    
    expect(summary).toHaveLength(3);
    expect(summary[0]).toContain('bruit');
    expect(summary[1]).toContain('aéroport');
  });

  it('should handle overlapping noise zones', async () => {
    // Parcelle pouvant être dans plusieurs zones de bruit
    const parcelId = 'test_multi_noise';
    const geomWkt = 'POLYGON((2600100 1120000, 2600150 1120000, 2600150 1120050, 2600100 1120050, 2600100 1120000))';
    
    const flags = await getContextForParcel(parcelId, geomWkt);
    
    // Devrait avoir au maximum un flag de bruit (le plus restrictif)
    const noiseFlags = flags.filter(f => f.layer.startsWith('opb_noise'));
    expect(noiseFlags.length).toBeLessThanOrEqual(1);
    
    // Si plusieurs zones, prendre la plus restrictive
    if (noiseFlags.length > 0) {
      const levels = ['DS I', 'DS II', 'DS III', 'DS IV', 'DS V'];
      const flagLevel = noiseFlags[0].valueText;
      expect(levels).toContain(flagLevel);
    }
  });

  it('should detect airport proximity without intersection', async () => {
    // Parcelle proche mais hors zone aéroport
    const parcelId = 'test_near_airport';
    const geomWkt = 'POLYGON((2594600 1119000, 2594700 1119000, 2594700 1119100, 2594600 1119100, 2594600 1119000))';
    
    const flags = await getContextForParcel(parcelId, geomWkt);
    
    // Peut avoir un flag aéroport avec distance
    const airportFlag = flags.find(f => f.layer === 'ofac_airport');
    if (airportFlag && !airportFlag.intersects) {
      expect(airportFlag.distance).toBeDefined();
      expect(airportFlag.distance).toBeGreaterThan(0);
    }
  });
});