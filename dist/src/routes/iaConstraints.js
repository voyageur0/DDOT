"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const perf_hooks_1 = require("perf_hooks");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
// Clé OpenAI depuis variable d'environnement uniquement
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    console.error('❌ ERREUR CRITIQUE: OPENAI_API_KEY manquante dans les variables d\'environnement');
    console.error('📝 Créez un fichier .env avec OPENAI_API_KEY=sk-votre-cle-api');
}
// Test de la clé API au démarrage
async function testOpenAIConnection() {
    if (!OPENAI_API_KEY) {
        console.log('⚠️ OpenAI désactivé - clé API manquante');
        return false;
    }
    try {
        const response = await axios_1.default.post('https://api.openai.com/v1/models', {}, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        console.log('✅ OpenAI connecté avec succès');
        return true;
    }
    catch (error) {
        console.error('❌ Erreur de connexion OpenAI:', error.response?.status, error.response?.statusText);
        if (error.response?.status === 401) {
            console.error('🔑 Clé API OpenAI invalide ou expirée');
        }
        return false;
    }
}
// Test au démarrage du module
testOpenAIConnection();
// Fonction d'appel à OpenAI SIMPLIFIÉE - vraies connaissances uniquement
async function callOpenAISimple(userQuery, communeData, parcelData) {
    console.log('🚀 🤖 Appel OpenAI avec vraies connaissances');
    try {
        console.log('🎯 Envoi requête OpenAI...');
        const response = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Tu es un expert urbaniste spécialisé dans les règlements du canton du Valais, Suisse. 

MISSION: Fournir une analyse précise et factuelle d'une parcelle cadastrale valaisanne.

CONSIGNES STRICTES:
- Utilise UNIQUEMENT tes vraies connaissances des règlements valaisans
- Ne pas inventer de données chiffrées spécifiques
- Baser l'analyse sur les vrais principes d'urbanisme du Valais
- Mentionner les vraies références légales (LAT, LCAT, règlements communaux)
- Identifier les vraies procédures administratives
- Donner des ordres de grandeur réalistes pour le Valais

DONNÉES RÉELLES À ANALYSER:
Commune: ${communeData.commune}
Coordonnées: ${communeData.coordinates} 
Adresse: ${communeData.address}
Parcelle: ${parcelData.parcelId}

FORMAT ATTENDU:
1. Identification de la commune et zone probable
2. Règlements applicables (références réelles)
3. Contraintes d'urbanisme typiques du Valais
4. Procédures administratives réelles
5. Recommandations pratiques

IMPORTANT: Sois précis mais prudent - indique quand une vérification officielle est nécessaire.`
                },
                {
                    role: 'user',
                    content: userQuery
                }
            ],
            max_tokens: 3000,
            temperature: 0.1
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        const expertAnalysis = response.data.choices[0].message.content;
        console.log(`✅ Analyse OpenAI reçue: ${expertAnalysis.length} caractères`);
        return expertAnalysis;
    }
    catch (error) {
        console.error('💥 ERREUR OPENAI DÉTAILLÉE:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            message: error.message,
            data: error.response?.data,
            timeout: error.code === 'ECONNABORTED' ? 'Timeout dépassé' : 'Non',
            api_key_present: !!OPENAI_API_KEY,
            api_key_format: OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 7)}...${OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4)}` : 'Absente'
        });
        // Message d'erreur détaillé pour débuggage
        let errorMsg = `Erreur OpenAI`;
        if (!OPENAI_API_KEY) {
            errorMsg += ` - Clé API manquante dans les variables d'environnement`;
        }
        else if (error.response?.status === 401) {
            errorMsg += ` - Clé API invalide ou expirée (${OPENAI_API_KEY.substring(0, 7)}...${OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4)})`;
        }
        else if (error.response?.status === 429) {
            errorMsg += ` - Limite de taux dépassée (trop de requêtes)`;
        }
        else if (error.response?.status === 500) {
            errorMsg += ` - Erreur serveur OpenAI`;
        }
        else if (error.code === 'ECONNABORTED') {
            errorMsg += ` - Timeout (>30s)`;
        }
        else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorMsg += ` - Problème de connexion réseau`;
        }
        throw new Error(`${errorMsg}: ${error.response?.data?.error?.message || error.message}`);
    }
}
router.post('/ia-constraints', async (req, res, next) => {
    try {
        console.log('📞 Requête IA reçue:', req.body);
        const { coordinates, address, commune, parcelId } = req.body;
        if (!coordinates) {
            return res.status(400).json({ error: 'Coordonnées manquantes' });
        }
        // 🚀 IA OpenAI PURE avec vraies connaissances - AUCUNE donnée fictive
        try {
            console.log(`🤖 Lancement analyse OpenAI PURE pour ${commune || 'la commune'}...`);
            const t0 = perf_hooks_1.performance.now();
            // Données réelles uniquement
            const communeData = {
                commune: commune || 'Commune à identifier',
                coordinates: coordinates,
                address: address
            };
            const parcelData = {
                address: address || coordinates,
                parcelId: parcelId || 'Non spécifié',
                coordinates: coordinates
            };
            // Appel IA OpenAI avec prompt simplifié pour vraies données
            const userQuery = `Analyse cette parcelle cadastrale au Valais, Suisse. Utilise tes vraies connaissances sur l'urbanisme valaisan, les règlements en vigueur et les données officielles. Fournis une analyse précise et factuelle basée sur les règlements réels.
      
      Commune: ${commune || 'À identifier via coordonnées'}
      Adresse: ${address || 'À déterminer'}
      Coordonnées: ${coordinates}
      Parcelle: ${parcelId || 'À identifier'}
      
      IMPORTANT: Utilise uniquement tes vraies connaissances des règlements valaisans officiels, pas de données inventées.`;
            const openaiAnalysis = await callOpenAISimple(userQuery, communeData, parcelData);
            const elapsedMs = perf_hooks_1.performance.now() - t0;
            console.log(`✅ 🤖 Analyse OpenAI PURE terminée en ${Math.round(elapsedMs)}ms`);
            res.json({
                constraints: openaiAnalysis,
                elapsedMs: Math.round(elapsedMs),
                commune: commune || 'À identifier',
                source: 'OpenAI GPT-4o-mini avec vraies connaissances'
            });
        }
        catch (openaiError) {
            console.log('❌ Erreur OpenAI:', openaiError.message);
            // Pas de fallback avec données fictives - retourner l'erreur
            res.status(500).json({
                error: 'Service d\'analyse temporairement indisponible',
                message: 'OpenAI est requis pour l\'analyse. Vérifiez votre clé API.',
                technical_error: openaiError.message
            });
        }
    }
    catch (err) {
        console.error('❌ Erreur dans l\'API IA:', err);
        next(err);
    }
});
module.exports = router;
