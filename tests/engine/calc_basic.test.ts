/**
 * Tests unitaires pour les calculs de base du buildCalculator
 */

import { describe, it, expect } from 'vitest';
import { computeBuildIndicators, CalcInput } from '../../src/engine/buildCalculator';
import { ConsolidatedRule, RuleLevel } from '../../src/engine/ruleResolver';

describe('Build Calculator - Basic Calculations', () => {
  
  it('should calculate SU correctly with indice_u', () => {
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

    expect(result.suM2).toBe(500); // 0.5 × 1000 = 500
    expect(result.details.indice_u).toBe(0.5);
    expect(result.details.formulas.su).toBe('0.5 × 1000 = 500 m²');
  });

  it('should calculate IBUS correctly', () => {
    const input: CalcInput = {
      parcelAreaM2: 1500,
      rules: [
        {
          field: 'ibus',
          value: 0.8,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    expect(result.ibusM2).toBe(1200); // 0.8 × 1500 = 1200
    expect(result.details.ibus).toBe(0.8);
    expect(result.details.formulas.ibus).toBe('0.8 × 1500 = 1200 m²');
  });

  it('should calculate emprise correctly', () => {
    const input: CalcInput = {
      parcelAreaM2: 2000,
      rules: [
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

    expect(result.empriseM2).toBe(800); // 0.4 × 2000 = 800
    expect(result.details.emprise_max).toBe(0.4);
    expect(result.details.formulas.emprise).toBe('0.4 × 2000 = 800 m²');
  });

  it('should round values to 1 decimal place', () => {
    const input: CalcInput = {
      parcelAreaM2: 1234,
      rules: [
        {
          field: 'indice_u',
          value: 0.456,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    expect(result.suM2).toBe(562.7); // Math.round(0.456 × 1234 × 10) / 10
  });

  it('should calculate all metrics with complete rules', () => {
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

    expect(result.suM2).toBe(600);       // 0.6 × 1000
    expect(result.ibusM2).toBe(800);     // 0.8 × 1000
    expect(result.empriseM2).toBe(500);  // 0.5 × 1000
    expect(result.reliability).toBe(1);  // Toutes les valeurs présentes
  });

  it('should estimate number of levels correctly', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'ibus',
          value: 1.5,
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

    expect(result.ibusM2).toBe(1500);    // 1.5 × 1000
    expect(result.empriseM2).toBe(400);  // 0.4 × 1000
    expect(result.niveauxMaxEst).toBe(3); // floor(1500 / 400) = 3
    expect(result.details.formulas.niveaux).toBe('floor(1500 / 400) = 3');
  });

  it('should limit estimated levels by regulatory maximum', () => {
    const input: CalcInput = {
      parcelAreaM2: 1000,
      rules: [
        {
          field: 'ibus',
          value: 2.0,
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
        },
        {
          field: 'niveaux_max',
          value: 3,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test',
          zone_code: 'TEST'
        }
      ]
    };

    const result = computeBuildIndicators(input);

    // Sans limite: floor(2000 / 400) = 5
    // Avec limite réglementaire: 3
    expect(result.niveauxMaxEst).toBe(3);
    
    // Vérifier qu'un contrôle a été ajouté
    const limitControl = result.controls.find(c => c.code === 'NIVEAUX_LIMITED');
    expect(limitControl).toBeDefined();
    expect(limitControl?.level).toBe('info');
  });

  it('should handle zero area correctly', () => {
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

    expect(result.suM2).toBeNull();
    expect(result.ibusM2).toBeNull();
    expect(result.reliability).toBe(0);
    
    const errorControl = result.controls.find(c => c.code === 'INVALID_AREA');
    expect(errorControl).toBeDefined();
    expect(errorControl?.level).toBe('error');
  });

  it('should handle negative area correctly', () => {
    const input: CalcInput = {
      parcelAreaM2: -100,
      rules: []
    };

    const result = computeBuildIndicators(input);

    expect(result.suM2).toBeNull();
    expect(result.reliability).toBe(0);
    expect(result.controls[0].code).toBe('INVALID_AREA');
  });
});