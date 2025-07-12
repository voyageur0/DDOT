// === ROUTE D'ANALYSE IA REFACTORISÉE ===

const { asyncHandler, ValidationError, NotFoundError } = require('../utils/error-handler');
const { createContextLogger, logAIAnalysis } = require('../utils/logger');
const { getOpenAIService } = require('../utils/openai-service');

const aiLogger = createContextLogger('AI_ANALYSIS');

/**
 * Analyse IA complète d'une parcelle
 */
const analyzeParcel = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { searchQuery, analysisType = 'comprehensive' } = req.body;
  
  aiLogger.info('Nouvelle demande d\'analyse IA', { 
    searchQuery, 
    analysisType,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Validation des paramètres
  if (!searchQuery) {
    throw new ValidationError('Le paramètre searchQuery est requis');
  }

  // Vérifier le cache d'abord
  const cacheKey = req.cache.generateKey('ai_analysis', { searchQuery, analysisType });
  const cachedResult = req.cache.aiAnalysis.get(cacheKey);
  
  if (cachedResult) {
    aiLogger.debug('Résultat trouvé en cache', { searchQuery });
    return res.json({
      ...cachedResult,
      cached: true,
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Étape 1: Collecte de données via l'orchestrateur
    const orchestrator = require('../src/lib/parcelAnalysisOrchestrator');
    const comprehensiveData = await orchestrator.performComprehensiveAnalysis(searchQuery);
    
    aiLogger.debug(`Données collectées: ${comprehensiveData.completeness}% de complétude`);

    // Vérifier si nous avons suffisamment de données
    if (comprehensiveData.completeness < 30) {
      throw new NotFoundError(`Données insuffisantes pour l'analyse (${comprehensiveData.completeness}% de complétude)`);
    }

    // Étape 2: Analyse IA avec service unifié
    const openaiService = getOpenAIService();
    const analysisResult = await openaiService.analyzeUrbanConstraints(comprehensiveData);

    // Construire la réponse finale
    const response = {
      success: true,
      data: {
        analysis: analysisResult.analysis,
        parcel: {
          address: searchQuery,
          commune: analysisResult.analysis?.commune || 'Non déterminée',
          model_used: analysisResult.metadata.model_used
        },
        constraints: analysisResult.constraints || [],
        metadata: {
          ...analysisResult.metadata,
          completeness: comprehensiveData.completeness,
          processing_time_ms: Date.now() - startTime,
          cached: false
        },
        raw_data: {
          rdppf: comprehensiveData.rdppfConstraints || [],
          zones: comprehensiveData.zones || {},
          communal_regulations: comprehensiveData.communalRegulations || []
        }
      },
      analysisType,
      timestamp: new Date().toISOString()
    };

    // Mettre en cache pour 1 heure
    req.cache.aiAnalysis.set(cacheKey, response, 3600);

    // Logger le succès
    logAIAnalysis(
      searchQuery, 
      analysisResult.metadata.model_used, 
      Date.now() - startTime, 
      true
    );

    res.json(response);

  } catch (error) {
    // Logger l'échec
    logAIAnalysis(
      searchQuery, 
      'unknown', 
      Date.now() - startTime, 
      false
    );

    aiLogger.error('Erreur lors de l\'analyse IA:', {
      error: error.message,
      searchQuery,
      duration: Date.now() - startTime
    });

    throw error;
  }
});

/**
 * Analyse IA simplifiée pour les tests rapides
 */
const quickAnalyze = asyncHandler(async (req, res) => {
  const { searchQuery } = req.body;
  
  if (!searchQuery) {
    throw new ValidationError('Le paramètre searchQuery est requis');
  }

  // Version simplifiée avec cache court (15 minutes)
  const cacheKey = req.cache.generateKey('quick_analysis', { searchQuery });
  
  const result = await req.cache.aiAnalysis.wrap(cacheKey, async () => {
    const openaiService = getOpenAIService();
    
    // Prompt simplifié
    const simplePrompt = `Analysez rapidement cette adresse/parcelle: ${searchQuery}
    
Répondez en JSON avec: {
  "commune": "string",
  "zone_probable": "string", 
  "contraintes_principales": ["string"],
  "recommandations": ["string"]
}`;

    const result = await openaiService.completion(simplePrompt, {
      temperature: 0.3,
      max_tokens: 500
    });

    return JSON.parse(result.content);
  }, 900); // 15 minutes

  res.json({
    success: true,
    data: result,
    type: 'quick_analysis',
    timestamp: new Date().toISOString()
  });
});

/**
 * Statistiques d'utilisation de l'IA
 */
const getStats = asyncHandler(async (req, res) => {
  const openaiService = getOpenAIService();
  const stats = openaiService.getUsageStats();
  
  res.json({
    success: true,
    stats: {
      ...stats,
      cache: req.cache.getStats()
    }
  });
});

module.exports = {
  analyzeParcel,
  quickAnalyze,
  getStats
};