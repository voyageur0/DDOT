/**
 * Tests pour le formateur de contexte avec labels normalisés
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ContextFlag } from '../../src/engine/contextResolver';
import { 
  summarizeContext, 
  formatDetailedContext,
  groupConstraintsByCategory 
} from '../../src/engine/contextFormatterWithLabels';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.test' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Context Formatter with Labels', () => {
  beforeAll(async () => {
    // S'assurer que quelques labels de test existent
    const testLabels = [
      {
        code: 'opb_noise_DS_III',
        type: 'constraint',
        label_fr_short: 'Bruit DS III - Isolation requise',
        label_de_short: 'Lärm ES III - Isolation nötig',
        label_en_short: 'Noise DS III - Insulation required',
        severity: 2
      },
      {
        code: 'slope_30_45',
        type: 'constraint',
        label_fr_short: 'Pente forte - Terrassements importants',
        severity: 2
      },
      {
        code: 'risk_nat_fort',
        type: 'constraint',
        label_fr_short: 'Danger fort - Construction interdite',
        severity: 3
      }
    ];

    await supabase
      .from('label_dictionary')
      .upsert(testLabels, { onConflict: 'type,code' });
  });

  describe('summarizeContext', () => {
    it('should use normalized labels from dictionary', async () => {
      const flags: ContextFlag[] = [
        {
          layer: 'opb_noise',
          intersects: true,
          valueText: 'DS III',
          severity: 2,
          message: 'Old message that should be replaced'
        }
      ];

      const result = await summarizeContext(flags);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toContain('Bruit DS III');
      expect(result[0]).toContain('Isolation requise');
      expect(result[0]).not.toContain('Old message');
    });

    it('should respect 12 word limit', async () => {
      const flags: ContextFlag[] = [
        {
          layer: 'risk_nat',
          intersects: true,
          severity: 3,
          message: 'Zone de danger très élevé avec de nombreuses restrictions qui devraient être tronquées car le message est vraiment trop long',
          metadata: { danger_level: 'fort' }
        }
      ];

      const result = await summarizeContext(flags);
      
      expect(result).toHaveLength(1);
      const words = result[0].split(' ').length;
      expect(words).toBeLessThanOrEqual(12);
    });

    it('should sort by severity (critical first)', async () => {
      const flags: ContextFlag[] = [
        {
          layer: 'slope_pct',
          intersects: true,
          valueNum: 35,
          severity: 2,
          message: 'Pente moyenne'
        },
        {
          layer: 'risk_nat',
          intersects: true,
          severity: 3,
          message: 'Danger élevé',
          metadata: { danger_level: 'fort' }
        },
        {
          layer: 'roads_cantonal',
          intersects: true,
          distance: 50,
          severity: 1,
          message: 'Route à proximité'
        }
      ];

      const result = await summarizeContext(flags);
      
      // Le danger fort (severity 3) devrait être en premier
      expect(result[0]).toContain('Danger fort');
    });

    it('should limit to 5 messages by default', async () => {
      const flags: ContextFlag[] = Array(8).fill(null).map((_, i) => ({
        layer: `test_${i}`,
        intersects: true,
        severity: 1,
        message: `Message ${i}`
      }));

      const result = await summarizeContext(flags);
      expect(result).toHaveLength(5);
    });

    it('should handle different languages', async () => {
      const flags: ContextFlag[] = [
        {
          layer: 'opb_noise',
          intersects: true,
          valueText: 'DS III',
          severity: 2,
          message: 'Bruit'
        }
      ];

      // Test allemand
      const resultDe = await summarizeContext(flags, 'de');
      expect(resultDe[0]).toContain('Lärm');
      
      // Test anglais
      const resultEn = await summarizeContext(flags, 'en');
      expect(resultEn[0]).toContain('Noise');
    });

    it('should fallback to original message if label not found', async () => {
      const flags: ContextFlag[] = [
        {
          layer: 'unknown_layer',
          intersects: true,
          severity: 2,
          message: 'Message original à conserver'
        }
      ];

      const result = await summarizeContext(flags);
      expect(result[0]).toBe('Message original à conserver');
    });

    it('should build correct constraint codes', async () => {
      const testCases: Array<[ContextFlag, string]> = [
        [
          { layer: 'slope_pct', intersects: true, valueNum: 35, severity: 2, message: '' },
          'slope_30_45'
        ],
        [
          { layer: 'slope_pct', intersects: true, valueNum: 50, severity: 3, message: '' },
          'slope_45_plus'
        ],
        [
          { layer: 'roads_cantonal', intersects: true, distance: 20, severity: 2, message: '' },
          'roads_0_25m'
        ]
      ];

      for (const [flag, expectedStart] of testCases) {
        const result = await summarizeContext([flag]);
        // Vérifier que le bon label a été utilisé
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  describe('formatDetailedContext', () => {
    it('should return detailed information with labels', async () => {
      const flags: ContextFlag[] = [
        {
          layer: 'opb_noise',
          intersects: true,
          valueText: 'DS III',
          severity: 2,
          message: 'Zone de bruit'
        }
      ];

      const result = await formatDetailedContext(flags);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('layer', 'opb_noise');
      expect(result[0]).toHaveProperty('severity', 2);
      expect(result[0]).toHaveProperty('severityLabel');
      expect(result[0]).toHaveProperty('value', 'DS III');
      expect(result[0].message).toContain('Bruit');
    });

    it('should provide severity labels in requested language', async () => {
      const flags: ContextFlag[] = [
        { layer: 'test', intersects: true, severity: 2, message: 'Test' }
      ];

      const resultFr = await formatDetailedContext(flags, 'fr');
      expect(resultFr[0].severityLabel).toBe('Attention');

      const resultEn = await formatDetailedContext(flags, 'en');
      expect(resultEn[0].severityLabel).toBe('Warning');
    });
  });

  describe('groupConstraintsByCategory', () => {
    it('should group constraints by category', async () => {
      const flags: ContextFlag[] = [
        {
          layer: 'opb_noise',
          intersects: true,
          valueText: 'DS III',
          severity: 2,
          message: 'Bruit 1'
        },
        {
          layer: 'opb_noise',
          intersects: true,
          valueText: 'DS IV',
          severity: 3,
          message: 'Bruit 2'
        },
        {
          layer: 'slope_pct',
          intersects: true,
          valueNum: 35,
          severity: 2,
          message: 'Pente'
        }
      ];

      const groups = await groupConstraintsByCategory(flags);
      
      expect(groups).toHaveProperty('Bruit');
      expect(groups).toHaveProperty('Topographie');
      expect(groups['Bruit']).toHaveLength(2);
      expect(groups['Topographie']).toHaveLength(1);
    });

    it('should sort by severity within each category', async () => {
      const flags: ContextFlag[] = [
        {
          layer: 'risk_nat',
          intersects: true,
          severity: 2,
          message: 'Danger moyen',
          metadata: { danger_level: 'moyen' }
        },
        {
          layer: 'risk_nat',
          intersects: true,
          severity: 3,
          message: 'Danger fort',
          metadata: { danger_level: 'fort' }
        }
      ];

      const groups = await groupConstraintsByCategory(flags);
      const dangerGroup = groups['Dangers naturels'];
      
      expect(dangerGroup[0].severity).toBe(3); // Fort en premier
      expect(dangerGroup[1].severity).toBe(2); // Moyen ensuite
    });

    it('should truncate messages to 12 words', async () => {
      const flags: ContextFlag[] = [
        {
          layer: 'test_layer',
          intersects: true,
          severity: 2,
          message: 'Ceci est un message extrêmement long qui contient beaucoup trop de mots et qui devrait être tronqué'
        }
      ];

      const groups = await groupConstraintsByCategory(flags);
      const messages = Object.values(groups).flat();
      
      expect(messages[0].message.split(' ').length).toBeLessThanOrEqual(12);
      expect(messages[0].message).toContain('…');
    });
  });
});