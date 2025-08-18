/**
 * Tests unitaires pour la résolution des priorités du moteur de règles
 * Vérifie que les règles de niveau supérieur écrasent les règles de niveau inférieur
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { RuleResolver, RuleLevel, ConsolidatedRule } from '../../src/engine/ruleResolver';
import { config } from 'dotenv';

config({ path: '.env.test' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Rule Priority Resolution', () => {
  const ruleResolver = new RuleResolver();
  let testZoneId: string;
  let testSourceId: string;

  beforeAll(async () => {
    // Créer une zone de test
    const { data: zone, error: zoneError } = await supabase
      .from('zones')
      .insert({
        commune_id: '00000000-0000-0000-0000-000000000000',
        code_source: 'TEST_PRIORITY',
        code_norm: 'TEST_PRIORITY',
        nom_zone: 'Zone Test Priorités',
        geom: null
      })
      .select('id')
      .single();

    if (zoneError) throw zoneError;
    testZoneId = zone.id;

    // Créer une source de test
    const { data: source, error: sourceError } = await supabase
      .from('regulation_sources')
      .insert({
        pdf_path: 'test/priority_test.pdf',
        article_ref: 'TEST_ART',
        ocr_confidence: 1.0
      })
      .select('id')
      .single();

    if (sourceError) throw sourceError;
    testSourceId = source.id;
  });

  afterAll(async () => {
    // Nettoyer les données de test
    await supabase
      .from('rule_definitions')
      .delete()
      .eq('zone_id', testZoneId);

    await supabase
      .from('zones')
      .delete()
      .eq('id', testZoneId);

    await supabase
      .from('regulation_sources')
      .delete()
      .eq('id', testSourceId);
  });

  it('should prioritize LEVEL1 over LEVEL3 and LEVEL4', async () => {
    // Insérer des règles conflictuelles
    const rules = [
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL4,
        field: 'h_max_m',
        value: 20,
        description: 'Hauteur maximale selon règlement cantonal',
        source_id: testSourceId
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL3,
        field: 'h_max_m',
        value: 15,
        description: 'Hauteur maximale selon RCCZ',
        source_id: testSourceId
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL1,
        field: 'h_max_m',
        value: 12,
        description: 'Hauteur maximale selon servitude PSQ',
        source_id: testSourceId
      }
    ];

    await ruleResolver.insertRulesBatch(rules);

    // Résoudre les règles
    const consolidated = await ruleResolver.resolveRulesByZone(testZoneId);
    const heightRule = consolidated.find(r => r.field === 'h_max_m');

    expect(heightRule).toBeDefined();
    expect(heightRule!.value).toBe(12);
    expect(heightRule!.level).toBe(RuleLevel.LEVEL1);
    expect(heightRule!.overridden).toHaveLength(2);
    expect(heightRule!.overridden.map(o => o.value)).toContain(15);
    expect(heightRule!.overridden.map(o => o.value)).toContain(20);
  });

  it('should prioritize LEVEL2 over LEVEL3 and LEVEL4', async () => {
    const rules = [
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL4,
        field: 'places_parc_ratio',
        value: 1.0,
        description: 'Ratio standard cantonal',
        source_id: testSourceId
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL3,
        field: 'places_parc_ratio',
        value: 1.2,
        description: 'Ratio selon RCCZ',
        source_id: testSourceId
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL2,
        field: 'places_parc_ratio',
        value: 1.5,
        description: 'Ratio selon PAZ complément',
        source_id: testSourceId
      }
    ];

    await ruleResolver.insertRulesBatch(rules);

    const consolidated = await ruleResolver.resolveRulesByZone(testZoneId);
    const parkingRule = consolidated.find(r => r.field === 'places_parc_ratio');

    expect(parkingRule).toBeDefined();
    expect(parkingRule!.value).toBe(1.5);
    expect(parkingRule!.level).toBe(RuleLevel.LEVEL2);
    expect(parkingRule!.overridden).toHaveLength(2);
  });

  it('should handle multiple LEVEL1 rules with different validity dates', async () => {
    const today = new Date();
    const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

    const rules = [
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL1,
        field: 'emprise_max',
        value: 0.4,
        description: 'Ancienne servitude',
        source_id: testSourceId,
        validity_from: lastYear
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL1,
        field: 'emprise_max',
        value: 0.3,
        description: 'Nouvelle servitude',
        source_id: testSourceId,
        validity_from: today
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL1,
        field: 'emprise_max',
        value: 0.25,
        description: 'Future servitude',
        source_id: testSourceId,
        validity_from: nextYear
      }
    ];

    await ruleResolver.insertRulesBatch(rules);

    const consolidated = await ruleResolver.resolveRulesByZone(testZoneId);
    const empriseRule = consolidated.find(r => r.field === 'emprise_max');

    expect(empriseRule).toBeDefined();
    expect(empriseRule!.value).toBe(0.3); // La règle valide aujourd'hui
    expect(empriseRule!.description).toContain('Nouvelle servitude');
  });

  it('should preserve non-conflicting rules from all levels', async () => {
    const rules = [
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL1,
        field: 'distance_foret_min_m',
        value: 30,
        description: 'Distance forêt selon servitude',
        source_id: testSourceId
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL2,
        field: 'materiaux_facade',
        value: ['bois', 'pierre'],
        description: 'Matériaux selon PAZ',
        source_id: testSourceId
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL3,
        field: 'indice_u',
        value: 0.6,
        description: 'Indice U selon RCCZ',
        source_id: testSourceId
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL4,
        field: 'niveau_bruit_max_db',
        value: 60,
        description: 'Bruit max selon OPB',
        source_id: testSourceId
      }
    ];

    await ruleResolver.insertRulesBatch(rules);

    const consolidated = await ruleResolver.resolveRulesByZone(testZoneId);

    // Toutes les règles doivent être présentes car elles ne sont pas en conflit
    expect(consolidated).toHaveLength(4);
    
    const forestRule = consolidated.find(r => r.field === 'distance_foret_min_m');
    expect(forestRule?.value).toBe(30);
    expect(forestRule?.level).toBe(RuleLevel.LEVEL1);
    expect(forestRule?.overridden).toHaveLength(0);

    const materialsRule = consolidated.find(r => r.field === 'materiaux_facade');
    expect(materialsRule?.value).toEqual(['bois', 'pierre']);
    expect(materialsRule?.level).toBe(RuleLevel.LEVEL2);

    const indiceRule = consolidated.find(r => r.field === 'indice_u');
    expect(indiceRule?.value).toBe(0.6);
    expect(indiceRule?.level).toBe(RuleLevel.LEVEL3);

    const noiseRule = consolidated.find(r => r.field === 'niveau_bruit_max_db');
    expect(noiseRule?.value).toBe(60);
    expect(noiseRule?.level).toBe(RuleLevel.LEVEL4);
  });

  it('should handle complex JSON values correctly', async () => {
    const complexValue = {
      logement_min: 0.3,
      logement_max: 0.7,
      activites_min: 0.3,
      activites_max: 0.7
    };

    const rules = [
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL2,
        field: 'mixite_fonctionnelle',
        value: complexValue,
        description: 'Mixité selon PAZ',
        source_id: testSourceId
      }
    ];

    await ruleResolver.insertRulesBatch(rules);

    const consolidated = await ruleResolver.resolveRulesByZone(testZoneId);
    const mixityRule = consolidated.find(r => r.field === 'mixite_fonctionnelle');

    expect(mixityRule).toBeDefined();
    expect(mixityRule!.value).toEqual(complexValue);
  });
});