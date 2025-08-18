/**
 * Tests unitaires pour la conversion indice U -> IBUS
 */

import { describe, it, expect } from 'vitest';
import { computeBuildIndicators, CalcInput } from '../../src/engine/buildCalculator';
import { ConsolidatedRule, RuleLevel } from '../../src/engine/ruleResolver';

describe('Build Calculator - IBUS Conversion', () => {
  
  it('should convert indice_u to IBUS when IBUS is missing', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'indice_u',
          value: 0.5,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    // According to conversion table: indice_u 0.5 -> IBUS 0.67
    expect(result.ibusM2).toBe(670); // 0.67 × 1000
    expect(result.details.ibus_calculated).toBe(0.67);
    expect(result.details.conversion_applied).toBe(true);
    
    // Check info control was added
    const conversionControl = result.controls.find(c => c.code === 'IBUS_CONVERTED');
    expect(conversionControl).toBeDefined();
    expect(conversionControl?.level).toBe('info');
  });

  it('should use exact values from conversion table', () => {
    const testCases = [
      { indiceU: 0.35, expectedIBUS: 0.50 },
      { indiceU: 0.40, expectedIBUS: 0.53 },
      { indiceU: 0.45, expectedIBUS: 0.60 },
      { indiceU: 0.55, expectedIBUS: 0.73 },
      { indiceU: 0.60, expectedIBUS: 0.80 },
      { indiceU: 0.65, expectedIBUS: 0.87 },
      { indiceU: 0.70, expectedIBUS: 0.93 },
      { indiceU: 0.75, expectedIBUS: 1.00 },
      { indiceU: 0.80, expectedIBUS: 1.07 },
      { indiceU: 0.85, expectedIBUS: 1.13 }
    ];

    for (const testCase of testCases) {
      const input: CalcInput = {
        parcelAreaM2: 1000,
        rules: [
          {
            field: 'indice_u',
            value: testCase.indiceU,
            level: RuleLevel.LEVEL3,
            overridden: [],
            zone_id: 'test',
            zone_code: 'TEST'
          }
        ]
      };

      const result = computeBuildIndicators(input);
      
      expect(result.details.ibus_calculated).toBe(testCase.expectedIBUS);
      expect(result.ibusM2).toBe(testCase.expectedIBUS * 1000);
    }
  });

  it('should interpolate values between table entries', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'indice_u',
          value: 0.42, // Between 0.40 (0.53) and 0.45 (0.60)
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);
    
    // Linear interpolation: 0.53 + (0.42-0.40)/(0.45-0.40) * (0.60-0.53)
    // = 0.53 + 0.02/0.05 * 0.07 = 0.53 + 0.028 = 0.558
    expect(result.details.ibus_calculated).toBeCloseTo(0.558, 3);
  });

  it('should use formula for values outside table range', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'indice_u',
          value: 0.30, // Below table minimum
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);
    
    // Formula: max(indice_u × 1.333, 0.5)
    // 0.30 × 1.333 = 0.4 -> min 0.5
    expect(result.details.ibus_calculated).toBe(0.5);
    expect(result.ibusM2).toBe(500);
  });

  it('should prefer existing IBUS over conversion', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'indice_u',
          value: 0.5,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        },
        {
          field: 'ibus',
          value: 0.9, // Explicit IBUS value
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    // Should use explicit IBUS, not converted value
    expect(result.ibusM2).toBe(900); // 0.9 × 1000
    expect(result.details.ibus).toBe(0.9);
    expect(result.details.conversion_applied).toBeUndefined();
    
    // No conversion control should be added
    const conversionControl = result.controls.find(c => c.code === 'IBUS_CONVERTED');
    expect(conversionControl).toBeUndefined();
  });

  it('should handle missing both indice_u and IBUS', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'emprise_max',
          value: 0.5,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    expect(result.suM2).toBeNull();
    expect(result.ibusM2).toBeNull();
    expect(result.details.conversion_applied).toBeUndefined();
    
    // Check warnings
    const indiceUWarning = result.controls.find(c => c.code === 'MISSING_INDICE_U');
    const ibusWarning = result.controls.find(c => c.code === 'MISSING_IBUS');
    
    expect(indiceUWarning).toBeDefined();
    expect(ibusWarning).toBeDefined();
  });

  it('should calculate both SU and converted IBUS correctly', () => {
    const input: CalcInput = {
      parcelAreaM2: 1500,
      rules: [
        {
          field: 'indice_u',
          value: 0.6,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    // SU = 0.6 × 1500 = 900
    expect(result.suM2).toBe(900);
    
    // IBUS from table: 0.6 -> 0.80
    expect(result.details.ibus_calculated).toBe(0.80);
    expect(result.ibusM2).toBe(1200); // 0.80 × 1500
    
    // Both formulas should be present
    expect(result.details.formulas.su).toBe('0.6 × 1500 = 900 m²');
    expect(result.details.formulas.ibus).toBe('0.8 × 1500 = 1200 m²');
  });
});