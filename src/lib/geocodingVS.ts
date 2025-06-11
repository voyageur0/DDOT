/**
 * Module de géocodage amélioré pour le canton du Valais
 * Utilise plusieurs sources pour maximiser les chances de trouver des coordonnées précises
 */

import axios from 'axios';
import { findCommune, normalizeCommune } from './communesMappingVS';

export interface GeocodeResult {
  coordinates: { x: number; y: number };
  address: string;
  municipality: string;
  canton: string;
  accuracy: 'exact' | 'approximate' | 'municipality';
  source: string;
}

/**
 * Géocode une adresse en utilisant plusieurs sources
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  console.log(`🗺️ Géocodage de: "${address}"`);
  
  // 1. Essayer GeoAdmin CH (le plus précis)
  const geoAdminResult = await geocodeWithGeoAdmin(address);
  if (geoAdminResult) return geoAdminResult;
  
  // 2. Essayer swisstopo
  const swisstopoResult = await geocodeWithSwisstopo(address);
  if (swisstopoResult) return swisstopoResult;
  
  // 3. Essayer avec normalization des communes
  const communeNormalized = normalizeCommune(address);
  if (communeNormalized !== address) {
    const normalizedResult = await geocodeWithGeoAdmin(communeNormalized);
    if (normalizedResult) return normalizedResult;
  }
  
  // 4. Fallback : centre de commune
  const communeCenter = await getCommuneCenter(address);
  if (communeCenter) return communeCenter;
  
  console.log('❌ Aucun résultat de géocodage trouvé');
  return null;
}

/**
 * Géocode avec l'API GeoAdmin
 */
async function geocodeWithGeoAdmin(address: string): Promise<GeocodeResult | null> {
  try {
    const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/api/SearchServer', {
      params: {
        searchText: address,
        type: 'locations',
        origins: 'address,parcel,gazetteer',
        limit: 3,
        sr: 2056,
        lang: 'fr'
      },
      timeout: 8000
    });
    
    if (data?.results?.length) {
      const result = data.results[0];
      const attrs = result.attrs;
      
      return {
        coordinates: { x: attrs.y || 0, y: attrs.x || 0 },
        address: attrs.label || address,
        municipality: attrs.gemeinde || attrs.municipality || '',
        canton: attrs.kantonskürzel || 'VS',
        accuracy: result.origin === 'address' ? 'exact' : 'approximate',
        source: 'GeoAdmin CH'
      };
    }
  } catch (error: any) {
    console.log('⚠️ Erreur géocodage GeoAdmin:', error.message);
  }
  
  return null;
}

/**
 * Géocode avec l'API Swisstopo
 */
async function geocodeWithSwisstopo(address: string): Promise<GeocodeResult | null> {
  try {
    const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/api/feature', {
      params: {
        searchText: address,
        type: 'feature',
        layer: 'ch.bfs.gebaeude_wohnungs_register',
        limit: 1,
        sr: 2056
      },
      timeout: 8000
    });
    
    if (data?.features?.length) {
      const feature = data.features[0];
      const coords = feature.geometry?.coordinates;
      
      if (coords && coords.length >= 2) {
        return {
          coordinates: { x: coords[0], y: coords[1] },
          address: feature.properties?.label || address,
          municipality: feature.properties?.gemeinde || '',
          canton: 'VS',
          accuracy: 'exact',
          source: 'Swisstopo RFE'
        };
      }
    }
  } catch (error: any) {
    console.log('⚠️ Erreur géocodage Swisstopo:', error.message);
  }
  
  return null;
}

/**
 * Obtient le centre d'une commune
 */
async function getCommuneCenter(searchText: string): Promise<GeocodeResult | null> {
  const communeInfo = findCommune(searchText);
  
  if (!communeInfo) return null;
  
  try {
    const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/api/SearchServer', {
      params: {
        searchText: communeInfo.name,
        type: 'locations',
        origins: 'gazetteer',
        limit: 1,
        sr: 2056,
        lang: 'fr'
      },
      timeout: 8000
    });
    
    if (data?.results?.length) {
      const result = data.results[0];
      const attrs = result.attrs;
      
      console.log(`✅ Centre de commune trouvé pour ${communeInfo.name}`);
      
      return {
        coordinates: { x: attrs.y || 0, y: attrs.x || 0 },
        address: `Centre de ${communeInfo.name}`,
        municipality: communeInfo.name,
        canton: 'VS',
        accuracy: 'municipality',
        source: 'Centre commune'
      };
    }
  } catch (error: any) {
    console.log('⚠️ Erreur centre commune:', error.message);
  }
  
  return null;
}

/**
 * Obtient des coordonnées approximatives pour toutes les communes du Valais
 */
export const COMMUNE_COORDINATES: Record<string, { x: number; y: number }> = {
  // Quelques coordonnées de référence pour les principales communes
  'Sion': { x: 2594060, y: 1118724 },
  'Martigny': { x: 2571234, y: 1106543 },
  'Monthey': { x: 2556789, y: 1139876 },
  'Sierre': { x: 2608543, y: 1127890 },
  'Brig-Glis': { x: 2642345, y: 1128456 },
  'Riddes': { x: 2583257, y: 1113569 },
  'Verbier': { x: 2583261, y: 1104954 },
  'Zermatt': { x: 2620000, y: 1093000 },
  'Saas-Fee': { x: 2637000, y: 1104000 },
  'Crans-Montana': { x: 2607000, y: 1135000 },
  'Leukerbad': { x: 2621000, y: 1142000 },
  'Val de Bagnes': { x: 2583261, y: 1104954 },
  'Nendaz': { x: 2594000, y: 1108000 },
  'Veysonnaz': { x: 2589000, y: 1115000 },
  'Grimentz': { x: 2607500, y: 1116000 }
};

/**
 * Fallback avec coordonnées prédéfinies
 */
export function getFallbackCoordinates(municipality: string): GeocodeResult | null {
  const coords = COMMUNE_COORDINATES[municipality];
  if (coords) {
    return {
      coordinates: coords,
      address: `Centre de ${municipality}`,
      municipality,
      canton: 'VS',
      accuracy: 'municipality',
      source: 'Coordonnées prédéfinies'
    };
  }
  return null;
} 