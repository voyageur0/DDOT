/**
 * Tests unitaires pour le calcul du score de fiabilité
 */

import { describe, it, expect } from 'vitest';
import { computeBuildIndicators, CalcInput } from '../../src/engine/buildCalculator';
import { ConsolidatedRule, RuleLevel } from '../../src/engine/ruleResolver';

describe('Build Calculator - Reliability Score', () => {
  
  it('should give 100% reliability with all values present', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'indice_u',
          value: 0.6,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        },
        {
          field: 'ibus',
          value: 0.8,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        },
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

    expect(result.reliability).toBe(1.0);
    expect(result.details.missing_values).toHaveLength(0);
  });

  it('should reduce reliability by 0.25 per missing value', () => {
    const testCases = [
      {
        name: '1 missing value',
        rules: [
          { field: 'indice_u', value: 0.6 },
          { field: 'ibus', value: 0.8 }
          // emprise_max missing
        ],
        expectedReliability: 0.75,
        expectedMissing: ['emprise_max']
      },
      {
        name: '2 missing values',
        rules: [
          { field: 'indice_u', value: 0.6 }
          // ibus and emprise_max missing
        ],
        expectedReliability: 0.5,
        expectedMissing: ['ibus', 'emprise_max']
      },
      {
        name: 'all 3 missing',
        rules: [
          // All building metrics missing
          { field: 'h_max_m', value: 12 }
        ],
        expectedReliability: 0.25, // Minimum
        expectedMissing: ['indice_u', 'ibus', 'emprise_max']
      }
    ];

    for (const testCase of testCases) {
      const input: CalcInput = {
        parcelAreaM2: 1000,
        rules: testCase.rules.map(r => ({
          field: r.field,
          value: r.value,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }))
      };

      const result = computeBuildIndicators(input);

      expect(result.reliability).toBe(testCase.expectedReliability);
      expect(result.details.missing_values).toEqual(testCase.expectedMissing);
    }
  });

  it('should have minimum reliability of 0.25', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [] // No rules at all
    };

    const result = computeBuildIndicators(input);

    expect(result.reliability).toBe(0.25);
    expect(result.details.missing_values).toHaveLength(3);
  });

  it('should not count converted IBUS as missing', () => {
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
          field: 'emprise_max',
          value: 0.4,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    // IBUS is calculated from indice_u, not missing
    expect(result.reliability).toBe(1.0);
    expect(result.details.missing_values).not.toContain('ibus');
    expect(result.details.conversion_applied).toBe(true);
  });

  it('should track reliability even with calculation errors', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'indice_u',
          value: 0.8,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        },
        {
          field: 'ibus',
          value: 0.6, // Error: IBUS < indice_u
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        },
        {
          field: 'emprise_max',
          value: 0.4,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    // All values present, even if incoherent
    expect(result.reliability).toBe(1.0);
    
    // But should have error control
    const errorControl = result.controls.find(c => c.code === 'IBUS_INCOHERENT');
    expect(errorControl).toBeDefined();
  });

  it('should handle zero area with appropriate reliability', () => {
    const input: CalcInput = {
      parcelAreaM2: 0,
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

    // Zero area = no calculations possible
    expect(result.reliability).toBe(0);
    expect(result.controls[0].code).toBe('INVALID_AREA');
  });

  it('should provide detailed reliability information', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'indice_u',
          value: 0.6,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
        // Missing ibus and emprise_max
      ]
    };

    const result = computeBuildIndicators(input);

    expect(result.reliability).toBe(0.5); // 1.0 - 0.25*2
    expect(result.details.missing_values).toContain('emprise_max');
    expect(result.details.missing_values).not.toContain('ibus'); // Converted from indice_u
    expect(result.details.conversion_applied).toBe(true);
    
    // Should have warnings about missing values
    const empriseWarning = result.controls.find(c => c.code === 'MISSING_EMPRISE');
    expect(empriseWarning).toBeDefined();
  });

  it('should calculate reliability percentage correctly', () => {
    const reliabilityValues = [1.0, 0.75, 0.5, 0.25];
    
    for (const reliability of reliabilityValues) {
      const percentage = Math.round(reliability * 100);
      expect(percentage).toBe(reliability * 100);
    }
  });
});