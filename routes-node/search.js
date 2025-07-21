const express = require('express');
const router = express.Router();
const { createContextLogger } = require('../utils/logger');
const parcelAnalysisOrchestrator = require('../src/lib/parcelAnalysisOrchestrator');

const logger = createContextLogger('SEARCH');

// Route principale de recherche
router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { query } = req.body;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Veuillez fournir un terme de recherche'
      });
    }

    logger.info('Nouvelle recherche', { 
      query,
      ip: req.ip 
    });

    // Utiliser l'orchestrateur TypeScript pour une analyse rapide
    const result = await parcelAnalysisOrchestrator.performQuickAnalysis(query);

    if (!result || !result.searchResult) {
      return res.status(404).json({
        success: false,
        error: 'Aucune parcelle trouvée',
        message: 'Vérifiez votre recherche et réessayez'
      });
    }

    const duration = Date.now() - startTime;
    
    logger.info('Recherche terminée avec succès', {
      query,
      duration: `${duration}ms`,
      parcelId: result.cadastral?.id_federal
    });

    // Formater la réponse pour l'interface
    res.json({
      success: true,
      general: {
        adresse: result.searchResult?.address || result.searchQuery,
        commune: result.parcelDetails?.municipality || result.searchResult?.municipality || '',
        canton: 'VS'
      },
      cadastral: {
        id_federal: result.searchResult?.egrid || '',
        commune: result.parcelDetails?.municipality || '',
        numero: result.parcelDetails?.number || '',
        surface: result.parcelDetails?.surface || 0,
        egrid: result.searchResult?.egrid || ''
      },
      zoning: result.zones || {},
      legal: result.plrData || {},
      coordinates: result.searchResult?.center || {},
      metadata: {
        duration,
        timestamp: new Date().toISOString(),
        completeness: result.completeness || 0
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Erreur lors de la recherche', {
      error: error.message,
      duration: `${duration}ms`,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recherche',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

// Route de santé
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Service de recherche opérationnel',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;