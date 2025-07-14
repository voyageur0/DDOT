const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createContextLogger } = require('../utils/logger');

const logger = createContextLogger('IA_CONSTRAINTS');

// Service OpenAI simple
async function callOpenAI(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Clé OpenAI manquante');
  }

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'Tu es un expert en urbanisme suisse qui analyse les contraintes de construction pour une parcelle donnée.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 1500,
    temperature: 0.3
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices[0].message.content;
}

// Analyse des contraintes simplifiée
async function analyzeConstraints(searchQuery) {
  try {
    const prompt = `Analyse les contraintes d'urbanisme pour cette recherche: "${searchQuery}"
    
Fournis une analyse structurée avec:
1. Zone d'affectation probable
2. Indice d'utilisation (IBUS) typique
3. Hauteurs maximales usuelles
4. Contraintes de recul
5. Obligations de stationnement
6. Prescriptions architecturales

Réponds au format JSON avec cette structure:
{
  "constraints": [
    {
      "title": "Titre de la contrainte",
      "description": "Description détaillée",
      "severity": "low|medium|high",
      "source": "Source de l'information",
      "icon": "emoji"
    }
  ],
  "summary": "Résumé de l'analyse"
}`;

    const result = await callOpenAI(prompt);
    
    try {
      return JSON.parse(result);
    } catch (parseError) {
      // Si le parsing JSON échoue, retourner une structure par défaut
      return {
        constraints: [
          {
            title: "Analyse textuelle",
            description: result,
            severity: "medium",
            source: "Analyse IA",
            icon: "📋"
          }
        ],
        summary: "Analyse générée par IA"
      };
    }
  } catch (error) {
    logger.error('Erreur lors de l\'analyse OpenAI', { error: error.message });
    throw error;
  }
}

// Route principale pour l'analyse IA
router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { searchQuery, analysisType = 'comprehensive' } = req.body;
    
    logger.info('Nouvelle demande d\'analyse IA', { 
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
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Service d\'analyse IA temporairement indisponible'
      });
    }

    // Analyse avec notre service simplifié
    const analysisResult = await analyzeConstraints(searchQuery);

    const duration = Date.now() - startTime;
    
    logger.info('Analyse terminée avec succès', {
      searchQuery,
      duration: `${duration}ms`,
      constraintsCount: analysisResult.constraints?.length || 0
    });

    res.json({
      success: true,
      data: {
        constraints: analysisResult.constraints || [],
        summary: analysisResult.summary || '',
        parcel: {
          address: searchQuery,
          commune: "À déterminer",
          model_used: "gpt-4"
        }
      },
      metadata: {
        analysisType,
        duration,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Erreur lors de l\'analyse IA', {
      error: error.message,
      duration: `${duration}ms`,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'analyse des contraintes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

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
    openaiConfigured: !!process.env.OPENAI_API_KEY
  });
});

module.exports = router;