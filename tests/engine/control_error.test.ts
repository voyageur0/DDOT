/**
 * Tests unitaires pour les contrôles de cohérence et erreurs
 */

import { describe, it, expect } from 'vitest';
import { computeBuildIndicators, CalcInput, summarizeControls } from '../../src/engine/buildCalculator';
import { ConsolidatedRule, RuleLevel } from '../../src/engine/ruleResolver';

describe('Build Calculator - Control and Error Checks', () => {
  
  it('should detect IBUS < SU as error', () => {
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
          value: 0.6, // IBUS < indice_u = incohérent
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    expect(result.suM2).toBe(800);    // 0.8 × 1000
    expect(result.ibusM2).toBe(600);  // 0.6 × 1000

    // Should have coherence error
    const coherenceError = result.controls.find(c => c.code === 'IBUS_INCOHERENT');
    expect(coherenceError).toBeDefined();
    expect(coherenceError?.level).toBe('error');
    expect(coherenceError?.message).toContain('IBUS (600 m²) inférieur à SU (800 m²)');
  });

  it('should warn about indice_u out of normal range', () => {
    const testCases = [
      { value: 0, expectedWarning: true },
      { value: -0.5, expectedWarning: true },
      { value: 2.5, expectedWarning: true },
      { value: 0.5, expectedWarning: false },
      { value: 1.5, expectedWarning: false }
    ];

    for (const testCase of testCases) {
      const input: CalcInput = {
        parcelAreaM2: 1000,
        rules: [
          {
            field: 'indice_u',
            value: testCase.value,
            level: RuleLevel.LEVEL3,
            overridden: [],
            zone_id: 'test',
            zone_code: 'TEST'
          }
        ]
      };

      const result = computeBuildIndicators(input);
      const rangeWarning = result.controls.find(c => c.code === 'INDICE_U_RANGE');

      if (testCase.expectedWarning) {
        expect(rangeWarning).toBeDefined();
        expect(rangeWarning?.level).toBe('warning');
      } else {
        expect(rangeWarning).toBeUndefined();
      }
    }
  });

  it('should warn about emprise_max out of normal range', () => {
    const testCases = [
      { value: 0, expectedWarning: true },
      { value: -0.1, expectedWarning: true },
      { value: 1.2, expectedWarning: true },
      { value: 0.4, expectedWarning: false },
      { value: 0.8, expectedWarning: false }
    ];

    for (const testCase of testCases) {
      const input: CalcInput = {
        parcelAreaM2: 1000,
        rules: [
          {
            field: 'emprise_max',
            value: testCase.value,
            level: RuleLevel.LEVEL3,
            overridden: [],
            zone_id: 'test',
            zone_code: 'TEST'
          }
        ]
      };

      const result = computeBuildIndicators(input);
      const rangeWarning = result.controls.find(c => c.code === 'EMPRISE_RANGE');

      if (testCase.expectedWarning) {
        expect(rangeWarning).toBeDefined();
        expect(rangeWarning?.level).toBe('warning');
      } else {
        expect(rangeWarning).toBeUndefined();
      }
    }
  });

  it('should handle multiple control messages correctly', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'indice_u',
          value: 2.5, // Out of range
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        },
        {
          field: 'ibus',
          value: 2.0, // Less than indice_u × 1.333 = error
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    // Should have multiple controls
    expect(result.controls.length).toBeGreaterThanOrEqual(2);
    
    const summary = summarizeControls(result.controls);
    expect(summary.errors).toBeGreaterThanOrEqual(1);
    expect(summary.warnings).toBeGreaterThanOrEqual(1);
  });

  it('should not calculate levels when emprise is zero', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'ibus',
          value: 1.0,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        },
        {
          field: 'emprise_max',
          value: 0, // Zero emprise
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    expect(result.niveauxMaxEst).toBeNull();
    expect(result.details.formulas.niveaux).toBeUndefined();
  });

  it('should track missing values correctly', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'h_max_m',
          value: 12, // Not a building metric we track
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    expect(result.details.missing_values).toContain('indice_u');
    expect(result.details.missing_values).toContain('ibus');
    expect(result.details.missing_values).toContain('emprise_max');
  });

  it('should provide info level controls for conversions', () => {
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

    // Should have info about IBUS conversion
    const infoControls = result.controls.filter(c => c.level === 'info');
    expect(infoControls.length).toBeGreaterThan(0);
    
    const conversionInfo = infoControls.find(c => c.code === 'IBUS_CONVERTED');
    expect(conversionInfo?.message).toContain('IBUS calculé depuis indice U');
  });

  it('should handle edge case calculations gracefully', () => {
    const input: CalcInput = {
      parcelAreaM2: 0.1, // Very small parcel
      rules: [
        {
          field: 'indice_u',
          value: 0.00001, // Very small index
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    expect(result.suM2).toBe(0); // Rounded to 0
    expect(result.controls.find(c => c.level === 'error')).toBeUndefined(); // No errors
  });
});