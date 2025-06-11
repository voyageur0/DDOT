import express, { Router } from 'express';
import { performComprehensiveAnalysis, performQuickAnalysis } from '../lib/parcelAnalysisOrchestrator';

const router = Router();

router.post('/test-auto-analysis', async (req: express.Request, res: express.Response) => {
  try {
    const { searchQuery, analysisType = 'quick' } = req.body;
    
    if (!searchQuery) {
      return res.status(400).json({ 
        error: 'searchQuery manquant',
        example: 'Essayez: "Rue de la Gare 15, Sion" ou "Parcelle 542, Martigny"'
      });
    }
    
    console.log(`🧪 Test analyse automatisée: "${searchQuery}" (type: ${analysisType})`);
    
    const startTime = Date.now();
    
    // Choisir la fonction d'analyse
    const analysisFunction = analysisType === 'quick' ? performQuickAnalysis : performComprehensiveAnalysis;
    
    // Effectuer l'analyse
    const result = await analysisFunction(searchQuery);
    
    const totalTime = Date.now() - startTime;
    
    // Retourner les résultats détaillés pour debugging
    return res.json({
      success: true,
      searchQuery,
      analysisType,
      totalTime,
      completeness: result.completeness,
      processingTime: result.processingTime,
      
      // Données principales
      searchResult: result.searchResult,
      parcelDetails: result.parcelDetails,
      
      // Compteurs de données récoltées
      dataCollected: {
        zones: Object.keys(result.zones).length,
        geologicalInfo: Object.keys(result.geologicalInfo).length,
        buildingZone: Object.keys(result.buildingZone).length,
        plrRestrictions: result.plrData?.restrictions?.length || 0,
        communalRegulations: result.communalRegulations.length,
        dangerZones: result.hazardAssessment?.dangerZones?.length || 0
      },
      
      // Erreurs rencontrées
      errors: result.errors,
      
      // Données formatées pour OpenAI (tronquées pour affichage)
      formattedForAI: result.formattedForAI.substring(0, 1000) + (result.formattedForAI.length > 1000 ? '...' : ''),
      
      // Données complètes (optionnel)
      fullData: req.query.full === 'true' ? result : undefined
    });
    
  } catch (error: any) {
    console.error('❌ Erreur test analyse:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Route pour tester des exemples prédéfinis
router.get('/test-examples', async (req: express.Request, res: express.Response) => {
  const examples = [
    'Rue de la Gare 15, Sion',
    'Avenue de la Gare 10, Martigny',
    'Route de Riddes 25, Riddes',
    'Parcelle 542, Saxon',
    '2600000, 1118000' // Coordonnées dans les environs de Sion
  ];
  
  console.log('🧪 Test des exemples prédéfinis...');
  
  const results = [];
  
  for (const example of examples) {
    try {
      console.log(`📍 Test: ${example}`);
      const result = await performQuickAnalysis(example);
      
      results.push({
        searchQuery: example,
        success: result.completeness > 0,
        completeness: result.completeness,
        processingTime: result.processingTime,
        foundParcel: !!result.searchResult,
        egrid: result.searchResult?.egrid,
        municipality: result.parcelDetails?.municipality,
        errors: result.errors
      });
      
    } catch (error: any) {
      results.push({
        searchQuery: example,
        success: false,
        error: error.message
      });
    }
  }
  
  console.log(`✅ Tests terminés: ${results.filter(r => r.success).length}/${results.length} réussis`);
  
  return res.json({
    summary: {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    },
    results
  });
});

export default router; 