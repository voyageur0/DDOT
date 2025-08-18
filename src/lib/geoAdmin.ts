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
        // L'API identify ne fonctionne pas toujours, on utilise une recherche spatiale
        // Chercher les parcelles proches de ces coordonnées
        try {
          const parcelSearchResp = await axios.get(SEARCH_ENDPOINT, {
            params: {
              searchText: `${hit.attrs?.municipality || ''} ${hit.attrs?.zip || ''}`,
              type: 'locations',
              origins: 'parcel',
              limit: 10,
              sr: 2056,
              lang: 'fr'
            },
            timeout: 10000
          });
          
          if (parcelSearchResp.data?.results?.length) {
            // Trouver la parcelle la plus proche des coordonnées de l'adresse
            let closestParcel = null;
            let minDistance = Infinity;
            
            for (const result of parcelSearchResp.data.results) {
              if (result.attrs?.x && result.attrs?.y) {
                const dist = Math.sqrt(
                  Math.pow(result.attrs.x - x, 2) + 
                  Math.pow(result.attrs.y - y, 2)
                );
                if (dist < minDistance && dist < 200) { // Dans un rayon de 200m
                  minDistance = dist;
                  closestParcel = result;
                }
              }
            }
            
            if (closestParcel) {
              console.log(`✅ Parcelle trouvée près de l'adresse (${Math.round(minDistance)}m): ${closestParcel.attrs?.label}`);
              
              // Extraire l'EGRID du label
              let egrid = '';
              if (closestParcel.attrs?.label) {
                const egridMatch = closestParcel.attrs.label.match(/CH\s*([\d\s]+)/);
                if (egridMatch) {
                  egrid = 'CH' + egridMatch[1].replace(/\s/g, '');
                }
              }
              
              return {
                egrid: egrid,
                number: closestParcel.attrs?.num || closestParcel.attrs?.label || '',
                municipality: hit.attrs?.municipality || '',
                canton: 'VS',
                center: { x: closestParcel.attrs?.x || x, y: closestParcel.attrs?.y || y }
              };
            }
          }
        } catch (searchError) {
          console.log('⚠️ Recherche de parcelle proche échouée:', searchError.message);
        }
        
        // Si on ne trouve pas de parcelle, retourner au moins les coordonnées
        console.log(`⚠️ Pas de parcelle trouvée, retour des coordonnées de l'adresse`);
        return {
          egrid: '',
          number: hit.attrs?.label || '',
          municipality: hit.attrs?.municipality || '',
          canton: 'VS',
          center: { x, y }
        };
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
    
    // Vérifier si c'est un EGRID direct (format CHxxxxxxxxxx)
    const egridMatch = searchText.match(/^CH\d{9,12}$/i);
    if (egridMatch) {
      console.log(`🆔 EGRID direct détecté: ${searchText}`);
      // Pour un EGRID, on doit récupérer les coordonnées exactes
      try {
        // Rechercher l'EGRID via l'API
        const { data } = await axios.get(SEARCH_ENDPOINT, {
          params: {
            searchText: searchText.toUpperCase(),
            type: 'locations',
            origins: 'parcel',
            limit: 1,
            sr: 2056,
            lang: 'fr'
          },
          timeout: 10000
        });
        
        if (data?.results?.length) {
          const hit = data.results[0];
          console.log(`✅ Parcelle trouvée pour EGRID ${searchText}: ${hit.attrs?.label || hit.attrs?.number}`);
          
          return {
            egrid: searchText.toUpperCase(),
            number: hit?.attrs?.number || hit?.attrs?.label || searchText,
            municipality: hit?.attrs?.municipality || '',
            canton: hit?.attrs?.kantonskürzel || 'VS',
            center: { x: hit.attrs?.y || 2593600, y: hit.attrs?.x || 1120000 }
          };
        }
      } catch (egridError) {
        console.log(`⚠️ Recherche EGRID échouée, utilisation des coordonnées par défaut`);
      }
      
      // Fallback si la recherche échoue
      return {
        egrid: searchText.toUpperCase(),
        number: searchText,
        municipality: '',
        canton: 'VS',
        center: { x: 2593600, y: 1120000 } // Coordonnées approximatives Sion
      };
    }
    
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
          
          // Extraire l'EGRID depuis le label (formats variés: "CH 1234 5678 9012" ou "(CH 7730 1749 5270)")
          let egrid = hit?.attrs?.egrid;
          if (!egrid && hit?.attrs?.label) {
            // Essayer plusieurs formats d'EGRID possibles
            // Format 1: CH avec espaces et groupes de chiffres variables
            const egridMatch = hit.attrs.label.match(/CH\s*([\d\s]+)/);
            if (egridMatch) {
              // Nettoyer et formater l'EGRID
              egrid = 'CH' + egridMatch[1].replace(/\s/g, '');
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
      'ch.are.nutzungsplanung', // Plans d'affectation
      'ch.are.alpenkonvention', // Convention alpine
      'ch.bav.laerm-emissionplan_eisenbahn_2015', // Bruit ferroviaire
      'ch.bafu.laerm-strassenlaerm_tag', // Bruit routier jour
      'ch.bafu.laerm-strassenlaerm_nacht', // Bruit routier nuit
      'ch.kantone.cadastralwebmap-farbe' // Plan cadastral
    ];

    const results: Record<string, any> = {};
    
    // Essayer deux méthodes : identify et feature info
    for (const layer of layers) {
      try {
        // Méthode 1: Identify avec plus de tolérance
        const { data } = await axios.get(IDENTIFY_ENDPOINT, {
          params: {
            geometry: `${x},${y}`,
            geometryFormat: 'geojson', 
            geometryType: 'esriGeometryPoint',
            layers: `all:${layer}`,
            tolerance: 10, // Augmenter la tolérance
            mapExtent: `${x-500},${y-500},${x+500},${y+500}`, // Zone plus large
            imageDisplay: '500,500,96',
            lang: 'fr',
            returnGeometry: false
          },
          timeout: 10000
        });
        
        if (data?.results?.length) {
          results[layer] = data.results[0].attributes || data.results[0].properties || {};
          console.log(`✅ ${layer}: ${Object.keys(results[layer]).length} attributs trouvés`);
        } else if (layer === 'ch.are.bauzonen' || layer === 'ch.are.nutzungsplanung') {
          // Méthode 2: Essayer avec une API alternative pour les couches importantes
          try {
            const altResponse = await axios.get(`https://api3.geo.admin.ch/rest/services/api/MapServer/${layer}/attributes`, {
              params: {
                geometry: `${x},${y}`,
                geometryType: 'esriGeometryPoint',
                lang: 'fr'
              },
              timeout: 5000
            });
            
            if (altResponse.data) {
              results[layer] = altResponse.data;
              console.log(`✅ ${layer}: données trouvées (méthode alternative)`);
            }
          } catch (altError) {
            // Ignorer l'erreur alternative
          }
        }
      } catch (layerError: any) {
        // Ne logger que pour les couches importantes
        if (layer === 'ch.are.bauzonen' || layer === 'ch.are.nutzungsplanung') {
          console.log(`⚠️ ${layer}: ${layerError.response?.status || 'pas de réponse'}`);
        }
      }
    }
    
    // Si on n'a trouvé aucune zone importante, essayer une approche plus générale
    if (!results['ch.are.bauzonen'] && !results['ch.are.nutzungsplanung']) {
      console.log('🔍 Tentative d\'identification générale des zones...');
      try {
        const generalResponse = await axios.get(IDENTIFY_ENDPOINT, {
          params: {
            geometry: `${x},${y}`,
            geometryType: 'esriGeometryPoint',
            layers: 'all',
            tolerance: 20,
            mapExtent: `${x-1000},${y-1000},${x+1000},${y+1000}`,
            imageDisplay: '1000,1000,96',
            lang: 'fr'
          },
          timeout: 15000
        });
        
        if (generalResponse.data?.results) {
          generalResponse.data.results.forEach((result: any) => {
            if (result.layerBodId && result.layerBodId.includes('zone')) {
              results[result.layerBodId] = result.attributes || result.properties || {};
              console.log(`✅ Zone trouvée: ${result.layerBodId}`);
            }
          });
        }
      } catch (generalError) {
        console.log('⚠️ Identification générale échouée');
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