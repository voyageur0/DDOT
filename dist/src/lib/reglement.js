"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCommuneReglement = fetchCommuneReglement;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const cache = {};
/**
 * Télécharge le règlement communal (PDF) et renvoie le texte brut.
 */
async function fetchCommuneReglement(communeId) {
    if (cache[communeId])
        return cache[communeId];
    // Mock simple pour démo
    if (process.env.NODE_ENV !== 'production') {
        const mockReglement = `
RÈGLEMENT COMMUNAL DE CONSTRUCTION - Commune ${communeId}

Art. 15 - Zones résidentielles R2
- Indice d'utilisation du sol (IUS) : maximum 0.8
- Hauteur maximale des bâtiments : 12 mètres  
- Recul minimal depuis la limite de propriété : 5 mètres
- Taux d'occupation du sol : maximum 30%

Art. 25 - Dispositions particulières
- Toiture en pente obligatoire entre 25° et 45°
- Matériaux de façade : bois, pierre naturelle ou crépi
- Stationnement : 1 place par 100m² habitables

Art. 35 - Zones protégées
- Respect du caractère architectural traditionnel valaisan
- Autorisation spéciale requise pour modifications extérieures
    `;
        cache[communeId] = mockReglement;
        return mockReglement;
    }
    // 1. Trouver le lien PDF sur la page règlement communale via vs.ch
    const htmlUrl = `https://www.vs.ch/web/sipo/${communeId}-reglements`;
    const { data: html } = await axios_1.default.get(htmlUrl, { responseType: 'text' });
    const $ = cheerio.load(html);
    const pdfLink = $('a[href$=".pdf"]').first().attr('href');
    if (!pdfLink) {
        throw new Error('PDF du règlement non trouvé.');
    }
    const { data: pdfBuffer } = await axios_1.default.get(pdfLink, {
        responseType: 'arraybuffer',
    });
    // Lazy import de pdf-parse (ESM dynamic)
    const { default: pdfParse } = await Promise.resolve().then(() => __importStar(require('pdf-parse')));
    // pdf-parse attend un Buffer Node
    const { text } = await pdfParse(Buffer.from(pdfBuffer));
    cache[communeId] = text;
    return text;
}
