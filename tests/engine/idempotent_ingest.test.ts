/**
 * Tests unitaires pour vérifier l'idempotence des scripts d'ingestion
 * S'assure que relancer les scripts n'introduit pas de doublons
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { RuleResolver, RuleLevel } from '../../src/engine/ruleResolver';
import { config } from 'dotenv';

config({ path: '.env.test' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Idempotent Rule Ingestion', () => {
  const ruleResolver = new RuleResolver();
  let testZoneId: string;
  let testSourceId: string;

  beforeAll(async () => {
    // Créer une zone de test
    const { data: zone, error: zoneError } = await supabase
      .from('zones')
      .insert({
        commune_id: '00000000-0000-0000-0000-000000000000',
        code_source: 'TEST_IDEMPOTENT',
        code_norm: 'TEST_IDEMPOTENT',
        nom_zone: 'Zone Test Idempotence'
      })
      .select('id')
      .single();

    if (zoneError) throw zoneError;
    testZoneId = zone.id;

    // Créer une source
    const { data: source } = await supabase
      .from('regulation_sources')
      .insert({
        pdf_path: 'test/idempotent_test.pdf',
        article_ref: 'TEST_IDEM',
        ocr_confidence: 1.0
      })
      .select('id')
      .single();

    testSourceId = source!.id;
  });

  afterAll(async () => {
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

  it('should not create duplicates when inserting same rule twice', async () => {
    const rule = {
      zone_id: testZoneId,
      level: RuleLevel.LEVEL3,
      field: 'h_max_m',
      value: 12,
      description: 'Test idempotence',
      source_id: testSourceId
    };

    // Première insertion
    await ruleResolver.insertRulesBatch([rule]);

    // Compter les règles
    const { count: count1 } = await supabase
      .from('rule_definitions')
      .select('*', { count: 'exact', head: true })
      .eq('zone_id', testZoneId)
      .eq('field', 'h_max_m');

    expect(count1).toBe(1);

    // Deuxième insertion (doit être ignorée)
    await ruleResolver.insertRulesBatch([rule]);

    // Recompter
    const { count: count2 } = await supabase
      .from('rule_definitions')
      .select('*', { count: 'exact', head: true })
      .eq('zone_id', testZoneId)
      .eq('field', 'h_max_m');

    expect(count2).toBe(1);
  });

  it('should allow different validity dates for same rule', async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const rules = [
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL2,
        field: 'indice_u',
        value: 0.5,
        description: 'Version actuelle',
        source_id: testSourceId,
        validity_from: today
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL2,
        field: 'indice_u',
        value: 0.6,
        description: 'Version future',
        source_id: testSourceId,
        validity_from: tomorrow
      }
    ];

    // Les deux insertions doivent réussir
    await ruleResolver.insertRulesBatch(rules);

    const { count } = await supabase
      .from('rule_definitions')
      .select('*', { count: 'exact', head: true })
      .eq('zone_id', testZoneId)
      .eq('field', 'indice_u')
      .eq('level', RuleLevel.LEVEL2);

    expect(count).toBe(2);
  });

  it('should handle batch idempotency correctly', async () => {
    const batch = [
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL4,
        field: 'distance_foret_min_m',
        value: 10,
        description: 'Distance forêt',
        source_id: testSourceId
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL4,
        field: 'niveau_bruit_max_db',
        value: 60,
        description: 'Bruit maximal',
        source_id: testSourceId
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL4,
        field: 'surface_min_logement_m2',
        value: 25,
        description: 'Surface minimale',
        source_id: testSourceId
      }
    ];

    // Première insertion
    await ruleResolver.insertRulesBatch(batch);

    // Compter
    const { count: count1 } = await supabase
      .from('rule_definitions')
      .select('*', { count: 'exact', head: true })
      .eq('zone_id', testZoneId)
      .eq('level', RuleLevel.LEVEL4);

    expect(count1).toBe(3);

    // Réinsérer le batch
    await ruleResolver.insertRulesBatch(batch);

    // Recompter - doit rester identique
    const { count: count2 } = await supabase
      .from('rule_definitions')
      .select('*', { count: 'exact', head: true })
      .eq('zone_id', testZoneId)
      .eq('level', RuleLevel.LEVEL4);

    expect(count2).toBe(3);
  });

  it('should handle partial duplicates in batch', async () => {
    // Insérer quelques règles
    const initialBatch = [
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL1,
        field: 'emprise_max',
        value: 0.4,
        description: 'Emprise initiale',
        source_id: testSourceId
      },
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL1,
        field: 'recul_min_m',
        value: 5,
        description: 'Recul initial',
        source_id: testSourceId
      }
    ];

    await ruleResolver.insertRulesBatch(initialBatch);

    // Batch avec duplicata et nouvelles règles
    const mixedBatch = [
      // Duplicata
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL1,
        field: 'emprise_max',
        value: 0.4,
        description: 'Emprise initiale',
        source_id: testSourceId
      },
      // Nouvelle règle
      {
        zone_id: testZoneId,
        level: RuleLevel.LEVEL1,
        field: 'h_corniche_max_m',
        value: 18,
        description: 'Hauteur corniche',
        source_id: testSourceId
      }
    ];

    await ruleResolver.insertRulesBatch(mixedBatch);

    // Vérifier le total
    const { count } = await supabase
      .from('rule_definitions')
      .select('*', { count: 'exact', head: true })
      .eq('zone_id', testZoneId)
      .eq('level', RuleLevel.LEVEL1);

    // Doit avoir 3 règles au total (2 initiales + 1 nouvelle)
    expect(count).toBe(3);
  });

  it('should maintain rule integrity on duplicate attempts', async () => {
    const originalRule = {
      zone_id: testZoneId,
      level: RuleLevel.LEVEL3,
      field: 'niveaux_max',
      value: 4,
      description: 'Description originale',
      source_id: testSourceId
    };

    // Insérer la règle originale
    await ruleResolver.insertRulesBatch([originalRule]);

    // Tenter d'insérer avec une description différente
    const modifiedRule = {
      ...originalRule,
      description: 'Description modifiée'
    };

    await ruleResolver.insertRulesBatch([modifiedRule]);

    // Vérifier que la règle originale est préservée
    const { data: rule } = await supabase
      .from('rule_definitions')
      .select('*')
      .eq('zone_id', testZoneId)
      .eq('field', 'niveaux_max')
      .eq('level', RuleLevel.LEVEL3)
      .single();

    expect(rule?.description).toBe('Description originale');
    expect(rule?.value_num).toBe(4);
  });

  it('should handle JSON value idempotency', async () => {
    const jsonRule = {
      zone_id: testZoneId,
      level: RuleLevel.LEVEL2,
      field: 'mixite_fonctionnelle',
      value: {
        logement_min: 0.3,
        logement_max: 0.7,
        activites_min: 0.3,
        activites_max: 0.7
      },
      description: 'Mixité complexe',
      source_id: testSourceId
    };

    // Première insertion
    await ruleResolver.insertRulesBatch([jsonRule]);

    // Deuxième insertion
    await ruleResolver.insertRulesBatch([jsonRule]);

    const { count } = await supabase
      .from('rule_definitions')
      .select('*', { count: 'exact', head: true })
      .eq('zone_id', testZoneId)
      .eq('field', 'mixite_fonctionnelle');

    expect(count).toBe(1);
  });
});