"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchParcel = searchParcel;
exports.getParcelDetails = getParcelDetails;
exports.identifyZonesAndConstraints = identifyZonesAndConstraints;
exports.getGeologicalInfo = getGeologicalInfo;
const axios_1 = __importDefault(require("axios"));
const SEARCH_ENDPOINT = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
const IDENTIFY_ENDPOINT = 'https://api3.geo.admin.ch/rest/services/ech/MapServer/identify';
const FEATURE_ENDPOINT = 'https://api3.geo.admin.ch/rest/services/api/feature';
/**
 * Recherche une parcelle par texte libre (adresse, no parcelle …).
 */
async function searchParcel(searchText) {
    try {
        console.log(`🔍 Recherche parcelle: "${searchText}"`);
        const { data } = await axios_1.default.get(SEARCH_ENDPOINT, {
            params: {
                searchText,
                type: 'locations',
                origins: 'parcel',
                limit: 1,
                sr: 2056,
                lang: 'fr'
            },
            timeout: 10000
        });
        if (!data?.results?.length) {
            console.log('❌ Aucune parcelle trouvée');
            return null;
        }
        const hit = data.results[0];
        console.log(`✅ Parcelle trouvée: ${hit.attrs?.label || hit.attrs?.number}`);
        return {
            egrid: hit?.attrs?.egrid,
            number: hit?.attrs?.number || hit?.attrs?.label,
            municipality: hit?.attrs?.municipality || '',
            canton: hit?.attrs?.kantonskürzel || 'VS',
            center: { x: hit.attrs?.geom_st_x, y: hit.attrs?.geom_st_y }
        };
    }
    catch (error) {
        console.error('❌ Erreur recherche parcelle:', error);
        return null;
    }
}
/**
 * Récupère les détails complets d'une parcelle par ses coordonnées
 */
async function getParcelDetails(x, y) {
    try {
        console.log(`📊 Récupération détails parcelle (${x}, ${y})`);
        const { data } = await axios_1.default.get(IDENTIFY_ENDPOINT, {
            params: {
                geometry: `${x},${y}`,
                geometryFormat: 'geojson',
                geometryType: 'esriGeometryPoint',
                layers: 'all:ch.swisstopo-vd.geometa-grundstueck',
                tolerance: 0,
                mapExtent: `${x - 100},${y - 100},${x + 100},${y + 100}`,
                imageDisplay: '100,100,96',
                lang: 'fr'
            },
            timeout: 15000
        });
        if (!data?.results?.length) {
            console.log('❌ Aucun détail de parcelle trouvé');
            return null;
        }
        const feature = data.results[0];
        const attrs = feature.attributes || {};
        console.log(`✅ Détails parcelle récupérés: ${attrs.number || 'N/A'}`);
        return {
            egrid: attrs.egrid || '',
            number: attrs.number || '',
            municipality: attrs.municipality || '',
            canton: attrs.canton || 'VS',
            surface: parseFloat(attrs.surface) || 0,
            zone: attrs.zone || undefined,
            coordinates: { x, y },
            attributes: attrs
        };
    }
    catch (error) {
        console.error('❌ Erreur récupération détails parcelle:', error);
        return null;
    }
}
/**
 * Identifie les zones et contraintes sur une parcelle
 */
async function identifyZonesAndConstraints(x, y) {
    try {
        console.log(`🗺️ Identification zones et contraintes (${x}, ${y})`);
        const layers = [
            'ch.are.bauzonen', // Zones à bâtir
            'ch.bazl.projektierungszone-flughafenanlagen', // Zones aéroportuaires
            'ch.bafu.bundesinventare-bln', // Inventaires fédéraux
            'ch.swisstopo.amtliches-gebaeudeadressverzeichnis', // Adresses officielles
            'ch.kantone.cadastralwebmap-farbe' // Plan cadastral
        ];
        const results = {};
        for (const layer of layers) {
            try {
                const { data } = await axios_1.default.get(IDENTIFY_ENDPOINT, {
                    params: {
                        geometry: `${x},${y}`,
                        geometryFormat: 'geojson',
                        geometryType: 'esriGeometryPoint',
                        layers: `all:${layer}`,
                        tolerance: 5,
                        mapExtent: `${x - 100},${y - 100},${x + 100},${y + 100}`,
                        imageDisplay: '100,100,96',
                        lang: 'fr'
                    },
                    timeout: 8000
                });
                if (data?.results?.length) {
                    results[layer] = data.results[0].attributes;
                    console.log(`✅ ${layer}: données trouvées`);
                }
            }
            catch (layerError) {
                console.log(`⚠️ ${layer}: pas d'info disponible`);
            }
        }
        return results;
    }
    catch (error) {
        console.error('❌ Erreur identification zones:', error);
        return {};
    }
}
/**
 * Récupère les informations géologiques et topographiques
 */
async function getGeologicalInfo(x, y) {
    try {
        console.log(`🗻 Récupération infos géologiques (${x}, ${y})`);
        const geoLayers = [
            'ch.swisstopo.geologie-geocover',
            'ch.swisstopo.geologie-geodaten-assert',
            'ch.bafu.gefahren-geologische_naturgefahren'
        ];
        const results = {};
        for (const layer of geoLayers) {
            try {
                const { data } = await axios_1.default.get(IDENTIFY_ENDPOINT, {
                    params: {
                        geometry: `${x},${y}`,
                        geometryFormat: 'geojson',
                        geometryType: 'esriGeometryPoint',
                        layers: `all:${layer}`,
                        tolerance: 10,
                        mapExtent: `${x - 200},${y - 200},${x + 200},${y + 200}`,
                        imageDisplay: '100,100,96',
                        lang: 'fr'
                    },
                    timeout: 10000
                });
                if (data?.results?.length) {
                    results[layer] = data.results[0].attributes;
                    console.log(`✅ Géologie ${layer}: données trouvées`);
                }
            }
            catch (layerError) {
                console.log(`⚠️ Géologie ${layer}: pas d'info disponible`);
            }
        }
        return results;
    }
    catch (error) {
        console.error('❌ Erreur infos géologiques:', error);
        return {};
    }
}
