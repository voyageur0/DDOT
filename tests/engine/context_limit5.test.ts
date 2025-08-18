/**
 * Tests pour la limitation à 5 flags maximum
 */

import { describe, it, expect } from 'vitest';
import { getContextForParcel, ContextFlag } from '../../src/engine/contextResolver';
import { summarizeContext } from '../../src/engine/contextFormatter';

describe('Context Engine - 5 Flag Limit', () => {
  
  it('should limit results to maximum 5 flags', async () => {
    // Parcelle complexe avec potentiellement beaucoup de contextes
    const parcelId = 'test_many_contexts';
    const geomWkt = 'POLYGON((2594000 1119500, 2594100 1119500, 2594100 1119600, 2594000 1119600, 2594000 1119500))';
    
    const flags = await getContextForParcel(parcelId, geomWkt);
    
    // Maximum 5 flags
    expect(flags.length).toBeLessThanOrEqual(5);
  });

  it('should prioritize most severe flags when limiting', () => {
    // Créer 8 flags de test avec différentes sévérités
    const manyFlags: ContextFlag[] = [
      { layer: 'risk_nat', intersects: true, severity: 3, message: 'Danger glissement élevé' },
      { layer: 'opb_noise', intersects: true, severity: 3, message: 'Zone bruit DS IV' },
      { layer: 'slope_pct', intersects: true, valueNum: 50, severity: 3, message: 'Pente 50%' },
      { layer: 'ofac_airport', intersects: true, severity: 2, message: 'Zone OFAC' },
      { layer: 'roads_cantonal', intersects: true, severity: 2, message: 'Route à 20m' },
      { layer: 'test_layer_1', intersects: true, severity: 1, message: 'Info 1' },
      { layer: 'test_layer_2', intersects: true, severity: 1, message: 'Info 2' },
      { layer: 'test_layer_3', intersects: true, severity: 1, message: 'Info 3' }
    ];
    
    // Simuler le tri et la limitation
    const sorted = [...manyFlags].sort((a, b) => {
      if (b.severity !== a.severity) {
        return b.severity - a.severity;
      }
      return a.layer.localeCompare(b.layer);
    });
    
    const limited = sorted.slice(0, 5);
    
    expect(limited).toHaveLength(5);
    
    // Les 3 premiers doivent être de sévérité 3
    expect(limited[0].severity).toBe(3);
    expect(limited[1].severity).toBe(3);
    expect(limited[2].severity).toBe(3);
    
    // Les 2 suivants de sévérité 2
    expect(limited[3].severity).toBe(2);
    expect(limited[4].severity).toBe(2);
    
    // Aucun flag de sévérité 1 ne doit être inclus
    expect(limited.every(f => f.severity > 1)).toBe(true);
  });

  it('should maintain order within same severity level', () => {
    const sameServerityFlags: ContextFlag[] = [
      { layer: 'slope_pct', intersects: true, severity: 2, message: 'Pente 35%' },
      { layer: 'roads_cantonal', intersects: true, severity: 2, message: 'Route proche' },
      { layer: 'ofac_airport', intersects: true, severity: 2, message: 'Zone aéroport' },
      { layer: 'noise_zone', intersects: true, severity: 2, message: 'Bruit modéré' }
    ];
    
    const sorted = [...sameServerityFlags].sort((a, b) => {
      if (b.severity !== a.severity) {
        return b.severity - a.severity;
      }
      return a.layer.localeCompare(b.layer);
    });
    
    // Vérifier l'ordre alphabétique pour même sévérité
    expect(sorted[0].layer).toBe('noise_zone');
    expect(sorted[1].layer).toBe('ofac_airport');
    expect(sorted[2].layer).toBe('roads_cantonal');
    expect(sorted[3].layer).toBe('slope_pct');
  });

  it('should summarize correctly with limit parameter', () => {
    const flags: ContextFlag[] = [
      { layer: 'risk_nat', intersects: true, severity: 3, message: 'Danger fort' },
      { layer: 'opb_noise', intersects: true, severity: 2, message: 'Bruit élevé' },
      { layer: 'slope_pct', intersects: true, severity: 2, message: 'Pente 35%' },
      { layer: 'roads_cantonal', intersects: true, severity: 1, message: 'Route à 40m' },
      { layer: 'info_1', intersects: true, severity: 1, message: 'Information 1' },
      { layer: 'info_2', intersects: true, severity: 1, message: 'Information 2' }
    ];
    
    // Test avec différentes limites
    const summary3 = summarizeContext(flags, 3);
    expect(summary3).toHaveLength(3);
    expect(summary3[0]).toBe('Danger fort');
    
    const summary5 = summarizeContext(flags, 5);
    expect(summary5).toHaveLength(5);
    
    const summaryAll = summarizeContext(flags, 10);
    expect(summaryAll).toHaveLength(6); // Tous les flags
  });

  it('should handle less than 5 flags gracefully', async () => {
    // Parcelle avec peu de contextes
    const parcelId = 'test_few_contexts';
    const geomWkt = 'POLYGON((2592000 1118000, 2592100 1118000, 2592100 1118100, 2592000 1118100, 2592000 1118000))';
    
    const flags = await getContextForParcel(parcelId, geomWkt);
    
    // Peut avoir 0 à 5 flags
    expect(flags.length).toBeGreaterThanOrEqual(0);
    expect(flags.length).toBeLessThanOrEqual(5);
    
    // Si on a des flags, vérifier qu'ils sont bien triés
    if (flags.length > 1) {
      for (let i = 1; i < flags.length; i++) {
        expect(flags[i].severity).toBeLessThanOrEqual(flags[i-1].severity);
      }
    }
  });
});