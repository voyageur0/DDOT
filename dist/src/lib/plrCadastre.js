"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlrData = getPlrData;
exports.downloadPdf = downloadPdf;
exports.downloadRdppfExtract = downloadRdppfExtract;
exports.summarizePlrRestrictions = summarizePlrRestrictions;
const axios_1 = __importDefault(require("axios"));
const PLR_ENDPOINT = 'https://api3.geo.admin.ch/plr/v2';
/**
 * Récupère toutes les restrictions PLR pour une parcelle donnée
 */
async function getPlrData(egrid) {
    try {
        console.log(`📋 Récupération PLR pour EGRID: ${egrid}`);
        const { data } = await axios_1.default.get(`${PLR_ENDPOINT}/parcels/${egrid}`, {
            params: {
                lang: 'fr',
                flavour: 'FULL',
                format: 'json'
            },
            timeout: 20000
        });
        if (!data) {
            console.log('❌ Aucune donnée PLR trouvée');
            return null;
        }
        const restrictions = [];
        const pdfUrls = [];
        // Parser les restrictions par thème
        if (data.RealEstate?.RestrictionOnLandownership) {
            for (const restriction of data.RealEstate.RestrictionOnLandownership) {
                const topic = restriction.Topic;
                const authority = restriction.ResponsibleOffice?.Name?.Text || 'Autorité non spécifiée';
                // Extraire les géométries et leurs textes juridiques
                if (restriction.Geometry) {
                    for (const geometry of restriction.Geometry) {
                        if (geometry.LegalProvisions) {
                            for (const provision of geometry.LegalProvisions) {
                                restrictions.push({
                                    topic: topic?.Code || 'Topic inconnu',
                                    type: restriction.TypeCode || '',
                                    subtype: restriction.SubtypeCode,
                                    status: restriction.LawStatus?.Code || 'unknown',
                                    lawStatus: restriction.LawStatus?.Text?.Text || '',
                                    authority,
                                    text: provision.Text?.Text || provision.Title?.Text || 'Texte non disponible',
                                    symbol: restriction.Symbol
                                });
                                // Collecter les URLs des documents
                                if (provision.DocumentLinks) {
                                    for (const link of provision.DocumentLinks) {
                                        if (link.Document?.TextAtWeb?.Text) {
                                            pdfUrls.push(link.Document.TextAtWeb.Text);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        console.log(`✅ PLR récupéré: ${restrictions.length} restrictions, ${pdfUrls.length} documents`);
        return {
            egrid,
            municipality: data.RealEstate?.Municipality || '',
            restrictions,
            pdfUrls: [...new Set(pdfUrls)], // Supprimer les doublons
            extractUrl: data.GeneralInformation?.ExtractIdentifier ?
                `${PLR_ENDPOINT}/extract/reduced/pdf/${data.GeneralInformation.ExtractIdentifier}` : undefined
        };
    }
    catch (error) {
        console.error('❌ Erreur récupération PLR:', error);
        return null;
    }
}
/**
 * Télécharge un PDF depuis une URL
 */
async function downloadPdf(url) {
    try {
        console.log(`📄 Téléchargement PDF: ${url}`);
        const { data } = await axios_1.default.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'Accept': 'application/pdf'
            }
        });
        console.log(`✅ PDF téléchargé: ${data.length} bytes`);
        return Buffer.from(data);
    }
    catch (error) {
        console.error(`❌ Erreur téléchargement PDF ${url}:`, error);
        return null;
    }
}
/**
 * Récupère l'extrait RDPPF officiel complet en PDF
 */
async function downloadRdppfExtract(egrid) {
    try {
        console.log(`📑 Téléchargement extrait RDPPF pour: ${egrid}`);
        // D'abord obtenir l'URL de l'extrait
        const { data: metaData } = await axios_1.default.get(`${PLR_ENDPOINT}/parcels/${egrid}`, {
            params: {
                lang: 'fr',
                flavour: 'REDUCED',
                format: 'json'
            },
            timeout: 15000
        });
        if (!metaData?.GeneralInformation?.ExtractIdentifier) {
            console.log('❌ Pas d\'identifiant d\'extrait trouvé');
            return null;
        }
        const extractId = metaData.GeneralInformation.ExtractIdentifier;
        const pdfUrl = `${PLR_ENDPOINT}/extract/reduced/pdf/${extractId}`;
        return await downloadPdf(pdfUrl);
    }
    catch (error) {
        console.error('❌ Erreur téléchargement extrait RDPPF:', error);
        return null;
    }
}
/**
 * Analyse et résume les restrictions PLR
 */
function summarizePlrRestrictions(restrictions) {
    if (!restrictions.length) {
        return "Aucune restriction PLR identifiée.";
    }
    const byTopic = {};
    restrictions.forEach(r => {
        if (!byTopic[r.topic])
            byTopic[r.topic] = [];
        byTopic[r.topic].push(r);
    });
    let summary = `### RESTRICTIONS DE DROIT PUBLIC (PLR) - ${restrictions.length} restriction(s)\n\n`;
    for (const [topic, topicRestrictions] of Object.entries(byTopic)) {
        summary += `#### ${topic}\n`;
        const authorities = [...new Set(topicRestrictions.map(r => r.authority))];
        summary += `**Autorité(s):** ${authorities.join(', ')}\n\n`;
        topicRestrictions.forEach((restriction, i) => {
            summary += `${i + 1}. **${restriction.lawStatus}**\n`;
            summary += `   ${restriction.text}\n`;
            if (restriction.type) {
                summary += `   *Type: ${restriction.type}${restriction.subtype ? ` - ${restriction.subtype}` : ''}*\n`;
            }
            summary += '\n';
        });
    }
    return summary;
}
