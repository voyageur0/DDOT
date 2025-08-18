/**
 * Tests pour le service de labels multilingues
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  getLabel, 
  getLabels, 
  getSeverity, 
  getLabelsByType,
  clearLabelCache,
  formatLabelWithValue 
} from '../../src/i18n/labelService';

describe('Label Service', () => {
  beforeAll(() => {
    // Vider le cache avant les tests
    clearLabelCache();
  });

  describe('getLabel', () => {
    it('should fetch French label by default', async () => {
      const label = await getLabel('R1', 'zone');
      expect(label).toBe('Hab. collectives');
    });

    it('should fetch long version when requested', async () => {
      const label = await getLabel('R1', 'zone', 'fr', true);
      expect(label).toContain('Zone d\'habitations collectives');
    });

    it('should fallback to code if label not found', async () => {
      const label = await getLabel('UNKNOWN_CODE', 'zone');
      expect(label).toBe('UNKNOWN_CODE');
    });

    it('should fetch German label when available', async () => {
      const label = await getLabel('R1', 'zone', 'de');
      // Si pas de traduction allemande, devrait fallback au français
      expect(label).toBeTruthy();
      expect(label).not.toBe('R1'); // Ne devrait pas retourner le code
    });

    it('should fetch English label when available', async () => {
      const label = await getLabel('R1', 'zone', 'en');
      expect(label).toBeTruthy();
      expect(label).not.toBe('R1');
    });

    it('should handle constraint labels', async () => {
      const label = await getLabel('opb_noise_DS_III', 'constraint');
      expect(label).toContain('Bruit');
      expect(label).toContain('DS III');
    });

    it('should handle field labels', async () => {
      const label = await getLabel('indice_u', 'field');
      expect(label).toBe('Indice U');
    });
  });

  describe('getLabels', () => {
    it('should fetch multiple labels in batch', async () => {
      const items = [
        { code: 'R1', type: 'zone' as const },
        { code: 'R2', type: 'zone' as const },
        { code: 'indice_u', type: 'field' as const }
      ];

      const labels = await getLabels(items);
      
      expect(labels).toHaveProperty('R1');
      expect(labels).toHaveProperty('R2');
      expect(labels).toHaveProperty('indice_u');
      expect(labels.R1).toBe('Hab. collectives');
      expect(labels.indice_u).toBe('Indice U');
    });

    it('should use cache for repeated requests', async () => {
      // Premier appel - charge depuis DB
      const label1 = await getLabel('R1', 'zone');
      
      // Deuxième appel - devrait utiliser le cache
      const label2 = await getLabel('R1', 'zone');
      
      expect(label1).toBe(label2);
      expect(label1).toBe('Hab. collectives');
    });

    it('should handle mixed existing and non-existing codes', async () => {
      const items = [
        { code: 'R1', type: 'zone' as const },
        { code: 'FAKE_CODE', type: 'zone' as const }
      ];

      const labels = await getLabels(items);
      
      expect(labels.R1).toBe('Hab. collectives');
      expect(labels.FAKE_CODE).toBe('FAKE_CODE'); // Fallback au code
    });
  });

  describe('getSeverity', () => {
    it('should return severity for constraints', async () => {
      const severity = await getSeverity('opb_noise_DS_III', 'constraint');
      expect(severity).toBe(2); // WARNING
    });

    it('should return 1 as default severity', async () => {
      const severity = await getSeverity('UNKNOWN', 'constraint');
      expect(severity).toBe(1);
    });

    it('should handle critical severity', async () => {
      const severity = await getSeverity('risk_nat_fort', 'constraint');
      expect(severity).toBe(3); // CRITICAL
    });
  });

  describe('getLabelsByType', () => {
    it('should fetch all zone labels', async () => {
      const zones = await getLabelsByType('zone');
      
      expect(Array.isArray(zones)).toBe(true);
      expect(zones.length).toBeGreaterThan(0);
      
      const r1 = zones.find(z => z.code === 'R1');
      expect(r1).toBeDefined();
      expect(r1?.label).toBe('Hab. collectives');
    });

    it('should include severity for constraints', async () => {
      const constraints = await getLabelsByType('constraint');
      
      const noise = constraints.find(c => c.code === 'opb_noise_DS_III');
      expect(noise).toBeDefined();
      expect(noise?.severity).toBe(2);
    });

    it('should handle German language', async () => {
      const zones = await getLabelsByType('zone', 'de');
      
      const r1 = zones.find(z => z.code === 'R1');
      expect(r1).toBeDefined();
      // Vérifier qu'on a une traduction ou un fallback
      expect(r1?.label).toBeTruthy();
      expect(r1?.label).not.toBe('R1');
    });
  });

  describe('formatLabelWithValue', () => {
    it('should format with meters', () => {
      const formatted = formatLabelWithValue('Hauteur max', 12, 'm');
      expect(formatted).toBe('Hauteur max: 12m');
    });

    it('should format with square meters', () => {
      const formatted = formatLabelWithValue('Surface', 150, 'm²');
      expect(formatted).toBe('Surface: 150m²');
    });

    it('should format with percent', () => {
      const formatted = formatLabelWithValue('Emprise', 40, 'percent');
      expect(formatted).toBe('Emprise: 40%');
    });

    it('should handle null values', () => {
      const formatted = formatLabelWithValue('Test', null);
      expect(formatted).toBe('Test');
    });

    it('should handle no unit', () => {
      const formatted = formatLabelWithValue('Niveaux', 3);
      expect(formatted).toBe('Niveaux: 3');
    });
  });

  describe('Cache behavior', () => {
    it('should clear cache when requested', async () => {
      // Charger dans le cache
      await getLabel('R1', 'zone');
      
      // Vider le cache
      clearLabelCache();
      
      // Le prochain appel devrait recharger depuis la DB
      const label = await getLabel('R1', 'zone');
      expect(label).toBe('Hab. collectives');
    });
  });
});