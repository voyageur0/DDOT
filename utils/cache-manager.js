// === GESTIONNAIRE DE CACHE CENTRALISÉ ===

const NodeCache = require('node-cache');
const crypto = require('crypto');
const { createContextLogger } = require('./logger');

const cacheLogger = createContextLogger('CACHE');

// Configuration des caches par type de données
const cacheConfigs = {
  // Cache pour les recherches GeoAdmin (24h)
  geoadmin: {
    stdTTL: 24 * 60 * 60, // 24 heures
    checkperiod: 600, // Vérifier les expirations toutes les 10min
    useClones: false
  },
  
  // Cache pour les analyses RDPPF (permanent, basé sur EGRID)
  rdppf: {
    stdTTL: 0, // Permanent
    checkperiod: 0,
    useClones: false
  },
  
  // Cache pour les règlements communaux (1 semaine)
  regulations: {
    stdTTL: 7 * 24 * 60 * 60, // 1 semaine
    checkperiod: 3600, // 1 heure
    useClones: false
  },
  
  // Cache pour les analyses IA (1 heure)
  aiAnalysis: {
    stdTTL: 60 * 60, // 1 heure
    checkperiod: 300, // 5 minutes
    useClones: false
  }
};

// Initialiser les caches
const caches = {};
Object.keys(cacheConfigs).forEach(type => {
  caches[type] = new NodeCache(cacheConfigs[type]);
  
  // Événements de cache
  caches[type].on('set', (key, value) => {
    cacheLogger.debug(`Cache SET: ${type}:${key}`);
  });
  
  caches[type].on('del', (key, value) => {
    cacheLogger.debug(`Cache DEL: ${type}:${key}`);
  });
  
  caches[type].on('expired', (key, value) => {
    cacheLogger.debug(`Cache EXPIRED: ${type}:${key}`);
  });
});

/**
 * Génère une clé de cache basée sur les paramètres
 * @param {string} prefix - Préfixe de la clé
 * @param {object} params - Paramètres à hasher
 * @returns {string} Clé de cache
 */
function generateCacheKey(prefix, params) {
  const paramString = JSON.stringify(params, Object.keys(params).sort());
  const hash = crypto.createHash('md5').update(paramString).digest('hex');
  return `${prefix}:${hash}`;
}

/**
 * Classe pour gérer un cache spécifique
 */
class CacheManager {
  constructor(type) {
    this.type = type;
    this.cache = caches[type];
    
    if (!this.cache) {
      throw new Error(`Type de cache non supporté: ${type}`);
    }
  }

  /**
   * Récupère une valeur du cache
   * @param {string} key - Clé de cache
   * @returns {any|null} Valeur ou null si non trouvée
   */
  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      cacheLogger.debug(`Cache HIT: ${this.type}:${key}`);
      return value;
    }
    
    cacheLogger.debug(`Cache MISS: ${this.type}:${key}`);
    return null;
  }

  /**
   * Stocke une valeur dans le cache
   * @param {string} key - Clé de cache
   * @param {any} value - Valeur à stocker
   * @param {number} ttl - TTL personnalisé (optionnel)
   * @returns {boolean} Succès de l'opération
   */
  set(key, value, ttl = null) {
    const success = ttl ? this.cache.set(key, value, ttl) : this.cache.set(key, value);
    
    if (success) {
      cacheLogger.debug(`Cache SET: ${this.type}:${key}${ttl ? ` (TTL: ${ttl}s)` : ''}`);
    } else {
      cacheLogger.warn(`Cache SET FAILED: ${this.type}:${key}`);
    }
    
    return success;
  }

  /**
   * Supprime une valeur du cache
   * @param {string} key - Clé de cache
   * @returns {number} Nombre d'éléments supprimés
   */
  del(key) {
    const deleted = this.cache.del(key);
    cacheLogger.debug(`Cache DEL: ${this.type}:${key} (${deleted} éléments supprimés)`);
    return deleted;
  }

  /**
   * Vide complètement le cache
   */
  flush() {
    this.cache.flushAll();
    cacheLogger.info(`Cache FLUSH: ${this.type}`);
  }

  /**
   * Récupère les statistiques du cache
   * @returns {object} Statistiques
   */
  getStats() {
    return {
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
      hitRate: this.cache.getStats().hits / (this.cache.getStats().hits + this.cache.getStats().misses) * 100
    };
  }

  /**
   * Wrapper pour exécuter une fonction avec cache
   * @param {string} key - Clé de cache
   * @param {Function} fn - Fonction à exécuter si cache manqué
   * @param {number} ttl - TTL personnalisé (optionnel)
   * @returns {Promise<any>} Résultat de la fonction ou valeur cachée
   */
  async wrap(key, fn, ttl = null) {
    // Essayer de récupérer depuis le cache
    let result = this.get(key);
    
    if (result !== null) {
      return result;
    }

    // Exécuter la fonction
    try {
      result = await fn();
      
      // Stocker le résultat
      if (result !== null && result !== undefined) {
        this.set(key, result, ttl);
      }
      
      return result;
    } catch (error) {
      cacheLogger.error(`Erreur lors de l'exécution de la fonction pour la clé ${key}:`, error);
      throw error;
    }
  }
}

// Instances de cache pré-configurées
const geoAdminCache = new CacheManager('geoadmin');
const rdppfCache = new CacheManager('rdppf');
const regulationsCache = new CacheManager('regulations');
const aiAnalysisCache = new CacheManager('aiAnalysis');

/**
 * Récupère les statistiques globales de tous les caches
 * @returns {object} Statistiques globales
 */
function getGlobalStats() {
  const stats = {};
  
  Object.keys(caches).forEach(type => {
    const manager = new CacheManager(type);
    stats[type] = manager.getStats();
  });
  
  return stats;
}

/**
 * Middleware Express pour ajouter le cache aux requêtes
 */
function cacheMiddleware(req, res, next) {
  req.cache = {
    geoadmin: geoAdminCache,
    rdppf: rdppfCache,
    regulations: regulationsCache,
    aiAnalysis: aiAnalysisCache,
    generateKey: generateCacheKey,
    getStats: getGlobalStats
  };
  
  next();
}

module.exports = {
  CacheManager,
  geoAdminCache,
  rdppfCache,
  regulationsCache,
  aiAnalysisCache,
  generateCacheKey,
  getGlobalStats,
  cacheMiddleware
};