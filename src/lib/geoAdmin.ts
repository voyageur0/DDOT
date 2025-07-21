import axios from 'axios';
import { findCommune, normalizeCommune } from './communesMappingVS';

export interface ParcelSearchResult {
  egrid: string;
  number: string;
  municipality: string;
  canton: string;
  surface?: number;
  center: { x: number; y: number };
}

export interface ParcelDetails {
  egrid: string;
  number: string;
  municipality: string;
  canton: string;
  surface: number;
  zone?: string;
  owner?: string;
  coordinates: { x: number; y: number };
  attributes: Record<string, any>;
}

const SEARCH_ENDPOINT = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
const IDENTIFY_ENDPOINT = 'https://api3.geo.admin.ch/rest/services/ech/MapServer/identify';
const FEATURE_ENDPOINT = 'https://api3.geo.admin.ch/rest/services/api/feature';

/**
 * Recherche par adresse et retourne la parcelle associée
 */
async function searchByAddress(searchText: string): Promise<ParcelSearchResult | null> {
  try {
    // D'abord chercher l'adresse
    const { data } = await axios.get(SEARCH_ENDPOINT, {
      params: {
        searchText: searchText,
        type: 'locations',
        origins: 'address',
        limit: 1,
        sr: 2056,
        lang: 'fr'
      },
      timeout: 10000
    });
    
    if (data?.results?.length) {
      const hit = data.results[0];
      console.log(`📍 Adresse trouvée: ${hit.attrs?.label}`);
      
      // Maintenant chercher la parcelle à ces coordonnées
      const x = hit.attrs?.y; // Note: x et y sont inversés dans l'API
      const y = hit.attrs?.x;
      
      if (x && y) {
        // Identifier la parcelle aux coordonnées trouvées
        const identifyData = await axios.get(IDENTIFY_ENDPOINT, {
          params: {
            geometry: `${x},${y}`,
            geometryType: 'esriGeometryPoint',
            layers: 'all:ch.kantone.cadastralwebmap-farbe',
            imageDisplay: '512,512,96',
            mapExtent: `${x-100},${y-100},${x+100},${y+100}`,
            tolerance: 10,
            returnGeometry: true,
            sr: 2056
          },
          timeout: 10000
        });
        
        if (identifyData.data?.results?.length) {
          const parcel = identifyData.data.results[0];
          console.log(`✅ Parcelle trouvée à l'adresse: ${parcel.properties?.egrid || parcel.properties?.number}`);
          
          return {
            egrid: parcel.properties?.egrid || '',
            number: parcel.properties?.number || '',
            municipality: parcel.properties?.municipality || hit.attrs?.municipality || '',
            canton: 'VS',
            center: { x, y }
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erreur recherche par adresse:', error);
    return null;
  }
}

/**
 * Recherche une parcelle par texte libre (adresse, no parcelle …).
 */
export async function searchParcel(searchText: string): Promise<ParcelSearchResult | null> {
  try {
    console.log(`🔍 Recherche parcelle: "${searchText}"`);
    
    // D'abord essayer de chercher par adresse si ça ressemble à une adresse
    const hasNumber = /\d/.test(searchText);
    const hasComma = searchText.includes(',');
    
    if (hasNumber && (hasComma || searchText.toLowerCase().includes('route') || searchText.toLowerCase().includes('rue'))) {
      console.log(`📍 Recherche par adresse détectée`);
      
      // Recherche d'adresse
      const addressResult = await searchByAddress(searchText);
      if (addressResult) {
        return addressResult;
      }
    }
    
    // Essayer de normaliser le nom de commune s'il s'agit d'une commune
    const communeInfo = findCommune(searchText);
    let searchTerms = [searchText];
    
    if (communeInfo) {
      console.log(`🏛️ Commune identifiée: ${communeInfo.name} (${communeInfo.district})`);
      searchTerms = [
        communeInfo.name,
        ...(communeInfo.searchKeywords || []),
        ...(communeInfo.germanName ? [communeInfo.germanName] : [])
      ];
    }
    
    // Essayer plusieurs variantes de recherche
    for (const searchTerm of searchTerms) {
      try {
        const { data } = await axios.get(SEARCH_ENDPOINT, {
          params: {
            searchText: searchTerm,
            type: 'locations',
            origins: 'parcel',
            limit: 3, // Augmenter la limite pour avoir plus de choix
            sr: 2056,
            lang: 'fr'
          },
          timeout: 10000
        });
        
        if (data?.results?.length) {
          const hit = data.results[0];
          console.log(`✅ Parcelle trouvée avec "${searchTerm}": ${hit.attrs?.label || hit.attrs?.number}`);
          
          // Extraire l'EGRID depuis le label (format: "CH 1234 5678 9012")
          let egrid = hit?.attrs?.egrid;
          if (!egrid && hit?.attrs?.label) {
            const egridMatch = hit.attrs.label.match(/CH\s*(\d{4})\s*(\d{4})\s*(\d{4})/);
            if (egridMatch) {
              egrid = `CH${egridMatch[1]}${egridMatch[2]}${egridMatch[3]}`;
              console.log(`📋 EGRID extrait du label: ${egrid}`);
            }
          }
          
          return {
            egrid: egrid || '',
            number: hit?.attrs?.number || hit?.attrs?.label,
            municipality: hit?.attrs?.municipality || communeInfo?.name || '',
            canton: hit?.attrs?.kantonskürzel || 'VS',
            center: { x: hit.attrs?.y || 0, y: hit.attrs?.x || 0 }
          };
        }
      } catch (searchError) {
        console.log(`⚠️ Échec recherche avec "${searchTerm}"`);
        continue;
      }
    }
    
    console.log('❌ Aucune parcelle trouvée après toutes les tentatives');
    return null;
    
  } catch (error) {
    console.error('❌ Erreur recherche parcelle:', error);
    return null;
  }
}

/**
 * Récupère les détails complets d'une parcelle par ses coordonnées
 */
export async function getParcelDetails(x: number, y: number): Promise<ParcelDetails | null> {
  try {
    console.log(`📊 Récupération détails parcelle (${x}, ${y})`);
    
    // Essayer plusieurs couches de données cadastrales
    const cadastralLayers = [
      'ch.kantone.cadastralwebmap-farbe',
      'ch.swisstopo.amtliches-gebaeudeadressverzeichnis',
      'ch.are.bauzonen'
    ];
    
    for (const layer of cadastralLayers) {
      try {
        const { data } = await axios.get(IDENTIFY_ENDPOINT, {
          params: {
            geometry: `${x},${y}`,
            geometryFormat: 'geojson',
            geometryType: 'esriGeometryPoint',
            layers: `all:${layer}`,
            tolerance: 5,
            mapExtent: `${x-100},${y-100},${x+100},${y+100}`,
            imageDisplay: '100,100,96',
            lang: 'fr'
          },
          timeout: 10000
        });

        if (data?.results?.length) {
          const feature = data.results[0];
          const attrs = feature.attributes || {};
          
          console.log(`✅ Détails parcelle récupérés via ${layer}: ${attrs.nummer || attrs.egrid || 'Trouvé'}`);
          
          return {
            egrid: attrs.egrid || attrs.EGRID || '',
            number: attrs.nummer || attrs.number || attrs.NUM || '',
            municipality: attrs.gemeinde || attrs.municipality || attrs.GEMEINDE || '',
            canton: attrs.kanton || attrs.canton || 'VS',
            surface: parseFloat(attrs.flaeche || attrs.surface || attrs.FLAECHE || '0'),
            zone: attrs.zone || attrs.ZONE || undefined,
            coordinates: { x, y },
            attributes: attrs
          };
        }
      } catch (layerError) {
        console.log(`⚠️ Couche ${layer} indisponible`);
        continue;
      }
    }
    
    console.log('❌ Aucun détail de parcelle trouvé sur toutes les couches');
    return null;
    
  } catch (error) {
    console.error('❌ Erreur récupération détails parcelle:', error);
    return null;
  }
}

/**
 * Identifie les zones et contraintes sur une parcelle
 */
export async function identifyZonesAndConstraints(x: number, y: number): Promise<Record<string, any>> {
  try {
    console.log(`🗺️ Identification zones et contraintes (${x}, ${y})`);
    
    const layers = [
      'ch.are.bauzonen', // Zones à bâtir
      'ch.bazl.projektierungszone-flughafenanlagen', // Zones aéroportuaires
      'ch.bafu.bundesinventare-bln', // Inventaires fédéraux
      'ch.swisstopo.amtliches-gebaeudeadressverzeichnis', // Adresses officielles
      'ch.kantone.cadastralwebmap-farbe' // Plan cadastral
    ];

    const results: Record<string, any> = {};
    
    for (const layer of layers) {
      try {
        const { data } = await axios.get(IDENTIFY_ENDPOINT, {
          params: {
            geometry: `${x},${y}`,
            geometryFormat: 'geojson', 
            geometryType: 'esriGeometryPoint',
            layers: `all:${layer}`,
            tolerance: 5,
            mapExtent: `${x-100},${y-100},${x+100},${y+100}`,
            imageDisplay: '100,100,96',
            lang: 'fr'
          },
          timeout: 8000
        });
        
        if (data?.results?.length) {
          results[layer] = data.results[0].attributes;
          console.log(`✅ ${layer}: données trouvées`);
        }
      } catch (layerError) {
        console.log(`⚠️ ${layer}: pas d'info disponible`);
      }
    }
    
    return results;
  } catch (error) {
    console.error('❌ Erreur identification zones:', error);
    return {};
  }
}

/**
 * Récupère les informations géologiques et topographiques
 */
export async function getGeologicalInfo(x: number, y: number): Promise<Record<string, any>> {
  try {
    console.log(`🗻 Récupération infos géologiques (${x}, ${y})`);
    
    const geoLayers = [
      'ch.swisstopo.geologie-geocover',
      'ch.swisstopo.geologie-geodaten-assert',
      'ch.bafu.gefahren-geologische_naturgefahren'
    ];

    const results: Record<string, any> = {};
    
    for (const layer of geoLayers) {
      try {
        const { data } = await axios.get(IDENTIFY_ENDPOINT, {
          params: {
            geometry: `${x},${y}`,
            geometryFormat: 'geojson',
            geometryType: 'esriGeometryPoint', 
            layers: `all:${layer}`,
            tolerance: 10,
            mapExtent: `${x-200},${y-200},${x+200},${y+200}`,
            imageDisplay: '100,100,96',
            lang: 'fr'
          },
          timeout: 10000
        });
        
        if (data?.results?.length) {
          results[layer] = data.results[0].attributes;
          console.log(`✅ Géologie ${layer}: données trouvées`);
        }
      } catch (layerError) {
        console.log(`⚠️ Géologie ${layer}: pas d'info disponible`);
      }
    }
    
    return results;
  } catch (error) {
    console.error('❌ Erreur infos géologiques:', error);
    return {};
  }
} 