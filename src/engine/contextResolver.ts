/**
 * Service de résolution des contextes environnementaux et réglementaires
 * Analyse les contraintes spatiales externes pour une parcelle
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../db/types/supabase';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Indicateur de contexte pour une parcelle
 */
export interface ContextFlag {
  layer: string;                    // Nom de la couche (opb_noise, ofac_airport, etc.)
  intersects: boolean;              // La parcelle intersecte la couche
  valueText?: string;               // Valeur textuelle (ex: 'DS III')
  valueNum?: number;                // Valeur numérique (ex: 35 pour pente %)
  distance?: number;                // Distance en mètres si pas d'intersection
  severity: number;                 // 1=INFO, 2=WARNING, 3=CRITICAL
  message: string;                  // Message descriptif en français
  metadata?: any;                   // Métadonnées additionnelles
}

/**
 * Configuration des couches et leur traitement
 */
interface LayerConfig {
  name: string;
  checkType: 'intersect' | 'distance' | 'raster';
  distanceThreshold?: number;
  severityRules: (result: any) => number;
  messageTemplate: (result: any) => string;
}

/**
 * Configuration des couches contextuelles
 */
const LAYER_CONFIGS: LayerConfig[] = [
  {
    name: 'opb_noise',
    checkType: 'intersect',
    severityRules: (result) => {
      // Plus le degré de sensibilité est élevé, plus c'est critique
      const dsLevel = result.value_text;
      if (dsLevel === 'DS IV' || dsLevel === 'DS V') return 3;
      if (dsLevel === 'DS III') return 2;
      return 1;
    },
    messageTemplate: (result) => `Zone de bruit ${result.value_text || 'OPB'}`
  },
  {
    name: 'ofac_airport',
    checkType: 'intersect',
    severityRules: () => 2,
    messageTemplate: () => 'Zone de sécurité aéroport (OFAC)'
  },
  {
    name: 'risk_nat',
    checkType: 'intersect',
    severityRules: (result) => {
      // Basé sur le niveau de danger
      const level = result.metadata?.danger_level;
      if (level === 'fort' || level === 'tres_fort') return 3;
      if (level === 'moyen') return 2;
      return 1;
    },
    messageTemplate: (result) => {
      const type = result.metadata?.hazard_type || 'naturel';
      const level = result.metadata?.danger_level || '';
      return `Zone de danger ${type} ${level}`.trim();
    }
  },
  {
    name: 'roads_cantonal',
    checkType: 'distance',
    distanceThreshold: 25,
    severityRules: (result) => result.distance < 25 ? 2 : 1,
    messageTemplate: (result) => {
      if (result.distance < 25) {
        return `À ${Math.round(result.distance)}m d'une route cantonale`;
      }
      return `Route cantonale à ${Math.round(result.distance)}m`;
    }
  },
  {
    name: 'slope_pct',
    checkType: 'raster',
    severityRules: (result) => {
      const slope = result.value_num;
      if (slope > 45) return 3;
      if (slope > 30) return 2;
      return 1;
    },
    messageTemplate: (result) => `Pente moyenne ${Math.round(result.value_num || 0)}%`
  }
];

/**
 * Récupère le contexte environnemental pour une parcelle
 */
export async function getContextForParcel(
  parcelId: string,
  geomWkt: string
): Promise<ContextFlag[]> {
  try {
    const flags: ContextFlag[] = [];

    // Vérifier d'abord le cache
    const cachedResults = await checkCache(parcelId);
    if (cachedResults.length > 0) {
      console.log(`✅ Cache hit pour parcelle ${parcelId}`);
      return cachedResults;
    }

    // Analyser chaque couche
    for (const config of LAYER_CONFIGS) {
      try {
        const result = await analyzeLayer(config, geomWkt);
        
        if (result) {
          const flag: ContextFlag = {
            layer: config.name,
            intersects: result.intersects,
            valueText: result.value_text,
            valueNum: result.value_num,
            distance: result.distance_m,
            severity: config.severityRules(result),
            message: config.messageTemplate(result),
            metadata: result.metadata
          };

          // Ne garder que les flags pertinents
          if (flag.intersects || (flag.distance && flag.distance < 100)) {
            flags.push(flag);
          }

          // Sauvegarder dans le cache
          await saveToCache(parcelId, config.name, flag);
        }
      } catch (error) {
        console.warn(`⚠️ Erreur analyse couche ${config.name}:`, error);
      }
    }

    // Trier par sévérité décroissante puis par layer
    flags.sort((a, b) => {
      if (b.severity !== a.severity) {
        return b.severity - a.severity;
      }
      return a.layer.localeCompare(b.layer);
    });

    // Limiter à 5 flags maximum (les plus sévères)
    return flags.slice(0, 5);

  } catch (error) {
    console.error('Erreur getContextForParcel:', error);
    return [];
  }
}

/**
 * Analyse une couche spécifique
 */
async function analyzeLayer(config: LayerConfig, geomWkt: string): Promise<any> {
  // Récupérer les infos de la couche
  const { data: layer, error: layerError } = await supabase
    .from('context_layers')
    .select('id, layer_name, metadata')
    .eq('layer_name', config.name)
    .single();

  if (layerError || !layer) {
    return null;
  }

  // Selon le type de vérification
  switch (config.checkType) {
    case 'intersect':
      return await checkIntersection(layer.id, geomWkt);

    case 'distance':
      return await checkDistance(layer.id, geomWkt, config.distanceThreshold);

    case 'raster':
      return await checkRasterValue(layer.id, geomWkt);

    default:
      return null;
  }
}

/**
 * Vérifie l'intersection avec une couche vectorielle
 */
async function checkIntersection(layerId: string, geomWkt: string): Promise<any> {
  const query = `
    select 
      cl.metadata,
      st_intersects(cl.geom, st_geomfromtext($1, 2056)) as intersects,
      cl.metadata->>'default_value' as value_text,
      (cl.metadata->>'default_num')::numeric as value_num
    from context_layers cl
    where cl.id = $2
  `;

  const { data, error } = await supabase.rpc('check_parcel_context', {
    p_parcel_geom: geomWkt,
    p_layer_id: layerId
  });

  if (error) {
    console.error('Erreur intersection:', error);
    return null;
  }

  return data;
}

/**
 * Calcule la distance à une couche
 */
async function checkDistance(
  layerId: string,
  geomWkt: string,
  threshold?: number
): Promise<any> {
  // Utilisation directe de PostGIS
  const query = `
    select 
      cl.metadata,
      st_distance(cl.geom, st_geomfromtext($1, 2056)) as distance_m,
      st_dwithin(cl.geom, st_geomfromtext($1, 2056), $3) as intersects
    from context_layers cl
    where cl.id = $2
  `;

  // Pour l'instant, simuler le résultat
  const distance = Math.random() * 50; // Simulation
  
  return {
    intersects: distance < (threshold || 25),
    distance_m: distance,
    metadata: { threshold }
  };
}

/**
 * Extrait la valeur d'un raster
 */
async function checkRasterValue(layerId: string, geomWkt: string): Promise<any> {
  // En production: utiliser ST_Value sur le raster
  // Pour l'instant, simuler une valeur de pente
  const slopeValue = 15 + Math.random() * 35; // Entre 15 et 50%

  return {
    intersects: true,
    value_num: slopeValue,
    metadata: { 
      type: 'slope',
      unit: 'percent'
    }
  };
}

/**
 * Vérifie le cache pour une parcelle
 */
async function checkCache(parcelId: string): Promise<ContextFlag[]> {
  const { data, error } = await supabase
    .from('parcel_context')
    .select(`
      *,
      context_layers!inner(layer_name, metadata)
    `)
    .eq('parcel_id', parcelId)
    .gte('computed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // 30 jours

  if (error || !data) {
    return [];
  }

  return data.map(row => ({
    layer: row.layer_name,
    intersects: row.intersects,
    valueText: row.value_text,
    valueNum: row.value_num ? parseFloat(row.value_num) : undefined,
    distance: row.distance_m ? parseFloat(row.distance_m) : undefined,
    severity: row.severity || 1,
    message: row.message || ''
  }));
}

/**
 * Sauvegarde dans le cache
 */
async function saveToCache(
  parcelId: string,
  layerName: string,
  flag: ContextFlag
): Promise<void> {
  try {
    // Récupérer l'ID de la couche
    const { data: layer } = await supabase
      .from('context_layers')
      .select('id')
      .eq('layer_name', layerName)
      .single();

    if (!layer) return;

    await supabase
      .from('parcel_context')
      .upsert({
        parcel_id: parcelId,
        layer_id: layer.id,
        layer_name: layerName,
        intersects: flag.intersects,
        value_text: flag.valueText,
        value_num: flag.valueNum,
        distance_m: flag.distance,
        severity: flag.severity,
        message: flag.message,
        computed_at: new Date().toISOString()
      }, {
        onConflict: 'parcel_id,layer_id'
      });
  } catch (error) {
    console.warn('Erreur sauvegarde cache:', error);
  }
}

/**
 * Nettoie le cache ancien
 */
export async function cleanContextCache(daysToKeep: number = 30): Promise<void> {
  const { error } = await supabase.rpc('clean_parcel_context_cache', {
    days_to_keep: daysToKeep
  });

  if (error) {
    console.error('Erreur nettoyage cache:', error);
  }
}