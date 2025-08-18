/**
 * Service de gestion des labels multilingues
 * Récupère les libellés uniformisés depuis le dictionnaire
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../db/types/supabase';

// Types
export type Lang = 'fr' | 'de' | 'en';
export type LabelType = 'zone' | 'constraint' | 'field' | 'message';

interface LabelEntry {
  code: string;
  type: LabelType;
  label_fr_short: string;
  label_fr_long: string | null;
  label_de_short: string | null;
  label_de_long: string | null;
  label_en_short: string | null;
  label_en_long: string | null;
  severity: number | null;
  category: string | null;
  metadata: any;
}

// Cache en mémoire pour éviter les requêtes répétées
const labelCache = new Map<string, LabelEntry>();
const cacheTimeout = 5 * 60 * 1000; // 5 minutes
let lastCacheRefresh = 0;

// Client Supabase
const supabase: SupabaseClient<Database> = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Récupère un label dans la langue demandée
 */
export async function getLabel(
  code: string,
  type: LabelType,
  lang: Lang = 'fr',
  long: boolean = false
): Promise<string> {
  try {
    // Clé de cache
    const cacheKey = `${type}:${code}`;
    
    // Vérifier le cache
    if (labelCache.has(cacheKey) && Date.now() - lastCacheRefresh < cacheTimeout) {
      const entry = labelCache.get(cacheKey)!;
      return extractLabelFromEntry(entry, lang, long) || code;
    }

    // Requête DB
    const { data, error } = await supabase
      .from('label_dictionary')
      .select('*')
      .eq('code', code)
      .eq('type', type)
      .single();

    if (error || !data) {
      console.warn(`Label non trouvé: ${type}/${code}`);
      return code; // Fallback au code
    }

    // Mettre en cache
    labelCache.set(cacheKey, data as LabelEntry);
    lastCacheRefresh = Date.now();

    return extractLabelFromEntry(data as LabelEntry, lang, long) || code;
  } catch (error) {
    console.error('Erreur getLabel:', error);
    return code; // Fallback au code en cas d'erreur
  }
}

/**
 * Récupère plusieurs labels en une seule requête
 */
export async function getLabels(
  items: Array<{ code: string; type: LabelType }>,
  lang: Lang = 'fr',
  long: boolean = false
): Promise<Record<string, string>> {
  try {
    // Filtrer les items non cachés
    const uncached = items.filter(item => {
      const cacheKey = `${item.type}:${item.code}`;
      return !labelCache.has(cacheKey) || Date.now() - lastCacheRefresh >= cacheTimeout;
    });

    // Si tout est en cache, retourner directement
    if (uncached.length === 0) {
      const result: Record<string, string> = {};
      items.forEach(item => {
        const cacheKey = `${item.type}:${item.code}`;
        const entry = labelCache.get(cacheKey);
        if (entry) {
          result[item.code] = extractLabelFromEntry(entry, lang, long) || item.code;
        }
      });
      return result;
    }

    // Construire la requête pour les items non cachés
    const orConditions = uncached.map(item => 
      `(type.eq.${item.type},code.eq.${item.code})`
    ).join(',');

    const { data, error } = await supabase
      .from('label_dictionary')
      .select('*')
      .or(orConditions);

    if (error) {
      console.error('Erreur getLabels:', error);
      // Retourner les codes comme fallback
      const result: Record<string, string> = {};
      items.forEach(item => result[item.code] = item.code);
      return result;
    }

    // Mettre en cache les nouvelles entrées
    if (data) {
      data.forEach(entry => {
        const cacheKey = `${entry.type}:${entry.code}`;
        labelCache.set(cacheKey, entry as LabelEntry);
      });
      lastCacheRefresh = Date.now();
    }

    // Construire le résultat
    const result: Record<string, string> = {};
    items.forEach(item => {
      const cacheKey = `${item.type}:${item.code}`;
      const entry = labelCache.get(cacheKey);
      if (entry) {
        result[item.code] = extractLabelFromEntry(entry, lang, long) || item.code;
      } else {
        result[item.code] = item.code; // Fallback
      }
    });

    return result;
  } catch (error) {
    console.error('Erreur getLabels:', error);
    // Retourner les codes comme fallback
    const result: Record<string, string> = {};
    items.forEach(item => result[item.code] = item.code);
    return result;
  }
}

/**
 * Récupère la sévérité d'une contrainte
 */
export async function getSeverity(
  code: string,
  type: LabelType = 'constraint'
): Promise<number> {
  try {
    // Vérifier le cache
    const cacheKey = `${type}:${code}`;
    if (labelCache.has(cacheKey) && Date.now() - lastCacheRefresh < cacheTimeout) {
      const entry = labelCache.get(cacheKey)!;
      return entry.severity || 1;
    }

    // Requête DB
    const { data, error } = await supabase
      .from('label_dictionary')
      .select('severity')
      .eq('code', code)
      .eq('type', type)
      .single();

    if (error || !data) {
      return 1; // Sévérité par défaut
    }

    return data.severity || 1;
  } catch (error) {
    console.error('Erreur getSeverity:', error);
    return 1; // Sévérité par défaut
  }
}

/**
 * Récupère tous les labels d'un type donné
 */
export async function getLabelsByType(
  type: LabelType,
  lang: Lang = 'fr'
): Promise<Array<{ code: string; label: string; severity?: number }>> {
  try {
    const { data, error } = await supabase
      .from('label_dictionary')
      .select('*')
      .eq('type', type)
      .order('code');

    if (error || !data) {
      return [];
    }

    return data.map(entry => ({
      code: entry.code,
      label: extractLabelFromEntry(entry as LabelEntry, lang, false) || entry.code,
      severity: entry.severity || undefined
    }));
  } catch (error) {
    console.error('Erreur getLabelsByType:', error);
    return [];
  }
}

/**
 * Extrait le label approprié d'une entrée
 */
function extractLabelFromEntry(
  entry: LabelEntry,
  lang: Lang,
  long: boolean
): string | null {
  // Construire le nom de colonne
  const columnName = `label_${lang}_${long ? 'long' : 'short'}` as keyof LabelEntry;
  let label = entry[columnName] as string | null;

  // Fallback vers le français si pas de traduction
  if (!label && lang !== 'fr') {
    const frColumn = `label_fr_${long ? 'long' : 'short'}` as keyof LabelEntry;
    label = entry[frColumn] as string | null;
  }

  // Fallback vers la version courte si pas de version longue
  if (!label && long) {
    const shortColumn = `label_${lang}_short` as keyof LabelEntry;
    label = entry[shortColumn] as string | null;
    
    // Encore un fallback vers le français court
    if (!label && lang !== 'fr') {
      label = entry.label_fr_short;
    }
  }

  return label;
}

/**
 * Précharge les labels les plus utilisés
 */
export async function preloadCommonLabels(): Promise<void> {
  try {
    console.log('🔄 Préchargement des labels courants...');
    
    const { data, error } = await supabase
      .from('label_dictionary')
      .select('*')
      .in('type', ['zone', 'field'])
      .limit(100);

    if (error) {
      console.error('Erreur preloadCommonLabels:', error);
      return;
    }

    if (data) {
      data.forEach(entry => {
        const cacheKey = `${entry.type}:${entry.code}`;
        labelCache.set(cacheKey, entry as LabelEntry);
      });
      lastCacheRefresh = Date.now();
      console.log(`✅ ${data.length} labels préchargés`);
    }
  } catch (error) {
    console.error('Erreur preloadCommonLabels:', error);
  }
}

/**
 * Vide le cache des labels
 */
export function clearLabelCache(): void {
  labelCache.clear();
  lastCacheRefresh = 0;
}

/**
 * Helper pour formater un label avec une valeur
 */
export function formatLabelWithValue(
  label: string,
  value: number | string | null,
  unit?: string
): string {
  if (value === null || value === undefined) {
    return label;
  }

  // Formater selon le type d'unité
  switch (unit) {
    case 'm':
      return `${label}: ${value}m`;
    case 'm²':
      return `${label}: ${value}m²`;
    case 'percent':
      return `${label}: ${value}%`;
    case 'ratio':
      return `${label}: ${value}`;
    case 'number':
      return `${label}: ${value}`;
    default:
      return `${label}: ${value}`;
  }
}