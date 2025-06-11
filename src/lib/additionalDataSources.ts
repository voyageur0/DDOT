/**
 * Sources de données officielles supplémentaires pour l'analyse cadastrale
 * Intègre les APIs cantonales du Valais et autres sources officielles
 */

import axios from 'axios';

export interface CantonalDataResult {
  source: string;
  data: Record<string, any>;
  success: boolean;
  error?: string;
}

/**
 * Récupère les données du géoportail valaisan
 */
export async function getValaisGeoPortalData(x: number, y: number): Promise<CantonalDataResult> {
  try {
    console.log(`🏔️ Récupération données géoportail VS (${x}, ${y})`);
    
    const { data } = await axios.get('https://map.geo.vs.ch/api/feature', {
      params: {
        coord: `${x},${y}`,
        layers: 'cadastre,zonage,dangers_naturels',
        tolerance: 10,
        format: 'json'
      },
      timeout: 12000
    });
    
    if (data) {
      console.log('✅ Données géoportail VS récupérées');
      return {
        source: 'Géoportail Valais',
        data: data,
        success: true
      };
    }
    
    return { source: 'Géoportail Valais', data: {}, success: false };
    
  } catch (error: any) {
    console.log('⚠️ Géoportail VS indisponible:', error.message);
    return {
      source: 'Géoportail Valais',
      data: {},
      success: false,
      error: error.message
    };
  }
}

/**
 * Récupère les données de protection de la nature
 */
export async function getNatureProtectionData(x: number, y: number): Promise<CantonalDataResult> {
  try {
    console.log(`🦋 Récupération données protection nature (${x}, ${y})`);
    
    const protectionLayers = [
      'ch.bafu.bundesinventare-bln',
      'ch.bafu.schutzgebiete-paerke_nationaler_bedeutung',
      'ch.bafu.waldreservate',
      'ch.bafu.moorlandschaften',
      'ch.bafu.amphibien'
    ];
    
    const results: Record<string, any> = {};
    
    for (const layer of protectionLayers) {
      try {
        const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/ech/MapServer/identify', {
          params: {
            geometry: `${x},${y}`,
            geometryType: 'esriGeometryPoint',
            layers: `all:${layer}`,
            tolerance: 10,
            mapExtent: `${x-200},${y-200},${x+200},${y+200}`,
            imageDisplay: '100,100,96',
            lang: 'fr'
          },
          timeout: 8000
        });
        
        if (data?.results?.length) {
          results[layer] = data.results[0].attributes;
          console.log(`✅ Protection nature ${layer}: données trouvées`);
        }
      } catch (layerError) {
        console.log(`⚠️ Couche ${layer} indisponible`);
      }
    }
    
    return {
      source: 'Protection de la nature',
      data: results,
      success: Object.keys(results).length > 0
    };
    
  } catch (error: any) {
    return {
      source: 'Protection de la nature',
      data: {},
      success: false,
      error: error.message
    };
  }
}

/**
 * Récupère les données d'infrastructure et mobilité
 */
export async function getInfrastructureData(x: number, y: number): Promise<CantonalDataResult> {
  try {
    console.log(`🚇 Récupération données infrastructure (${x}, ${y})`);
    
    const infraLayers = [
      'ch.bav.sachplan-verkehr_kraft',
      'ch.astra.nationalstrassen',
      'ch.bfe.sachplan-uebertragungsleitungen_50hz',
      'ch.bfe.sachplan-uebertragungsleitungen_380kv',
      'ch.bazl.sachplan-infrastruktur-luftfahrt_kraft'
    ];
    
    const results: Record<string, any> = {};
    
    for (const layer of infraLayers) {
      try {
        const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/ech/MapServer/identify', {
          params: {
            geometry: `${x},${y}`,
            geometryType: 'esriGeometryPoint',
            layers: `all:${layer}`,
            tolerance: 50, // Plus de tolérance pour l'infrastructure
            mapExtent: `${x-500},${y-500},${x+500},${y+500}`,
            imageDisplay: '100,100,96',
            lang: 'fr'
          },
          timeout: 8000
        });
        
        if (data?.results?.length) {
          results[layer] = data.results[0].attributes;
          console.log(`✅ Infrastructure ${layer}: données trouvées`);
        }
      } catch (layerError) {
        console.log(`⚠️ Couche infra ${layer} indisponible`);
      }
    }
    
    return {
      source: 'Infrastructure et mobilité',
      data: results,
      success: Object.keys(results).length > 0
    };
    
  } catch (error: any) {
    return {
      source: 'Infrastructure et mobilité',
      data: {},
      success: false,
      error: error.message
    };
  }
}

/**
 * Récupère les données historiques et archéologiques
 */
export async function getHistoricalData(x: number, y: number): Promise<CantonalDataResult> {
  try {
    console.log(`🏺 Récupération données historiques (${x}, ${y})`);
    
    const historicalLayers = [
      'ch.bak.schutzgebiete-unesco_weltkulturerbe',
      'ch.bak.bundesinventar-schuetzenswerte-ortsbilder',
      'ch.babs.kulturgueter',
      'ch.swisstopo.vec200-names-namedlocation'
    ];
    
    const results: Record<string, any> = {};
    
    for (const layer of historicalLayers) {
      try {
        const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/ech/MapServer/identify', {
          params: {
            geometry: `${x},${y}`,
            geometryType: 'esriGeometryPoint',
            layers: `all:${layer}`,
            tolerance: 100,
            mapExtent: `${x-1000},${y-1000},${x+1000},${y+1000}`,
            imageDisplay: '100,100,96',
            lang: 'fr'
          },
          timeout: 8000
        });
        
        if (data?.results?.length) {
          results[layer] = data.results[0].attributes;
          console.log(`✅ Données historiques ${layer}: trouvées`);
        }
      } catch (layerError) {
        console.log(`⚠️ Couche historique ${layer} indisponible`);
      }
    }
    
    return {
      source: 'Patrimoine historique',
      data: results,
      success: Object.keys(results).length > 0
    };
    
  } catch (error: any) {
    return {
      source: 'Patrimoine historique',
      data: {},
      success: false,
      error: error.message
    };
  }
}

/**
 * Récupère toutes les données supplémentaires en parallèle
 */
export async function getAllAdditionalData(x: number, y: number): Promise<{
  results: CantonalDataResult[];
  summary: string;
}> {
  console.log(`📊 Récupération de toutes les données supplémentaires (${x}, ${y})`);
  
  const startTime = Date.now();
  
  // Lancer toutes les requêtes en parallèle
  const promises = [
    getValaisGeoPortalData(x, y),
    getNatureProtectionData(x, y),
    getInfrastructureData(x, y),
    getHistoricalData(x, y)
  ];
  
  const results = await Promise.all(promises);
  const successCount = results.filter(r => r.success).length;
  const totalTime = Date.now() - startTime;
  
  const summary = `Données supplémentaires: ${successCount}/${results.length} sources réussies en ${totalTime}ms`;
  console.log(`📈 ${summary}`);
  
  return { results, summary };
}

/**
 * Formate les données supplémentaires pour l'analyse IA
 */
export function formatAdditionalDataForAI(results: CantonalDataResult[]): string {
  let formatted = '\n## DONNÉES OFFICIELLES SUPPLÉMENTAIRES\n\n';
  
  for (const result of results) {
    formatted += `### ${result.source}\n`;
    
    if (result.success && Object.keys(result.data).length > 0) {
      formatted += `**Statut:** ✅ Données disponibles\n\n`;
      
      for (const [key, value] of Object.entries(result.data)) {
        if (value && typeof value === 'object') {
          formatted += `**${key}:**\n`;
          for (const [subKey, subValue] of Object.entries(value)) {
            if (subValue) {
              formatted += `- ${subKey}: ${subValue}\n`;
            }
          }
        } else if (value) {
          formatted += `- ${key}: ${value}\n`;
        }
      }
      formatted += '\n';
    } else {
      formatted += `**Statut:** ⚠️ ${result.error || 'Données non disponibles'}\n\n`;
    }
  }
  
  return formatted;
} 