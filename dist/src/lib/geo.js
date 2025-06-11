"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchParcelZone = fetchParcelZone;
const axios_1 = __importDefault(require("axios"));
const GEOADMIN_URL = 'https://api3.geo.admin.ch/rest/services/api/MapServer/identify';
/**
 * Récupère la zone à l'aide de GeoAdmin.
 */
async function fetchParcelZone(lat, lon) {
    // Mock simple pour démo
    if (process.env.NODE_ENV !== 'production') {
        return {
            label: 'Zone résidentielle R2',
            communeId: '6296'
        };
    }
    const params = {
        geometryType: 'esriGeometryPoint',
        geometry: `${lon},${lat}`,
        geometryFormat: 'geojson',
        layers: 'all:ch.vbs.bauzonen',
        tolerance: 0,
        mapExtent: `${lon - 0.0001},${lat - 0.0001},${lon + 0.0001},${lat + 0.0001}`,
        imageDisplay: '1,1,96',
        lang: 'fr',
        sr: 4326,
    };
    const { data } = await axios_1.default.get(GEOADMIN_URL, { params });
    if (!data.results?.length) {
        throw new Error('Zone non trouvée pour ces coordonnées.');
    }
    const result = data.results[0];
    return {
        label: result.attributes?.zone_type ?? 'Zone inconnue',
        communeId: String(result.attributes?.gemeinde_id ?? ''),
    };
}
