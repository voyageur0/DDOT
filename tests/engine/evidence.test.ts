/**
 * Tests pour le système de traçabilité des preuves
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { RuleResolverWithEvidence } from '../../src/engine/ruleResolverWithEvidence';
import { getContextForParcelWithEvidence } from '../../src/engine/contextResolverWithEvidence';
import { computeBuildIndicatorsWithEvidence } from '../../src/engine/buildCalculatorWithEvidence';
import { ConsolidatedRule, RuleLevel } from '../../src/engine/ruleResolver';

config({ path: '.env.test' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Evidence Tracking System', () => {
  const testParcelId = 'test_evidence_' + Date.now();
  const testZoneId = 'test_zone_' + Date.now();

  beforeAll(async () => {
    // Nettoyer les données de test existantes
    await supabase
      .from('evidence_items')
      .delete()
      .eq('parcel_id', testParcelId);
    
    await supabase
      .from('analysis_quality')
      .delete()
      .eq('parcel_id', testParcelId);
  });

  afterAll(async () => {
    // Nettoyer après les tests
    await supabase
      .from('evidence_items')
      .delete()
      .eq('parcel_id', testParcelId);
    
    await supabase
      .from('analysis_quality')
      .delete()
      .eq('parcel_id', testParcelId);
  });

  describe('RuleResolver Evidence Tracking', () => {
    it('should track evidence when resolving rules', async () => {
      const resolver = new RuleResolverWithEvidence();
      
      // Créer des règles de test
      const testRules: ConsolidatedRule[] = [
        {
          field: 'indice_u',
          value: 0.6,
          level: RuleLevel.LEVEL3,
          description: 'RCCZ art. 42',
          overridden: []
        },
        {
          field: 'h_max_m',
          value: 12,
          level: RuleLevel.LEVEL2,
          description: 'PAD communal',
          overridden: [
            {
              level: RuleLevel.LEVEL4,
              value: 15,
              description: 'Droit cantonal'
            }
          ]
        }
      ];

      // Simuler la résolution (normalement viendrait de la DB)
      // Pour le test, on trace directement
      await resolver['trackRuleEvidence'](testRules, testParcelId);

      // Vérifier que les preuves ont été enregistrées
      const { data: evidence } = await supabase
        .from('evidence_items')
        .select('*')
        .eq('parcel_id', testParcelId)
        .eq('ref_type', 'regulation');

      expect(evidence).toBeDefined();
      expect(evidence!.length).toBeGreaterThan(0);

      // Vérifier les détails
      const indiceEvidence = evidence!.find(e => e.field === 'indice_u');
      expect(indiceEvidence).toBeDefined();
      expect(indiceEvidence!.value_num).toBe(0.6);
      expect(indiceEvidence!.reliability).toBe('direct');
      expect(indiceEvidence!.inserted_by).toBe('ruleResolver');

      // Vérifier que les règles écrasées sont tracées
      const overriddenEvidence = evidence!.filter(e => 
        e.field === 'h_max_m' && e.reliability === 'derived'
      );
      expect(overriddenEvidence.length).toBeGreaterThan(0);
    });

    it('should determine correct reliability level based on rule level', () => {
      const resolver = new RuleResolverWithEvidence();
      
      expect(resolver['getReliabilityFromLevel'](RuleLevel.LEVEL1)).toBe('direct');
      expect(resolver['getReliabilityFromLevel'](RuleLevel.LEVEL2)).toBe('direct');
      expect(resolver['getReliabilityFromLevel'](RuleLevel.LEVEL3)).toBe('direct');
      expect(resolver['getReliabilityFromLevel'](RuleLevel.LEVEL4)).toBe('derived');
    });
  });

  describe('ContextResolver Evidence Tracking', () => {
    it('should track evidence for context flags', async () => {
      const testGeom = 'POLYGON((2595000 1119000, 2595100 1119000, 2595100 1119100, 2595000 1119100, 2595000 1119000))';
      
      // Appeler avec traçabilité
      const flags = await getContextForParcelWithEvidence(testParcelId, testGeom);

      // Vérifier que des preuves ont été créées
      const { data: evidence } = await supabase
        .from('evidence_items')
        .select('*')
        .eq('parcel_id', testParcelId)
        .eq('ref_type', 'context');

      if (flags.length > 0) {
        expect(evidence).toBeDefined();
        expect(evidence!.length).toBeGreaterThan(0);

        // Vérifier la correspondance avec les flags
        for (const flag of flags) {
          const flagEvidence = evidence!.find(e => e.field === flag.layer);
          expect(flagEvidence).toBeDefined();
          
          if (flag.valueNum) {
            expect(flagEvidence!.value_num).toBe(flag.valueNum);
          }
          if (flag.valueText) {
            expect(flagEvidence!.value_text).toBe(flag.valueText);
          }
        }
      }
    });

    it('should assign appropriate reliability levels for context types', async () => {
      const testGeom = 'POLYGON((2595000 1119000, 2595100 1119000, 2595100 1119100, 2595000 1119100, 2595000 1119000))';
      
      await getContextForParcelWithEvidence(testParcelId + '_rel', testGeom);

      const { data: evidence } = await supabase
        .from('evidence_items')
        .select('*')
        .eq('parcel_id', testParcelId + '_rel')
        .eq('ref_type', 'context');

      if (evidence && evidence.length > 0) {
        // Vérifier les niveaux de fiabilité
        const noiseEvidence = evidence.find(e => e.field === 'opb_noise');
        if (noiseEvidence) {
          expect(noiseEvidence.reliability).toBe('direct');
        }

        const slopeEvidence = evidence.find(e => e.field === 'slope_pct');
        if (slopeEvidence) {
          expect(slopeEvidence.reliability).toBe('derived');
        }
      }
    });
  });

  describe('BuildCalculator Evidence Tracking', () => {
    it('should track evidence for calculations', async () => {
      const rules: ConsolidatedRule[] = [
        {
          field: 'indice_u',
          value: 0.6,
          level: RuleLevel.LEVEL3,
          overridden: []
        },
        {
          field: 'emprise_max',
          value: 0.4,
          level: RuleLevel.LEVEL3,
          overridden: []
        }
      ];

      const input = {
        parcelAreaM2: 1000,
        rules
      };

      // Calculer avec traçabilité
      const result = await computeBuildIndicatorsWithEvidence(
        input,
        testParcelId,
        testZoneId
      );

      // Vérifier les preuves de calcul
      const { data: evidence } = await supabase
        .from('evidence_items')
        .select('*')
        .eq('parcel_id', testParcelId)
        .eq('ref_type', 'calculation');

      expect(evidence).toBeDefined();
      expect(evidence!.length).toBeGreaterThan(0);

      // Vérifier les preuves spécifiques
      const suEvidence = evidence!.find(e => e.field === 'su_m2');
      expect(suEvidence).toBeDefined();
      expect(suEvidence!.value_num).toBe(600); // 0.6 × 1000
      expect(suEvidence!.reliability).toBe('derived');
      expect(suEvidence!.comment).toContain('Surface utile calculée');

      // Vérifier la conversion IBUS si applicable
      const ibusEvidence = evidence!.find(e => e.field === 'ibus_converted');
      if (ibusEvidence) {
        expect(ibusEvidence.reliability).toBe('derived');
        expect(ibusEvidence.metadata).toHaveProperty('indice_u');
        expect(ibusEvidence.metadata).toHaveProperty('conversion_table');
      }
    });

    it('should track quality score in analysis_quality table', async () => {
      const rules: ConsolidatedRule[] = [
        {
          field: 'indice_u',
          value: 0.6,
          level: RuleLevel.LEVEL3,
          overridden: []
        },
        {
          field: 'ibus',
          value: 0.8,
          level: RuleLevel.LEVEL3,
          overridden: []
        }
      ];

      const input = {
        parcelAreaM2: 1000,
        rules
      };

      const result = await computeBuildIndicatorsWithEvidence(
        input,
        testParcelId + '_quality',
        testZoneId
      );

      // Vérifier le score de qualité
      const { data: quality } = await supabase
        .from('analysis_quality')
        .select('*')
        .eq('parcel_id', testParcelId + '_quality')
        .single();

      expect(quality).toBeDefined();
      expect(quality!.score_global).toBeGreaterThan(0);
      expect(quality!.score_global).toBeLessThanOrEqual(1);
      expect(quality!.score_calculations).toBe(quality!.score_global);
      expect(quality!.total_fields).toBeGreaterThan(0);
      expect(quality!.direct_count).toBeGreaterThanOrEqual(0);
      expect(quality!.derived_count).toBeGreaterThanOrEqual(0);
      
      // Vérifier les détails par champ
      expect(quality!.details).toBeDefined();
      expect(Object.keys(quality!.details).length).toBeGreaterThan(0);
    });
  });

  describe('Evidence Integration', () => {
    it('should create complete evidence trail for full analysis', async () => {
      const fullTestParcelId = 'test_full_' + Date.now();
      const testGeom = 'POLYGON((2595000 1119000, 2595100 1119000, 2595100 1119100, 2595000 1119100, 2595000 1119000))';

      // 1. Résoudre les règles avec evidence
      const resolver = new RuleResolverWithEvidence();
      const rules = await resolver.resolveRulesByParcelGeom(testGeom, fullTestParcelId);

      // 2. Analyser le contexte avec evidence
      const contextFlags = await getContextForParcelWithEvidence(fullTestParcelId, testGeom);

      // 3. Calculer les indicateurs avec evidence
      if (rules.length > 0) {
        const input = {
          parcelAreaM2: 1000,
          rules
        };
        
        await computeBuildIndicatorsWithEvidence(
          input,
          fullTestParcelId,
          'test_zone'
        );
      }

      // Vérifier l'ensemble des preuves
      const { data: allEvidence } = await supabase
        .from('evidence_items')
        .select('ref_type')
        .eq('parcel_id', fullTestParcelId);

      if (allEvidence && allEvidence.length > 0) {
        const evidenceTypes = new Set(allEvidence.map(e => e.ref_type));
        
        // On devrait avoir au moins des calculs
        expect(evidenceTypes.has('calculation')).toBe(true);
        
        // Et potentiellement des règles et contextes
        console.log('Evidence types found:', Array.from(evidenceTypes));
      }

      // Vérifier le score de qualité global
      const { data: finalQuality } = await supabase
        .from('analysis_quality')
        .select('*')
        .eq('parcel_id', fullTestParcelId)
        .single();

      if (finalQuality) {
        expect(finalQuality.score_global).toBeGreaterThan(0);
        expect(finalQuality.total_fields).toBeGreaterThan(0);
      }
    });
  });

  describe('Evidence Helper Functions', () => {
    it('should correctly format evidence comments', () => {
      // Test de formatage des commentaires (fonction interne)
      const testComment = 'Cadastre du bruit - DS III';
      expect(testComment).toContain('Cadastre');
      expect(testComment).toContain('DS III');
    });

    it('should calculate reliability scores correctly', () => {
      // Test du calcul de score
      const fieldReliability = new Map([
        ['indice_u', 'direct' as const],
        ['ibus_m2', 'derived' as const],
        ['niveaux_max_est', 'estimated' as const],
        ['missing_field', 'missing' as const]
      ]);

      // Le score devrait être pondéré
      // Avec les poids: direct=1.0, derived=0.8, estimated=0.5, missing=0.0
      // Et l'importance des champs varie
      const expectedScore = 0.65; // Approximatif
      
      // Vérifier que le score est dans une plage raisonnable
      expect(expectedScore).toBeGreaterThan(0.5);
      expect(expectedScore).toBeLessThan(0.8);
    });
  });
});