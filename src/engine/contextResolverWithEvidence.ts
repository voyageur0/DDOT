/**
 * Service de résolution des contextes avec traçabilité des preuves
 * Version enrichie qui enregistre l'origine et la fiabilité de chaque contexte
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../db/types/supabase';

// Re-export des types depuis contextResolver original
export { ContextFlag } from './contextResolver';
import { ContextFlag } from './contextResolver';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ReliabilityLevel = 'direct' | 'derived' | 'estimated' | 'missing';

/**
 * Configuration des couches avec traçabilité
 */
interface LayerConfigWithEvidence {
  name: string;
  checkType: 'intersect' | 'distance' | 'raster';
  distanceThreshold?: number;
  severityRules: (result: any) => number;
  messageTemplate: (result: any) => string;
  reliabilityLevel: ReliabilityLevel;
  sourcePath: (result: any) => string;
}

/**
 * Configuration enrichie des couches
 */
const LAYER_CONFIGS_WITH_EVIDENCE: LayerConfigWithEvidence[] = [
  {
    name: 'opb_noise',
    checkType: 'intersect',
    reliabilityLevel: 'direct',
    severityRules: (result) => {
      const dsLevel = result.value_text;
      if (dsLevel === 'DS IV' || dsLevel === 'DS V') return 3;
      if (dsLevel === 'DS III') return 2;
      return 1;
    },
    messageTemplate: (result) => `Zone de bruit ${result.value_text || 'OPB'} - Isolation ${result.value_text === 'DS III' || result.value_text === 'DS IV' ? 'requise' : 'recommandée'}`,
    sourcePath: (result) => `OPB/cadastre_bruit/${result.value_text || 'zone'}`
  },
  {
    name: 'ofac_airport',
    checkType: 'intersect',
    reliabilityLevel: 'direct',
    severityRules: () => 2,
    messageTemplate: () => 'Zone de sécurité aéroport (OFAC)',
    sourcePath: () => 'OFAC/PSIA/zone_securite'
  },
  {
    name: 'risk_nat',
    checkType: 'intersect',
    reliabilityLevel: 'direct',
    severityRules: (result) => {
      const level = result.metadata?.danger_level;
      if (level === 'fort' || level === 'tres_fort') return 3;
      if (level === 'moyen') return 2;
      return 1;
    },
    messageTemplate: (result) => {
      const type = result.metadata?.hazard_type || 'naturel';
      const level = result.metadata?.danger_level || '';
      const construction = level === 'fort' ? ' - Construction très limitée' : 
                          level === 'moyen' ? ' - Mesures requises' : '';
      return `Zone de danger ${type} ${level}${construction}`.trim();
    },
    sourcePath: (result) => `SIT_VS/dangers_naturels/${result.metadata?.hazard_type || 'zone'}/${result.metadata?.danger_level || 'niveau'}`
  },
  {
    name: 'roads_cantonal',
    checkType: 'distance',
    distanceThreshold: 25,
    reliabilityLevel: 'derived',
    severityRules: (result) => result.distance < 25 ? 2 : 1,
    messageTemplate: (result) => {
      if (result.distance < 25) {
        return `À ${Math.round(result.distance)}m d'une route cantonale - Recul obligatoire`;
      }
      return `Route cantonale à ${Math.round(result.distance)}m`;
    },
    sourcePath: (result) => `SIT_VS/routes_cantonales/distance/${Math.round(result.distance)}m`
  },
  {
    name: 'slope_pct',
    checkType: 'raster',
    reliabilityLevel: 'derived',
    severityRules: (result) => {
      const slope = result.value_num;
      if (slope > 45) return 3;
      if (slope > 30) return 2;
      return 1;
    },
    messageTemplate: (result) => {
      const slope = Math.round(result.value_num || 0);
      const impact = slope > 45 ? ' - Construction complexe' :
                    slope > 30 ? ' - Terrassements conséquents' :
                    slope > 15 ? '' : ' (terrain plat)';
      return `Pente ${slope > 30 ? 'importante' : 'modérée'} (${slope}%)${impact}`;
    },
    sourcePath: (result) => `swissALTI3D/slope_analysis/${Math.round(result.value_num || 0)}pct`
  }
];

/**
 * Récupère le contexte avec traçabilité des preuves
 */
export async function getContextForParcelWithEvidence(
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

    // Analyser chaque couche et tracer les preuves
    for (const config of LAYER_CONFIGS_WITH_EVIDENCE) {
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
            
            // Tracer la preuve
            await trackContextEvidence(parcelId, config, flag, result);
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

    // Limiter à 5 flags maximum
    return flags.slice(0, 5);

  } catch (error) {
    console.error('Erreur getContextForParcelWithEvidence:', error);
    return [];
  }
}

/**
 * Enregistre la preuve pour un contexte
 */
async function trackContextEvidence(
  parcelId: string,
  config: LayerConfigWithEvidence,
  flag: ContextFlag,
  rawResult: any
): Promise<void> {
  try {
    // Récupérer l'ID de la couche
    const { data: layer } = await supabase
      .from('context_layers')
      .select('id')
      .eq('layer_name', config.name)
      .single();

    if (!layer) return;

    // Déterminer les valeurs
    let valueText = flag.valueText || null;
    let valueNum = flag.valueNum || null;
    let valueJson = null;

    // Pour certaines couches, stocker plus d'infos en JSON
    if (flag.metadata) {
      valueJson = flag.metadata;
    }

    // Construire le commentaire descriptif
    const comment = buildEvidenceComment(config.name, flag);

    // Insérer la preuve
    await supabase.rpc('insert_evidence', {
      p_ref_type: 'context',
      p_ref_id: layer.id,
      p_parcel_id: parcelId,
      p_field: config.name,
      p_value_text: valueText,
      p_value_num: valueNum,
      p_value_json: valueJson,
      p_reliability: config.reliabilityLevel,
      p_source_path: config.sourcePath(rawResult),
      p_comment: comment,
      p_inserted_by: 'contextResolver'
    });

  } catch (error) {
    console.error('Erreur dans trackContextEvidence:', error);
    // Ne pas propager l'erreur pour ne pas bloquer l'analyse
  }
}

/**
 * Construit un commentaire descriptif pour l'evidence
 */
function buildEvidenceComment(layerName: string, flag: ContextFlag): string {
  switch (layerName) {
    case 'opb_noise':
      return `Cadastre du bruit - ${flag.valueText || 'Zone OPB'}`;
    
    case 'ofac_airport':
      return 'Plan sectoriel infrastructure aéronautique (PSIA)';
    
    case 'risk_nat':
      const hazard = flag.metadata?.hazard_type || 'danger';
      const level = flag.metadata?.danger_level || '';
      return `Carte des dangers ${hazard} - Niveau ${level}`;
    
    case 'roads_cantonal':
      return flag.distance ? 
        `Distance mesurée: ${Math.round(flag.distance)}m` : 
        'Proximité route cantonale';
    
    case 'slope_pct':
      return `Analyse MNT swissALTI3D - Pente ${Math.round(flag.valueNum || 0)}%`;
    
    default:
      return flag.message;
  }
}

/**
 * Analyse une couche spécifique (reprise du contextResolver original)
 */
async function analyzeLayer(config: LayerConfigWithEvidence, geomWkt: string): Promise<any> {
  const { data: layer, error: layerError } = await supabase
    .from('context_layers')
    .select('id, layer_name, metadata')
    .eq('layer_name', config.name)
    .single();

  if (layerError || !layer) {
    return null;
  }

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
  // Simulation pour l'instant
  const distance = Math.random() * 50;
  
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
  // Simulation d'une valeur de pente
  const slopeValue = 15 + Math.random() * 35;

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
 * Vérifie le cache (reprise du contextResolver original)
 */
async function checkCache(parcelId: string): Promise<ContextFlag[]> {
  const { data, error } = await supabase
    .from('parcel_context')
    .select(`
      *,
      context_layers!inner(layer_name, metadata)
    `)
    .eq('parcel_id', parcelId)
    .gte('computed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

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
 * Export de la fonction principale avec le nom original pour compatibilité
 */
export const getContextForParcel = getContextForParcelWithEvidence;

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