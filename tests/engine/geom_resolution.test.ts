/**
 * Tests unitaires pour la résolution spatiale du moteur de règles
 * Vérifie la résolution pour les parcelles chevauchant plusieurs zones
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

describe('Spatial Rule Resolution', () => {
  const ruleResolver = new RuleResolver();
  let testZoneId1: string;
  let testZoneId2: string;
  let testSourceId: string;

  beforeAll(async () => {
    // Créer deux zones adjacentes
    const { data: zone1, error: zone1Error } = await supabase
      .from('zones')
      .insert({
        commune_id: '00000000-0000-0000-0000-000000000000',
        code_source: 'TEST_GEOM_1',
        code_norm: 'TEST_GEOM_1',
        nom_zone: 'Zone Test Géom 1',
        // Polygon couvrant une partie ouest
        geom: {
          type: 'Polygon',
          coordinates: [[
            [2600000, 1120000],
            [2600100, 1120000],
            [2600100, 1120100],
            [2600000, 1120100],
            [2600000, 1120000]
          ]]
        }
      })
      .select('id')
      .single();

    if (zone1Error) throw zone1Error;
    testZoneId1 = zone1.id;

    const { data: zone2, error: zone2Error } = await supabase
      .from('zones')
      .insert({
        commune_id: '00000000-0000-0000-0000-000000000000',
        code_source: 'TEST_GEOM_2',
        code_norm: 'TEST_GEOM_2',
        nom_zone: 'Zone Test Géom 2',
        // Polygon couvrant une partie est
        geom: {
          type: 'Polygon',
          coordinates: [[
            [2600100, 1120000],
            [2600200, 1120000],
            [2600200, 1120100],
            [2600100, 1120100],
            [2600100, 1120000]
          ]]
        }
      })
      .select('id')
      .single();

    if (zone2Error) throw zone2Error;
    testZoneId2 = zone2.id;

    // Créer une source
    const { data: source } = await supabase
      .from('regulation_sources')
      .insert({
        pdf_path: 'test/geom_test.pdf',
        article_ref: 'TEST_GEOM',
        ocr_confidence: 1.0
      })
      .select('id')
      .single();

    testSourceId = source!.id;

    // Insérer des règles différentes pour chaque zone
    const rules = [
      // Zone 1 - Plus restrictive
      {
        zone_id: testZoneId1,
        level: RuleLevel.LEVEL3,
        field: 'h_max_m',
        value: 10,
        description: 'Hauteur max zone 1',
        source_id: testSourceId
      },
      {
        zone_id: testZoneId1,
        level: RuleLevel.LEVEL3,
        field: 'indice_u',
        value: 0.4,
        description: 'Indice U zone 1',
        source_id: testSourceId
      },
      // Zone 2 - Moins restrictive
      {
        zone_id: testZoneId2,
        level: RuleLevel.LEVEL3,
        field: 'h_max_m',
        value: 15,
        description: 'Hauteur max zone 2',
        source_id: testSourceId
      },
      {
        zone_id: testZoneId2,
        level: RuleLevel.LEVEL3,
        field: 'indice_u',
        value: 0.6,
        description: 'Indice U zone 2',
        source_id: testSourceId
      }
    ];

    await ruleResolver.insertRulesBatch(rules);
  });

  afterAll(async () => {
    // Nettoyer
    await supabase
      .from('rule_definitions')
      .delete()
      .in('zone_id', [testZoneId1, testZoneId2]);

    await supabase
      .from('zones')
      .delete()
      .in('id', [testZoneId1, testZoneId2]);

    await supabase
      .from('regulation_sources')
      .delete()
      .eq('id', testSourceId);
  });

  it('should resolve rules for parcel spanning multiple zones', async () => {
    // Parcelle chevauchant les deux zones
    const parcelWKT = 'POLYGON((2600050 1120025, 2600150 1120025, 2600150 1120075, 2600050 1120075, 2600050 1120025))';
    
    const consolidated = await ruleResolver.resolveRulesByParcelGeom(parcelWKT);

    // Devrait avoir des règles des deux zones
    const heightRules = consolidated.filter(r => r.field === 'h_max_m');
    const indiceRules = consolidated.filter(r => r.field === 'indice_u');

    expect(heightRules).toHaveLength(2);
    expect(indiceRules).toHaveLength(2);

    // Vérifier que les deux valeurs sont présentes
    const heightValues = heightRules.map(r => r.value as number);
    expect(heightValues).toContain(10);
    expect(heightValues).toContain(15);
  });

  it('should include zone metadata in consolidated rules', async () => {
    const parcelWKT = 'POLYGON((2600050 1120025, 2600150 1120025, 2600150 1120075, 2600050 1120075, 2600050 1120025))';
    
    const consolidated = await ruleResolver.resolveRulesByParcelGeom(parcelWKT);

    // Vérifier que chaque règle a les métadonnées de zone
    for (const rule of consolidated) {
      expect(rule.zone_id).toBeDefined();
      expect(rule.zone_code).toBeDefined();
      expect(rule.zone_code).toMatch(/TEST_GEOM_[12]/);
    }
  });

  it('should handle parcel in single zone correctly', async () => {
    // Parcelle uniquement dans la zone 1
    const parcelWKT = 'POLYGON((2600025 1120025, 2600075 1120025, 2600075 1120075, 2600025 1120075, 2600025 1120025))';
    
    const consolidated = await ruleResolver.resolveRulesByParcelGeom(parcelWKT);

    // Ne devrait avoir que les règles de la zone 1
    expect(consolidated).toHaveLength(2);
    expect(consolidated.every(r => r.zone_code === 'TEST_GEOM_1')).toBe(true);
    
    const heightRule = consolidated.find(r => r.field === 'h_max_m');
    expect(heightRule?.value).toBe(10);
  });

  it('should return empty array for parcel outside all zones', async () => {
    // Parcelle en dehors des zones définies
    const parcelWKT = 'POLYGON((2599000 1119000, 2599100 1119000, 2599100 1119100, 2599000 1119100, 2599000 1119000))';
    
    const consolidated = await ruleResolver.resolveRulesByParcelGeom(parcelWKT);

    expect(consolidated).toHaveLength(0);
  });

  it('should handle complex multi-polygon parcels', async () => {
    // Parcelle avec plusieurs polygones
    const parcelWKT = 'MULTIPOLYGON(((' +
      '2600025 1120025, 2600075 1120025, 2600075 1120075, 2600025 1120075, 2600025 1120025' +
      ')), ((' +
      '2600125 1120025, 2600175 1120025, 2600175 1120075, 2600125 1120075, 2600125 1120025' +
      ')))';
    
    const consolidated = await ruleResolver.resolveRulesByParcelGeom(parcelWKT);

    // Devrait avoir des règles des deux zones
    const zones = [...new Set(consolidated.map(r => r.zone_code))];
    expect(zones).toHaveLength(2);
    expect(zones).toContain('TEST_GEOM_1');
    expect(zones).toContain('TEST_GEOM_2');
  });

  it('should prioritize rules correctly for multi-zone parcels', async () => {
    // Ajouter une servitude LEVEL1 sur la zone 1
    await ruleResolver.insertRulesBatch([{
      zone_id: testZoneId1,
      level: RuleLevel.LEVEL1,
      field: 'h_max_m',
      value: 8,
      description: 'Servitude hauteur zone 1',
      source_id: testSourceId
    }]);

    // Parcelle chevauchant les deux zones
    const parcelWKT = 'POLYGON((2600050 1120025, 2600150 1120025, 2600150 1120075, 2600050 1120075, 2600050 1120025))';
    
    const consolidated = await ruleResolver.resolveRulesByParcelGeom(parcelWKT);

    // Pour la zone 1, la servitude LEVEL1 doit prévaloir
    const zone1HeightRule = consolidated.find(r => 
      r.field === 'h_max_m' && r.zone_code === 'TEST_GEOM_1'
    );
    expect(zone1HeightRule?.value).toBe(8);
    expect(zone1HeightRule?.level).toBe(RuleLevel.LEVEL1);

    // Pour la zone 2, la règle LEVEL3 reste active
    const zone2HeightRule = consolidated.find(r => 
      r.field === 'h_max_m' && r.zone_code === 'TEST_GEOM_2'
    );
    expect(zone2HeightRule?.value).toBe(15);
    expect(zone2HeightRule?.level).toBe(RuleLevel.LEVEL3);
  });
});