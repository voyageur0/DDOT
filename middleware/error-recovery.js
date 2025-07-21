const { createContextLogger } = require('../utils/logger');
const apiKeyManager = require('../utils/api-key-manager');

const logger = createContextLogger('ERROR_RECOVERY');

// Middleware de récupération pour les erreurs de configuration
const configRecoveryMiddleware = (req, res, next) => {
  // Recharger les clés API si nécessaire
  if (!apiKeyManager.isConfigured('OPENAI_API_KEY')) {
    logger.warn('Tentative de rechargement des clés API...');
    apiKeyManager.reload();
  }
  next();
};

// Middleware de récupération pour les erreurs de session
const sessionRecoveryMiddleware = (err, req, res, next) => {
  if (err && err.code === 'ECONNREFUSED') {
    logger.error('Erreur de connexion détectée', { error: err.message });
    
    // Essayer de récupérer en réinitialisant la session
    if (req.session) {
      req.session.regenerate((regenerateErr) => {
        if (regenerateErr) {
          logger.error('Impossible de régénérer la session');
          return res.status(500).json({ error: 'Erreur de session' });
        }
        next();
      });
    } else {
      next();
    }
  } else {
    next(err);
  }
};

// Middleware pour s'assurer que les services critiques sont disponibles
const serviceHealthCheck = async (req, res, next) => {
  try {
    // Vérifier uniquement pour les routes qui nécessitent OpenAI
    if (req.path.includes('/ia-constraints') || req.path.includes('/ai-analysis')) {
      if (!apiKeyManager.isConfigured('OPENAI_API_KEY')) {
        logger.warn('Service IA non disponible - clé API manquante');
        return res.status(503).json({
          success: false,
          error: 'Service d\'analyse temporairement indisponible',
          message: 'Veuillez réessayer dans quelques instants'
        });
      }
    }
    next();
  } catch (error) {
    logger.error('Erreur lors de la vérification des services', { error: error.message });
    next();
  }
};

module.exports = {
  configRecoveryMiddleware,
  sessionRecoveryMiddleware,
  serviceHealthCheck
};