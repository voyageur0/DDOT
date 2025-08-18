/**
 * Tests pour l'utilitaire de résumé et troncature
 */

import { describe, it, expect } from 'vitest';
import {
  truncateSentence,
  summarizeMessages,
  extractKeywords,
  formatConstraintMessage,
  groupSimilarMessages,
  analyzeMessageLengths
} from '../../src/i18n/summarizer';

describe('Summarizer Utilities', () => {
  describe('truncateSentence', () => {
    it('should not truncate sentences within limit', () => {
      const short = 'Ceci est un court message';
      expect(truncateSentence(short, 12)).toBe(short);
    });

    it('should truncate long sentences to 12 words by default', () => {
      const long = 'Ceci est un très long message qui dépasse largement la limite de douze mots imposée par le système';
      const result = truncateSentence(long);
      expect(result.split(' ').length).toBeLessThanOrEqual(12);
      expect(result).toContain('…');
    });

    it('should respect custom word limit', () => {
      const text = 'Un deux trois quatre cinq six sept huit neuf dix onze douze treize';
      const result = truncateSentence(text, 5);
      expect(result).toBe('Un deux trois quatre cinq…');
    });

    it('should handle trailing punctuation', () => {
      const text = 'Un message qui se termine par une virgule, et qui continue encore longtemps après';
      const result = truncateSentence(text, 8);
      expect(result).not.toContain(',…');
      expect(result).toContain('…');
    });

    it('should handle empty string', () => {
      expect(truncateSentence('')).toBe('');
    });

    it('should handle extra whitespace', () => {
      const text = '  Texte   avec    espaces    multiples   ';
      const result = truncateSentence(text, 3);
      expect(result).toBe('Texte avec espaces…');
    });
  });

  describe('summarizeMessages', () => {
    it('should prioritize high priority messages', () => {
      const messages = [
        { text: 'Message basse priorité', priority: 1 },
        { text: 'Message haute priorité', priority: 3 },
        { text: 'Message moyenne priorité', priority: 2 }
      ];

      const result = summarizeMessages(messages, 2);
      expect(result[0]).toContain('haute priorité');
      expect(result[1]).toContain('moyenne priorité');
      expect(result).toHaveLength(2);
    });

    it('should truncate each message to word limit', () => {
      const messages = [
        { text: 'Ceci est un message extrêmement long qui doit absolument être tronqué pour respecter la limite', priority: 1 }
      ];

      const result = summarizeMessages(messages, 5, 6);
      expect(result[0].split(' ').length).toBeLessThanOrEqual(6);
    });

    it('should handle empty message array', () => {
      expect(summarizeMessages([])).toEqual([]);
    });

    it('should handle messages without priority', () => {
      const messages = [
        { text: 'Message sans priorité' },
        { text: 'Autre message', priority: 2 }
      ];

      const result = summarizeMessages(messages);
      expect(result[0]).toContain('Autre message'); // Priorité 2 avant 0
    });
  });

  describe('extractKeywords', () => {
    it('should extract significant words', () => {
      const text = 'La zone de construction est limitée par les règles';
      const keywords = extractKeywords(text);
      
      expect(keywords).not.toContain('la');
      expect(keywords).not.toContain('de');
      expect(keywords).not.toContain('les');
      expect(keywords).toContain('zone');
    });

    it('should capitalize first word', () => {
      const text = 'construction limitée hauteur maximale';
      const keywords = extractKeywords(text, 3);
      
      expect(keywords.startsWith('Construction')).toBe(true);
    });

    it('should respect word limit', () => {
      const text = 'beaucoup trop mots importants différents variés nombreux';
      const keywords = extractKeywords(text, 3);
      
      expect(keywords.split(' ').length).toBe(3);
    });

    it('should filter short words', () => {
      const text = 'a b c construction de la zone';
      const keywords = extractKeywords(text);
      
      expect(keywords).not.toContain('a');
      expect(keywords).not.toContain('b');
      expect(keywords).toContain('construction');
    });
  });

  describe('formatConstraintMessage', () => {
    it('should combine label and detail within limit', () => {
      const label = 'Zone bruit';
      const detail = 'isolation requise';
      const result = formatConstraintMessage(label, detail);
      
      expect(result).toBe('Zone bruit - isolation requise');
    });

    it('should prioritize label when too long', () => {
      const label = 'Zone de bruit très importante';
      const detail = 'nécessite une isolation acoustique renforcée pour tous les bâtiments';
      const result = formatConstraintMessage(label, detail, 8);
      
      expect(result).toContain('Zone de bruit');
      expect(result.split(' ').length).toBeLessThanOrEqual(8);
    });

    it('should handle missing detail', () => {
      const label = 'Zone de protection';
      const result = formatConstraintMessage(label);
      
      expect(result).toBe(label);
    });

    it('should truncate very long labels', () => {
      const label = 'Zone de protection du patrimoine architectural et paysager avec restrictions importantes';
      const result = formatConstraintMessage(label, undefined, 6);
      
      expect(result.split(' ').length).toBeLessThanOrEqual(6);
      expect(result).toContain('…');
    });
  });

  describe('groupSimilarMessages', () => {
    it('should group similar messages', () => {
      const messages = [
        'Zone de bruit niveau 3',
        'Zone de bruit niveau 4',
        'Pente forte 35%',
        'Zone de bruit niveau 2'
      ];

      const result = groupSimilarMessages(messages, 0.5);
      
      // Les messages de bruit devraient être groupés
      expect(result.length).toBeLessThan(messages.length);
      expect(result.some(m => m.includes('×'))).toBe(true);
    });

    it('should not group dissimilar messages', () => {
      const messages = [
        'Zone de bruit',
        'Pente forte',
        'Route proche',
        'Danger avalanche'
      ];

      const result = groupSimilarMessages(messages, 0.8);
      expect(result.length).toBe(messages.length);
    });

    it('should handle single message', () => {
      const messages = ['Seul message'];
      const result = groupSimilarMessages(messages);
      expect(result).toEqual(messages);
    });

    it('should show count for large groups', () => {
      const messages = [
        'Danger naturel zone rouge',
        'Danger naturel zone orange',
        'Danger naturel zone jaune',
        'Autre contrainte'
      ];

      const result = groupSimilarMessages(messages, 0.4);
      const grouped = result.find(m => m.includes('×'));
      
      if (grouped) {
        expect(grouped).toMatch(/×\d/);
      }
    });
  });

  describe('analyzeMessageLengths', () => {
    it('should calculate statistics correctly', () => {
      const messages = [
        'Court message',           // 2 mots
        'Un message moyen ici',    // 4 mots
        'Un très long message avec beaucoup de mots' // 9 mots
      ];

      const stats = analyzeMessageLengths(messages);
      
      expect(stats.total).toBe(3);
      expect(stats.avgWords).toBe(5); // (2+4+9)/3
      expect(stats.maxWords).toBe(9);
      expect(stats.tooLong).toHaveLength(0); // Aucun > 12 mots
    });

    it('should identify messages over 12 words', () => {
      const messages = [
        'Un message court',
        'Ceci est un message extrêmement long qui contient vraiment beaucoup trop de mots pour être affiché'
      ];

      const stats = analyzeMessageLengths(messages);
      
      expect(stats.tooLong).toHaveLength(1);
      expect(stats.tooLong[0]).toContain('extrêmement long');
    });

    it('should handle empty array', () => {
      const stats = analyzeMessageLengths([]);
      
      expect(stats.total).toBe(0);
      expect(stats.avgWords).toBe(0);
      expect(stats.maxWords).toBe(0);
      expect(stats.tooLong).toEqual([]);
    });
  });
});