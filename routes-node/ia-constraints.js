const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createContextLogger } = require('../utils/logger');
const apiKeyManager = require('../utils/api-key-manager');
const { performComprehensiveAnalysis } = require('../dist/lib/parcelAnalysisOrchestrator');
const { performO3Analysis } = require('../dist/lib/o3AnalysisEngine');

const logger = createContextLogger('IA_CONSTRAINTS');

// Fonction helper pour obtenir l'icône selon la sévérité
function getIconForSeverity(severity) {
  const severityIcons = {
    'critical': '🚨',
    'high': '⚠️',
    'medium': '📋',
    'low': 'ℹ️'
  };
  return severityIcons[severity] || '📌';
}

// Service OpenAI simple
async function callOpenAI(prompt) {
  const apiKey = apiKeyManager.getKey('OPENAI_API_KEY');
  
  if (!apiKey || !apiKeyManager.validateOpenAI()) {
    throw new Error('Clé OpenAI manquante ou invalide');
  }

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en urbanisme suisse qui analyse les contraintes de construction pour une parcelle donnée. Tu réponds TOUJOURS et UNIQUEMENT en JSON valide, sans aucun formatage markdown, sans backticks, sans texte avant ou après le JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.2,
      response_format: { type: "json_object" }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15 secondes timeout
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    if (error.response?.status === 401) {
      logger.error('Clé OpenAI invalide');
      throw new Error('Clé OpenAI invalide - veuillez vérifier votre configuration');
    }
    throw error;
  }
}

// Analyse des contraintes simplifiée (version de fallback)
async function analyzeConstraints(searchQuery) {
  try {
    // Essayer avec OpenAI d'abord
    const prompt = `Analyse rapidement les contraintes d'urbanisme pour "${searchQuery}" en Valais, Suisse.

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après.

Fournis exactement 4 contraintes principales au format JSON suivant:
{
  "constraints": [
    {
      "title": "Zone d'affectation",
      "description": "Décris le type de zone probable (zone à bâtir d'habitation faible densité, zone mixte, zone centre, etc.) et ses implications",
      "severity": "medium",
      "source": "Règlement communal des constructions et des zones"
    },
    {
      "title": "Indice d'utilisation du sol (IBUS)",
      "description": "Indique l'IBUS probable (entre 0.3 et 1.0 selon la zone) et ce que cela signifie concrètement pour la construction",
      "severity": "high",
      "source": "Règlement de construction communal"
    },
    {
      "title": "Hauteur maximale et gabarits",
      "description": "Précise la hauteur maximale autorisée (en mètres et nombre d'étages) selon la zone",
      "severity": "medium",
      "source": "Plan d'affectation des zones"
    },
    {
      "title": "Distances et reculs",
      "description": "Indique les distances minimales aux limites de parcelle et entre bâtiments",
      "severity": "low",
      "source": "Règlement communal"
    }
  ],
  "summary": "Analyse des contraintes d'urbanisme principales pour ${searchQuery}. Ces informations sont basées sur les règlements types du canton du Valais."
}`;

    let result = await callOpenAI(prompt);
    
    // Nettoyer la réponse des backticks markdown si présents
    result = result.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    
    try {
      const parsed = JSON.parse(result);
      // S'assurer que les contraintes sont bien formatées
      if (parsed.constraints && Array.isArray(parsed.constraints)) {
        return {
          constraints: parsed.constraints.map(c => ({
            title: c.title || "Contrainte",
            description: c.description || "",
            severity: c.severity || "medium",
            source: c.source || "Analyse IA",
            icon: getIconForSeverity(c.severity || "medium")
          })),
          summary: parsed.summary || "Analyse des contraintes d'urbanisme"
        };
      }
      return parsed;
    } catch (parseError) {
      logger.warn('Parsing JSON échoué, extraction manuelle', { error: parseError.message });
      
      // Extraire les contraintes manuellement du texte
      const constraints = [];
      
      // Essayer d'extraire les zones d'affectation
      if (result.includes("zone") || result.includes("Zone")) {
        constraints.push({
          title: "Zone d'affectation",
          description: "Analyse de la zone d'affectation selon le règlement communal",
          severity: "medium",
          source: "Règlement communal",
          icon: "🏗️"
        });
      }
      
      // Essayer d'extraire les indices d'utilisation
      if (result.includes("IBUS") || result.includes("indice")) {
        constraints.push({
          title: "Indice d'utilisation (IBUS)",
          description: "Coefficient d'utilisation du sol applicable à la parcelle",
          severity: "high",
          source: "Règlement de construction",
          icon: "📊"
        });
      }
      
      // Ajouter une contrainte générale si aucune contrainte spécifique n'est trouvée
      if (constraints.length === 0) {
        constraints.push({
          title: "Analyse générale",
          description: "Contraintes d'urbanisme standards applicables selon le règlement communal",
          severity: "medium",
          source: "Analyse IA",
          icon: "📋"
        });
      }
      
      return {
        constraints,
        summary: "Analyse des contraintes basée sur l'extraction de texte"
      };
    }
  } catch (error) {
    logger.warn('OpenAI indisponible, utilisation de l\'analyse de fallback', { error: error.message });
    
    // Fallback : analyse basique basée sur le nom de commune
    return getFallbackAnalysis(searchQuery);
  }
}

// Analyse de fallback sans OpenAI
function getFallbackAnalysis(searchQuery) {
  const commune = extractCommune(searchQuery);
  
  return {
    constraints: [
      {
        title: "Zone d'affectation",
        description: `Analyse des contraintes pour ${commune}. Zone probablement d'habitat ou mixte selon le règlement communal.`,
        severity: "medium",
        source: "Analyse locale"
      },
      {
        title: "Indice d'utilisation",
        description: "IBUS typique entre 0.4 et 0.8 selon la zone d'affectation.",
        severity: "high",
        source: "Règlement de construction"
      },
      {
        title: "Hauteur maximale",
        description: "Hauteur généralement limitée à 2-3 étages selon la zone.",
        severity: "medium",
        source: "Prescriptions communales"
      },
      {
        title: "Reculs obligatoires",
        description: "Reculs minimum requis par rapport aux limites de parcelle.",
        severity: "low",
        source: "Règlement communal"
      }
    ],
    summary: `Analyse des contraintes principales pour ${commune}. Consultez le règlement communal pour les détails spécifiques.`
  };
}

// Extraire le nom de commune de la recherche
function extractCommune(searchQuery) {
  const communes = ['Sion', 'Martigny', 'Monthey', 'Sierre', 'Vétroz', 'Conthey', 'Savièse', 'Fully', 'Riddes', 'Saxon', 'Leytron', 'Chamoson', 'Ardon', 'Nendaz', 'Ayent'];
  
  for (const commune of communes) {
    if (searchQuery.toLowerCase().includes(commune.toLowerCase())) {
      return commune;
    }
  }
  
  return searchQuery || 'Valais';
}

// Route principale pour l'analyse IA avancée avec o3
router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { searchQuery, analysisType = 'comprehensive' } = req.body;
    
    logger.info('Nouvelle demande d\'analyse IA o3', { 
      searchQuery, 
      analysisType,
      ip: req.ip 
    });

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Le paramètre searchQuery est requis'
      });
    }

    // Vérifier la clé OpenAI
    if (!apiKeyManager.isConfigured('OPENAI_API_KEY')) {
      return res.status(503).json({
        success: false,
        error: 'Service d\'analyse IA temporairement indisponible',
        details: 'Clé API OpenAI non configurée'
      });
    }

    // Étape 1: Analyse complète de la parcelle
    logger.info('Début analyse complète de parcelle...');
    const parcelData = await performComprehensiveAnalysis(searchQuery);
    
    // Étape 2: Analyse o3 avancée avec double niveau
    logger.info('Début analyse o3 avancée...');
    const o3Result = await performO3Analysis(parcelData);

    const duration = Date.now() - startTime;
    
    logger.info('Analyse o3 terminée avec succès', {
      searchQuery,
      duration: `${duration}ms`,
      constraintsCount: o3Result.constraints?.length || 0,
      confidence: o3Result.confidence
    });

    // Formater la réponse pour le front-end existant
    res.json({
      success: true,
      data: {
        // Format compatible avec le front-end actuel
        constraints: o3Result.constraints.map(c => ({
          title: c.title,
          description: c.description,
          severity: c.severity,
          source: c.source,
          icon: getIconForCategory(c.category),
          details: {
            zone: c.zone,
            values: c.values,
            requirements: c.requirements,
            impact: c.impact,
            confidence: c.confidence,
            reasoning: c.reasoning
          }
        })),
        summary: o3Result.summary.executive, // Résumé exécutif pour affichage principal
        
        // Données enrichies o3
        analysis: {
          technical: o3Result.summary.technical,
          practical: o3Result.summary.practical,
          zoneInfo: o3Result.zoneAnalysis,
          calculations: o3Result.calculations,
          recommendations: o3Result.recommendations,
          risks: o3Result.risks,
          opportunities: o3Result.opportunities,
          nextSteps: o3Result.nextSteps
        },
        
        // Informations parcelle
        parcel: {
          address: parcelData.searchResult?.number || searchQuery,
          commune: parcelData.searchResult?.municipality || parcelData.parcelDetails?.municipality || "À déterminer",
          egrid: parcelData.searchResult?.egrid || "Non disponible",
          surface: parcelData.parcelDetails?.surface || 0,
          zone: o3Result.zoneAnalysis.mainZone,
          model_used: "o3/gpt-4o"
        }
      },
      metadata: {
        analysisType: 'o3_advanced',
        duration,
        confidence: o3Result.confidence,
        processingMetrics: o3Result.processingMetrics,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Erreur lors de l\'analyse IA o3', {
      error: error.message,
      duration: `${duration}ms`,
      stack: error.stack
    });

    // Fallback vers l'analyse simple en cas d'erreur
    try {
      logger.info('Tentative fallback vers analyse simple...');
      const fallbackResult = await analyzeConstraints(req.body.searchQuery);
      
      res.json({
        success: true,
        data: {
          constraints: fallbackResult.constraints || [],
          summary: fallbackResult.summary || '',
          parcel: {
            address: req.body.searchQuery,
            commune: "À déterminer",
            model_used: "gpt-4o-mini (fallback)"
          }
        },
        metadata: {
          analysisType: 'fallback',
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          warning: 'Analyse avancée indisponible, résultats simplifiés'
        }
      });
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse des contraintes',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// Fonction helper pour les icônes
function getIconForCategory(category) {
  const iconMap = {
    'zone_affectation': '🏗️',
    'gabarits_hauteurs': '📏',
    'reculs_distances': '↔️',
    'densité_ibus': '📊',
    'stationnement': '🚗',
    'toiture_architecture': '🏠',
    'espaces_verts': '🌳',
    'contraintes_environnementales': '🌍',
    'prescriptions_architecturales': '🎨',
    'procédures_administratives': '📋'
  };
  return iconMap[category] || '📌';
}

// Route pour analyse rapide
router.post('/quick', async (req, res) => {
  req.body.analysisType = 'quick';
  return router.handle(req, res);
});

// Route de test
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Service d\'analyse IA opérationnel',
    openaiConfigured: apiKeyManager.isConfigured('OPENAI_API_KEY'),
    apiKeyValid: apiKeyManager.validateOpenAI()
  });
});

module.exports = router;