/**
 * Tests unitaires pour les fonctions utilitaires du RuleHelper
 */

import { describe, it, expect } from 'vitest';
import { RuleHelper, RuleLevel, ConsolidatedRule } from '../../src/engine/ruleResolver';

describe('RuleHelper Utilities', () => {
  
  describe('extractBuildingRules', () => {
    it('should extract standard building rules correctly', () => {
      const rules: ConsolidatedRule[] = [
        {
          field: 'h_max_m',
          value: 12,
          level: RuleLevel.LEVEL1,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        {
          field: 'indice_u',
          value: 0.6,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        {
          field: 'custom_field',
          value: 'custom_value',
          level: RuleLevel.LEVEL2,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        }
      ];

      const buildingRules = RuleHelper.extractBuildingRules(rules);

      expect(buildingRules.h_max_m).toBe(12);
      expect(buildingRules.indice_u).toBe(0.6);
      expect(buildingRules).not.toHaveProperty('custom_field');
    });

    it('should handle missing values gracefully', () => {
      const rules: ConsolidatedRule[] = [
        {
          field: 'h_max_m',
          value: 15,
          level: RuleLevel.LEVEL1,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        }
      ];

      const buildingRules = RuleHelper.extractBuildingRules(rules);

      expect(buildingRules.h_max_m).toBe(15);
      expect(buildingRules.indice_u).toBeUndefined();
      expect(buildingRules.ibus).toBeUndefined();
      expect(buildingRules.niveaux_max).toBeUndefined();
    });

    it('should extract complex toit_types correctly', () => {
      const rules: ConsolidatedRule[] = [
        {
          field: 'toit_types',
          value: ['2_pans', '4_pans', 'plat'],
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        {
          field: 'pente_toit_min_max',
          value: { min: 20, max: 45 },
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        }
      ];

      const buildingRules = RuleHelper.extractBuildingRules(rules);

      expect(buildingRules.toit_types).toEqual(['2_pans', '4_pans', 'plat']);
      expect(buildingRules.pente_toit_min_max).toEqual({ min: 20, max: 45 });
    });
  });

  describe('groupRulesByCategory', () => {
    it('should group rules into correct categories', () => {
      const rules: ConsolidatedRule[] = [
        // Construction rules
        {
          field: 'h_max_m',
          value: 12,
          level: RuleLevel.LEVEL1,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        {
          field: 'indice_u',
          value: 0.6,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        // Environmental rules
        {
          field: 'distance_foret_min_m',
          value: 10,
          level: RuleLevel.LEVEL4,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        {
          field: 'niveau_bruit_max_db',
          value: 60,
          level: RuleLevel.LEVEL4,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        // Usage rules
        {
          field: 'mixite_fonctionnelle',
          value: { logement_min: 0.3 },
          level: RuleLevel.LEVEL2,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        // Other
        {
          field: 'custom_rule',
          value: 'test',
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        }
      ];

      const grouped = RuleHelper.groupRulesByCategory(rules);

      expect(grouped.construction).toHaveLength(2);
      expect(grouped.environmental).toHaveLength(2);
      expect(grouped.usage).toHaveLength(1);
      expect(grouped.other).toHaveLength(1);

      expect(grouped.construction.map(r => r.field)).toContain('h_max_m');
      expect(grouped.construction.map(r => r.field)).toContain('indice_u');
      expect(grouped.environmental.map(r => r.field)).toContain('distance_foret_min_m');
      expect(grouped.environmental.map(r => r.field)).toContain('niveau_bruit_max_db');
    });

    it('should handle empty rules array', () => {
      const grouped = RuleHelper.groupRulesByCategory([]);

      expect(grouped.construction).toHaveLength(0);
      expect(grouped.environmental).toHaveLength(0);
      expect(grouped.usage).toHaveLength(0);
      expect(grouped.other).toHaveLength(0);
    });
  });

  describe('findConflicts', () => {
    it('should identify conflicting rules', () => {
      const rules: ConsolidatedRule[] = [
        {
          field: 'h_max_m',
          value: 12,
          level: RuleLevel.LEVEL1,
          overridden: [
            { level: RuleLevel.LEVEL3, value: 15 },
            { level: RuleLevel.LEVEL4, value: 20 }
          ],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        {
          field: 'indice_u',
          value: 0.6,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        {
          field: 'emprise_max',
          value: 0.4,
          level: RuleLevel.LEVEL2,
          overridden: [
            { level: RuleLevel.LEVEL3, value: 0.5 }
          ],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        }
      ];

      const conflicts = RuleHelper.findConflicts(rules);

      expect(conflicts).toHaveLength(2);
      expect(conflicts.map(r => r.field)).toContain('h_max_m');
      expect(conflicts.map(r => r.field)).toContain('emprise_max');
      expect(conflicts.map(r => r.field)).not.toContain('indice_u');
    });

    it('should return empty array when no conflicts', () => {
      const rules: ConsolidatedRule[] = [
        {
          field: 'h_max_m',
          value: 12,
          level: RuleLevel.LEVEL1,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        }
      ];

      const conflicts = RuleHelper.findConflicts(rules);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('formatRuleValue', () => {
    it('should format numeric values correctly', () => {
      expect(RuleHelper.formatRuleValue('h_max_m', 12.5)).toBe('12.5 m');
      expect(RuleHelper.formatRuleValue('indice_u', 0.6)).toBe('0.6');
      expect(RuleHelper.formatRuleValue('recul_min_m', 5)).toBe('5 m');
      expect(RuleHelper.formatRuleValue('niveau_bruit_max_db', 60)).toBe('60 dB');
      expect(RuleHelper.formatRuleValue('emprise_max', 0.45)).toBe('45%');
    });

    it('should format boolean values', () => {
      expect(RuleHelper.formatRuleValue('alignement_obligatoire', true)).toBe('Oui');
      expect(RuleHelper.formatRuleValue('alignement_obligatoire', 'true')).toBe('Oui');
      expect(RuleHelper.formatRuleValue('rez_commercial_obligatoire', false)).toBe('Non');
      expect(RuleHelper.formatRuleValue('rez_commercial_obligatoire', 'false')).toBe('Non');
    });

    it('should format array values', () => {
      expect(RuleHelper.formatRuleValue('toit_types', ['2_pans', '4_pans']))
        .toBe('2_pans, 4_pans');
      expect(RuleHelper.formatRuleValue('materiaux_facade', ['bois', 'pierre', 'crepi']))
        .toBe('bois, pierre, crepi');
    });

    it('should handle complex JSON values', () => {
      const mixite = {
        logement_min: 0.3,
        logement_max: 0.7,
        activites_min: 0.3
      };
      expect(RuleHelper.formatRuleValue('mixite_fonctionnelle', mixite))
        .toBe(JSON.stringify(mixite));
    });

    it('should handle unknown fields', () => {
      expect(RuleHelper.formatRuleValue('unknown_field', 42)).toBe('42');
      expect(RuleHelper.formatRuleValue('unknown_field', 'test')).toBe('test');
    });
  });

  describe('sortRulesByPriority', () => {
    it('should sort rules by level priority', () => {
      const rules: ConsolidatedRule[] = [
        {
          field: 'rule3',
          value: 3,
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        {
          field: 'rule1',
          value: 1,
          level: RuleLevel.LEVEL1,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        {
          field: 'rule4',
          value: 4,
          level: RuleLevel.LEVEL4,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        {
          field: 'rule2',
          value: 2,
          level: RuleLevel.LEVEL2,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        }
      ];

      const sorted = RuleHelper.sortRulesByPriority(rules);

      expect(sorted[0].level).toBe(RuleLevel.LEVEL1);
      expect(sorted[1].level).toBe(RuleLevel.LEVEL2);
      expect(sorted[2].level).toBe(RuleLevel.LEVEL3);
      expect(sorted[3].level).toBe(RuleLevel.LEVEL4);
    });

    it('should maintain order for same level', () => {
      const rules: ConsolidatedRule[] = [
        {
          field: 'rule_b',
          value: 'B',
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        {
          field: 'rule_a',
          value: 'A',
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        },
        {
          field: 'rule_c',
          value: 'C',
          level: RuleLevel.LEVEL3,
          overridden: [],
          zone_id: 'test-zone',
          zone_code: 'TEST_ZONE'
        }
      ];

      const sorted = RuleHelper.sortRulesByPriority(rules);

      // Should maintain original order for same level
      expect(sorted.map(r => r.field)).toEqual(['rule_b', 'rule_a', 'rule_c']);
    });
  });
});