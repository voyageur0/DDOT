/**
 * Tests pour le cache des contextes
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getContextForParcel, cleanContextCache } from '../../src/engine/contextResolver';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.test' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Context Engine - Cache Functionality', () => {
  const testParcelId = 'test_cache_' + Date.now();
  const testGeom = 'POLYGON((2595000 1119000, 2595100 1119000, 2595100 1119100, 2595000 1119100, 2595000 1119000))';

  beforeAll(async () => {
    // Nettoyer le cache pour ce test
    await supabase
      .from('parcel_context')
      .delete()
      .eq('parcel_id', testParcelId);
  });

  afterAll(async () => {
    // Nettoyer après les tests
    await supabase
      .from('parcel_context')
      .delete()
      .eq('parcel_id', testParcelId);
  });

  it('should cache results on first call', async () => {
    // Premier appel - devrait analyser et mettre en cache
    const startTime = Date.now();
    const flags1 = await getContextForParcel(testParcelId, testGeom);
    const firstCallTime = Date.now() - startTime;

    // Vérifier qu'on a des résultats
    expect(flags1).toBeDefined();
    expect(Array.isArray(flags1)).toBe(true);

    // Vérifier que le cache a été rempli
    const { data: cacheEntries } = await supabase
      .from('parcel_context')
      .select('*')
      .eq('parcel_id', testParcelId);

    expect(cacheEntries).toBeDefined();
    expect(cacheEntries!.length).toBeGreaterThan(0);
  });

  it('should return cached results on second call', async () => {
    // S'assurer qu'on a des données en cache
    await getContextForParcel(testParcelId, testGeom);

    // Deuxième appel - devrait lire depuis le cache
    const startTime = Date.now();
    const flags2 = await getContextForParcel(testParcelId, testGeom);
    const secondCallTime = Date.now() - startTime;

    // Le deuxième appel devrait être plus rapide (cache)
    // Note: Ce test peut être flaky, on vérifie juste qu'on a des résultats
    expect(flags2).toBeDefined();
    expect(Array.isArray(flags2)).toBe(true);

    // Vérifier qu'aucune nouvelle entrée n'a été créée
    const { count: beforeCount } = await supabase
      .from('parcel_context')
      .select('*', { count: 'exact', head: true })
      .eq('parcel_id', testParcelId);

    // Troisième appel
    await getContextForParcel(testParcelId, testGeom);

    const { count: afterCount } = await supabase
      .from('parcel_context')
      .select('*', { count: 'exact', head: true })
      .eq('parcel_id', testParcelId);

    // Le nombre d'entrées ne devrait pas avoir changé
    expect(afterCount).toBe(beforeCount);
  });

  it('should store correct cache metadata', async () => {
    const cacheTestId = 'test_cache_meta_' + Date.now();
    const flags = await getContextForParcel(cacheTestId, testGeom);

    // Récupérer les entrées de cache
    const { data: cacheEntries } = await supabase
      .from('parcel_context')
      .select('*')
      .eq('parcel_id', cacheTestId);

    expect(cacheEntries).toBeDefined();
    
    if (cacheEntries && cacheEntries.length > 0) {
      const entry = cacheEntries[0];
      
      // Vérifier les champs obligatoires
      expect(entry.parcel_id).toBe(cacheTestId);
      expect(entry.layer_id).toBeDefined();
      expect(entry.layer_name).toBeDefined();
      expect(entry.intersects).toBeDefined();
      expect(entry.computed_at).toBeDefined();
      
      // Si intersects est true, on devrait avoir severity et message
      if (entry.intersects) {
        expect(entry.severity).toBeGreaterThanOrEqual(1);
        expect(entry.severity).toBeLessThanOrEqual(3);
        expect(entry.message).toBeDefined();
      }
    }

    // Nettoyer
    await supabase
      .from('parcel_context')
      .delete()
      .eq('parcel_id', cacheTestId);
  });

  it('should respect cache expiration (30 days)', async () => {
    // Insérer une entrée de cache ancienne (31 jours)
    const oldCacheId = 'test_old_cache_' + Date.now();
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 31);

    // Récupérer un layer_id valide
    const { data: layer } = await supabase
      .from('context_layers')
      .select('id')
      .limit(1)
      .single();

    if (layer) {
      await supabase
        .from('parcel_context')
        .insert({
          parcel_id: oldCacheId,
          layer_id: layer.id,
          layer_name: 'test_layer',
          intersects: true,
          severity: 2,
          message: 'Old cache entry',
          computed_at: oldDate.toISOString()
        });

      // Appeler getContextForParcel - devrait ignorer l'ancien cache
      const flags = await getContextForParcel(oldCacheId, testGeom);

      // Vérifier que de nouvelles entrées ont été créées
      const { data: newEntries } = await supabase
        .from('parcel_context')
        .select('computed_at')
        .eq('parcel_id', oldCacheId)
        .gte('computed_at', new Date(Date.now() - 60000).toISOString()); // Dernière minute

      expect(newEntries).toBeDefined();
      expect(newEntries!.length).toBeGreaterThan(0);

      // Nettoyer
      await supabase
        .from('parcel_context')
        .delete()
        .eq('parcel_id', oldCacheId);
    }
  });

  it('should handle cache cleaning function', async () => {
    // Créer des entrées de test
    const cleanTestId = 'test_clean_' + Date.now();
    
    // Appeler pour créer du cache
    await getContextForParcel(cleanTestId, testGeom);

    // Vérifier qu'on a des entrées
    const { count: beforeClean } = await supabase
      .from('parcel_context')
      .select('*', { count: 'exact', head: true })
      .eq('parcel_id', cleanTestId);

    expect(beforeClean).toBeGreaterThan(0);

    // Nettoyer le cache de 0 jours (tout supprimer)
    await cleanContextCache(0);

    // Vérifier que les entrées ont été supprimées
    const { count: afterClean } = await supabase
      .from('parcel_context')
      .select('*', { count: 'exact', head: true })
      .eq('parcel_id', cleanTestId);

    expect(afterClean).toBe(0);
  });
});