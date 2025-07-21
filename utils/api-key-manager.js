const fs = require('fs');
const path = require('path');
const { createContextLogger } = require('./logger');

const logger = createContextLogger('API_KEY_MANAGER');

class ApiKeyManager {
  constructor() {
    this.configPath = path.join(__dirname, '..', '.env');
    this.keys = {};
    this.loadKeys();
  }

  loadKeys() {
    try {
      // Charger depuis process.env
      this.keys = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        SESSION_SECRET: process.env.SESSION_SECRET || '',
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || ''
      };

      // Vérifier si les clés essentielles sont présentes
      if (!this.keys.OPENAI_API_KEY) {
        logger.warn('Clé OpenAI manquante - fonctionnalités IA désactivées');
      }

      logger.info('Clés API chargées avec succès');
    } catch (error) {
      logger.error('Erreur lors du chargement des clés', { error: error.message });
    }
  }

  getKey(keyName) {
    return this.keys[keyName] || process.env[keyName] || null;
  }

  isConfigured(keyName) {
    const key = this.getKey(keyName);
    return key && key.length > 0;
  }

  validateOpenAI() {
    const key = this.getKey('OPENAI_API_KEY');
    if (!key || !key.startsWith('sk-')) {
      logger.error('Clé OpenAI invalide ou manquante');
      return false;
    }
    return true;
  }

  // Méthode pour recharger les clés après modification
  reload() {
    logger.info('Rechargement des clés API...');
    delete require.cache[require.resolve('dotenv')];
    require('dotenv').config();
    this.loadKeys();
  }
}

// Singleton
const apiKeyManager = new ApiKeyManager();

module.exports = apiKeyManager;