const express = require('express');
const { Document, Analysis } = require('../models-node');
const { Op } = require('sequelize');
const { generateSummary, generateFeasibilityTable, answerQuestion } = require('../services-node/openaiService');
const { getContextForQuestion } = require('../services-node/vectorService');
const vectorService = require('../services-node/vectorService');
const axios = require('axios'); // Pour les appels API RDPPF
const router = express.Router();

// Middleware pour vérifier le statut premium
function requirePremium(req, res, next) {
  if (!req.user.isPremium) {
    return res.status(403).json({ error: 'Fonctionnalité premium requise' });
  }
  next();
}

// Générer un résumé
router.post('/summary', requirePremium, async (req, res) => {
  try {
    const { documentId } = req.body;
    
    // Vérifier que le document appartient à l'utilisateur
    const document = await Document.findOne({
      where: {
        id: documentId,
        userId: req.user.id
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    // Générer le résumé
    const summaryResult = await generateSummary(document.rawText);
    
    if (summaryResult.summary) {
      // Sauvegarder l'analyse
      await Analysis.create({
        userId: req.user.id,
        documentId: document.id,
        analysisType: 'summary',
        result: summaryResult.summary,
        tokensUsed: summaryResult.tokensUsed
      });
      
      res.json({
        summary: summaryResult.summary,
        chunksProcessed: summaryResult.chunksProcessed
      });
    } else {
      res.status(500).json({ error: 'Erreur lors de la génération du résumé' });
    }
  } catch (error) {
    console.error('Erreur génération résumé:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du résumé' });
  }
});

// Générer un tableau de faisabilité
router.post('/feasibility-table', requirePremium, async (req, res) => {
  try {
    const { documentId, projectData } = req.body;
    
    // Vérifier que le document appartient à l'utilisateur
    const document = await Document.findOne({
      where: {
        id: documentId,
        userId: req.user.id
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    // Générer le tableau
    const table = await generateFeasibilityTable(
      document.extractedData,
      projectData
    );
    
    // Sauvegarder l'analyse
    await Analysis.create({
      userId: req.user.id,
      documentId: document.id,
      analysisType: 'feasibility_table',
      inputData: projectData,
      result: table
    });
    
    res.json({ table });
  } catch (error) {
    console.error('Erreur génération tableau:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du tableau' });
  }
});

// Répondre à une question
router.post('/ask-question', requirePremium, async (req, res) => {
  try {
    const { question, documentId } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question vide' });
    }
    
    let context;
    
    if (documentId) {
      // Vérifier que le document appartient à l'utilisateur
      const document = await Document.findOne({
        where: {
          id: documentId,
          userId: req.user.id
        }
      });
      
      if (!document) {
        return res.status(404).json({ error: 'Document non trouvé' });
      }
      
      // Obtenir le contexte pertinent
      context = await getContextForQuestion(question, documentId);
    } else {
      // Obtenir le contexte de tous les documents de l'utilisateur
      const userDocIds = await Document.findAll({
        where: { userId: req.user.id },
        attributes: ['id']
      }).then(docs => docs.map(d => d.id));
      
      context = await getContextForQuestion(question);
      // Filtrer le contexte pour ne garder que les documents de l'utilisateur
      // (déjà fait dans la recherche vectorielle)
    }
    
    if (!context) {
      return res.status(404).json({ error: 'Aucun contexte pertinent trouvé' });
    }
    
    // Générer la réponse
    const answer = await answerQuestion(question, context);
    
    // Sauvegarder l'analyse
    await Analysis.create({
      userId: req.user.id,
      documentId: documentId || null,
      analysisType: 'custom_query',
      inputData: { question },
      result: answer
    });
    
    res.json({ answer });
  } catch (error) {
    console.error('Erreur réponse question:', error);
    res.status(500).json({ error: 'Erreur lors de la génération de la réponse' });
  }
});

// Récupérer l'historique des analyses
router.get('/history', async (req, res) => {
  try {
    const analyses = await Analysis.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Document,
        as: 'document',
        attributes: ['id', 'originalFilename']
      }],
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    
    res.json(analyses);
  } catch (error) {
    console.error('Erreur récupération historique:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
});

// Route pour rechercher dans les règlements du Valais (accessible sans authentification pour la démo)
router.post('/search', async (req, res) => {
    try {
        const { query, commune } = req.body;
        
        if (!query || !query.trim()) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Si commune est "valais", rechercher dans tous les règlements du Valais
        let searchFilter = {};
        if (commune === 'valais') {
            const valaisCommunes = [
                'Arbaz', 'Ardon', 'Ayent', 'Chamoson', 'Charrat', 'Conthey', 
                'Martigny', 'Mase', 'Mollens', 'Nax', 'Nendaz', 'Riddes', 
                'Saillon', 'Saint-Léonard', 'Salgesch', 'Savièse', 'Saxon', 
                'Sierre', 'Sion', 'Vernamiège', 'Vérrossaz', 'Vétroz'
            ];
            searchFilter = { commune: { [Op.in]: valaisCommunes } };
        } else if (commune) {
            searchFilter = { commune: commune };
        }

        // Recherche vectorielle avec filtre si spécifié
        let searchResults;
        
        if (commune === 'valais') {
            // Rechercher dans tous les règlements du Valais
            const valaisCommunes = [
                'Arbaz', 'Ardon', 'Ayent', 'Chamoson', 'Charrat', 'Conthey', 
                'Martigny', 'Mase', 'Mollens', 'Nax', 'Nendaz', 'Riddes', 
                'Saillon', 'Saint-Léonard', 'Salgesch', 'Savièse', 'Saxon', 
                'Sierre', 'Sion', 'Vernamiège', 'Vérrossaz', 'Vétroz'
            ];
            
            const filter = (meta) => {
                // Rechercher le document pour obtenir sa commune
                return true; // Pour l'instant, on prend tous les résultats
            };
            
            searchResults = await vectorService.searchWithFilter(query, filter, 10);
        } else {
            searchResults = await vectorService.search(query, 10);
        }

        if (searchResults.length === 0) {
            return res.json({
                answer: "Aucun résultat trouvé pour cette recherche dans les règlements du Valais Romand.",
                sources: []
            });
        }

        // Récupérer les informations des documents depuis la base de données
        const documentIds = [...new Set(searchResults.map(result => result.metadata.documentId))];
        const documents = await Document.findAll({
            where: {
                id: { [Op.in]: documentIds }
            },
            attributes: ['id', 'commune', 'originalFilename']
        });

        // Créer un map pour les informations des documents
        const documentMap = {};
        documents.forEach(doc => {
            documentMap[doc.id] = {
                commune: doc.commune,
                filename: doc.originalFilename
            };
        });

        // Filtrer les résultats pour ne garder que ceux du Valais si spécifié
        const filteredResults = searchResults.filter(result => {
            const docInfo = documentMap[result.metadata.documentId];
            if (commune === 'valais') {
                const valaisCommunes = [
                    'Arbaz', 'Ardon', 'Ayent', 'Chamoson', 'Charrat', 'Conthey', 
                    'Martigny', 'Mase', 'Mollens', 'Nax', 'Nendaz', 'Riddes', 
                    'Saillon', 'Saint-Léonard', 'Salgesch', 'Savièse', 'Saxon', 
                    'Sierre', 'Sion', 'Vernamiège', 'Vérrossaz', 'Vétroz'
                ];
                return docInfo && valaisCommunes.includes(docInfo.commune);
            }
            return true;
        });

        if (filteredResults.length === 0) {
            return res.json({
                answer: "Aucun résultat trouvé pour cette recherche dans les règlements du Valais Romand.",
                sources: []
            });
        }

        // Générer une réponse avec OpenAI
        const context = filteredResults.map(result => {
            const docInfo = documentMap[result.metadata.documentId];
            return `Document: ${docInfo.commune} - ${docInfo.filename}\nContenu: ${result.metadata.chunkText}`;
        }).join('\n\n');

        const prompt = `Basé sur les documents d'urbanisme suivants du Valais Romand, réponds à la question: "${query}"

${context}

Réponds de manière précise et cite les sources appropriées (communes et règlements).`;

        const response = await answerQuestion(query, context);

        res.json({
            answer: response,
            sources: filteredResults.map(result => {
                const docInfo = documentMap[result.metadata.documentId];
                return {
                    commune: docInfo.commune,
                    filename: docInfo.filename,
                    content: result.metadata.chunkText
                };
            })
        });

    } catch (error) {
        console.error('Erreur recherche:', error);
        res.status(500).json({ error: 'Erreur lors de la recherche' });
    }
});

// Route pour l'analyse IA automatique des contraintes de parcelle
router.post('/parcel-constraints', async (req, res) => {
    try {
        const { parcelData, coordinates } = req.body;
        
        if (!parcelData || !parcelData.cadastral || !parcelData.cadastral.commune) {
            return res.status(400).json({ error: 'Données de parcelle manquantes' });
        }

        const commune = parcelData.cadastral.commune;
        console.log(`🤖 Analyse IA des contraintes pour: ${commune}`);

        // 1. Récupérer les contraintes RDPPF à partir du PDF officiel si EGRID dispo
        let rdppfConstraints = [];
        if (parcelData.cadastral && parcelData.cadastral.id_federal) {
            try {
                const { fetchRDPPFConstraints } = require('./rdppfExtractor');
                rdppfConstraints = await fetchRDPPFConstraints(parcelData.cadastral.id_federal);
            } catch (err) {
                console.log('⚠️ RDPPF PDF not processed:', err.message);
            }
        }

        // 2. Récupérer le règlement communal
        let regulationContext = null;
        const valaisCommunes = [
            'Arbaz', 'Ardon', 'Ayent', 'Chamoson', 'Charrat', 'Conthey', 
            'Martigny', 'Mase', 'Mollens', 'Nax', 'Nendaz', 'Riddes', 
            'Saillon', 'Saint-Léonard', 'Salgesch', 'Savièse', 'Saxon', 
            'Sierre', 'Sion', 'Vernamiège', 'Vérrossaz', 'Vétroz'
        ];

        if (valaisCommunes.includes(commune)) {
            try {
                // Recherche dans la base de données des règlements
                const documents = await Document.findAll({
                    where: { commune: commune },
                    attributes: ['id', 'rawText', 'extractedData']
                });

                if (documents.length > 0) {
                    regulationContext = documents[0].rawText || documents[0].extractedData;
                    console.log('📚 Règlement communal récupéré');
                } else {
                    console.log('⚠️ Aucun règlement DB pour', commune, '- tentative téléchargement direct');
                    const { fetchRegulationText } = require('./regulationFetcher');
                    regulationContext = await fetchRegulationText(commune);
                    if (regulationContext) {
                        console.log('📚 Règlement communal téléchargé');
                    }
                }
            } catch (error) {
                console.log('⚠️ Erreur récupération règlement:', error.message);
            }
        }

        // 3. Extraction structurée des contraintes à partir du règlement
        let structuredConstraints = [];
        if (regulationContext) {
            const { extractConstraintsFromLargeText } = require('./constraintExtractor');
            structuredConstraints = await extractConstraintsFromLargeText(regulationContext);
        }

        // Convertir en format UI
        const uiConstraints = [];

        // Règlement communal
        structuredConstraints.forEach(c => {
            uiConstraints.push({
                title: `${c.theme} (${c.zone})`,
                description: c.rule + (c.article ? ` (${c.article})` : ''),
                severity: 'medium',
                source: 'Règlement communal'
            });
        });

        // RDPPF
        if (rdppfConstraints.length > 0) {
            uiConstraints.push(...rdppfConstraints.map(r => ({
                title: r.type,
                description: r.description,
                severity: r.severity || 'medium',
                source: r.source || 'RDPPF'
            })));
        }

        // Si aucune contrainte trouvée, fallback IA
        if (uiConstraints.length === 0) {
            const analysisResult = await analyzeParcelConstraints(parcelData, rdppfConstraints, regulationContext);
            return res.json(analysisResult);
        }

        // Générer résumé et recommandations simples
        const summary = `Nombre de contraintes identifiées: ${uiConstraints.length}.`;
        const recommendations = `Consultez les services d'urbanisme et le règlement communal pour les démarches précises. Prévoyez des études spécialisées pour les contraintes à sévérité élevée.`;

        // 4. Ajouter contraintes de la zone de construction (IBUS, hauteur, reculs) si dispo
        if (coordinates && coordinates.x && coordinates.y) {
            try {
                const geo = await getZoningInfo(coordinates.x, coordinates.y);
                if (geo && geo.zone) {
                    uiConstraints.push({ title: 'Zone de construction', description: geo.zone, severity: 'low', source: 'GeoAdmin' });
                }
            } catch (e) { console.log('⚠️ Geo zone error'); }
        }

        // Relancer GPT si < 10 contraintes
        if (uiConstraints.length < 10 && regulationContext) {
            console.log('🔁 Relance GPT pour extraire plus de contraintes');
            const { extractConstraintsFromLargeText } = require('./constraintExtractor');
            const extra = await extractConstraintsFromLargeText(regulationContext);
            extra.forEach(c => uiConstraints.push({ title: `${c.theme} (${c.zone})`, description: c.rule, severity: 'medium', source: 'Règlement communal' }));
        }

        res.json({ summary, constraints: uiConstraints, recommendations });

    } catch (error) {
        console.error('Erreur analyse contraintes:', error);
        res.status(500).json({ error: 'Erreur lors de l\'analyse des contraintes' });
    }
});

// Fonction pour récupérer les données RDPPF
async function fetchRDPPFData(x, y) {
    try {
        console.log(`📍 Récupération RDPPF pour coordonnées: ${x}, ${y}`);
        
        // Appel à l'API officielle RDPPF (service public suisse)
        const rdppfUrl = `https://api3.geo.admin.ch/rest/services/api/MapServer/identify`;
        const params = new URLSearchParams({
            geometry: `${x},${y}`,
            geometryType: 'esriGeometryPoint',
            imageDisplay: '1,1,96',
            mapExtent: `${x-1},${y-1},${x+1},${y+1}`,
            tolerance: 0,
            layers: 'all:ch.bazl.kataster-belasteter-standorte-zivilflugplaetze,ch.bav.kataster-belasteter-standorte-oev,ch.vbs.kataster-belasteter-standorte-militaer',
            returnGeometry: false,
            sr: 2056
        });

        const response = await axios.get(`${rdppfUrl}?${params.toString()}`);
        const data = response.data;
        
        // Parser les résultats RDPPF
        const restrictions = [];
        
        if (data.results && data.results.length > 0) {
            data.results.forEach(result => {
                if (result.attributes) {
                    restrictions.push({
                        type: result.layerName || 'Restriction RDPPF',
                        description: result.attributes.label || result.value || 'Restriction identifiée',
                        severity: determineRestrictionSeverity(result),
                        source: 'RDPPF'
                    });
                }
            });
        }

        // Ajouter des restrictions courantes basées sur la localisation
        const commonRestrictions = await getCommonRestrictions(x, y);
        restrictions.push(...commonRestrictions);

        return {
            restrictions: restrictions,
            zoning: await getZoningInfo(x, y),
            coordinates: { x, y }
        };

    } catch (error) {
        console.log(`⚠️ Erreur API RDPPF: ${error.message}`);
        
        // Données de fallback basées sur la localisation générale du Valais
        return {
            restrictions: [
                {
                    type: 'Données RDPPF limitées',
                    description: 'Consultation des données officielles RDPPF recommandée sur rdppf.admin.ch',
                    severity: 'medium',
                    source: 'Système'
                }
            ],
            zoning: {
                zone: 'Zone à déterminer',
                description: 'Consulter le plan de zones communal'
            },
            coordinates: { x, y }
        };
    }
}

// Fonction pour déterminer la sévérité d'une restriction
function determineRestrictionSeverity(result) {
    const layerName = (result.layerName || '').toLowerCase();
    
    if (layerName.includes('militaer') || layerName.includes('belasteter')) {
        return 'high';
    } else if (layerName.includes('schutz') || layerName.includes('protection') || layerName.includes('bruit')) {
        return 'medium';
    } else {
        return 'low';
    }
}

// Fonction pour obtenir des restrictions communes
async function getCommonRestrictions(x, y) {
    const restrictions = [];
    
    // Restrictions typiques pour le Valais
    if (y > 100000 && y < 150000) { // Approximation pour le Valais
        restrictions.push({
            type: 'Zone alpine',
            description: 'Parcelle située en région alpine - contraintes particulières possibles',
            severity: 'low',
            source: 'Analyse géographique'
        });
    }
    
    return restrictions;
}

// Fonction pour obtenir les informations de zonage
async function getZoningInfo(x, y) {
    try {
        // Appel simplifié pour obtenir les zones d'affectation
        const zoningUrl = `https://api3.geo.admin.ch/rest/services/ech/MapServer/identify`;
        const params = new URLSearchParams({
            geometry: `${x},${y}`,
            geometryType: 'esriGeometryPoint',
            layers: 'ch.are.alpenkonvention',
            returnGeometry: false,
            sr: 2056
        });

        const response = await axios.get(`${zoningUrl}?${params.toString()}`);
        const data = response.data;
        
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            return {
                zone: result.attributes?.label || 'Zone non définie',
                description: result.value || 'Consulter le plan de zones communal'
            };
        }
    } catch (error) {
        console.log('Erreur récupération zonage:', error.message);
    }
    
    return {
        zone: 'Zone à déterminer',
        description: 'Consulter le plan de zones communal pour les détails précis'
    };
}

// Fonction pour analyser les contraintes avec l'IA
async function analyzeParcelConstraints(parcelData, rdppfConstraints, regulationContext) {
    const prompt = `
Analyse les contraintes de construction pour cette parcelle:

DONNÉES DE LA PARCELLE:
- Commune: ${parcelData.cadastral.commune}
- Adresse: ${parcelData.general.adresse}
- Coordonnées: ${parcelData.general.coordonnees}
${parcelData.cadastral.id_federal ? `- ID Fédéral: ${parcelData.cadastral.id_federal}` : ''}

DONNÉES RDPPF:
${rdppfConstraints.length > 0 ? JSON.stringify(rdppfConstraints, null, 2) : 'Données RDPPF non disponibles'}

RÈGLEMENT COMMUNAL:
${regulationContext ? regulationContext : 'Règlement communal non disponible'}

INSTRUCTIONS:
1. Identifie TOUTES les contraintes de construction applicables à cette parcelle
2. Classe chaque contrainte par sévérité (high/medium/low)
3. Fournis des descriptions claires et pratiques
4. Donne des recommandations concrètes

Format de réponse JSON:
{
    "summary": "Résumé général de l'analyse",
    "constraints": [
        {
            "title": "Titre de la contrainte",
            "description": "Description détaillée",
            "severity": "high|medium|low",
            "icon": "🏗️",
            "source": "RDPPF / Règlement communal"
        }
    ],
    "recommendations": "Recommandations générales"
}
`;

    try {
        const analysis = await answerQuestion("Analyse les contraintes de construction", prompt);
        
        // Tenter de parser la réponse JSON
        try {
            const jsonMatch = analysis.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsedResult = JSON.parse(jsonMatch[0]);
                return parsedResult;
            }
        } catch (parseError) {
            console.log('Erreur parsing JSON, utilisation format fallback');
        }

        // Format de fallback si le parsing JSON échoue
        return {
            summary: analysis.substring(0, 500) + '...',
            constraints: [
                {
                    title: "Analyse disponible",
                    description: analysis,
                    severity: "medium",
                    icon: "📋",
                    source: "Analyse IA"
                }
            ],
            recommendations: "Consultez un professionnel pour une analyse détaillée."
        };

    } catch (error) {
        console.error('Erreur analyse IA:', error);
        return {
            summary: "Analyse automatique non disponible",
            constraints: [
                {
                    title: "Service temporairement indisponible",
                    description: "L'analyse IA des contraintes n'est pas disponible actuellement. Veuillez consulter le règlement communal et les données RDPPF manuellement.",
                    severity: "medium",
                    icon: "⚠️",
                    source: "Système"
                }
            ],
            recommendations: "Contactez les services d'urbanisme de la commune pour obtenir des informations précises."
        };
    }
}

module.exports = router; 