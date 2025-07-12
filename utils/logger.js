// === SYSTÈME DE LOGGING CENTRALISÉ ===

const winston = require('winston');
const path = require('path');

// Niveaux de log personnalisés
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'cyan',
    debug: 'blue'
  }
};

// Format de log personnalisé
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Ajouter la stack trace pour les erreurs
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Ajouter les métadonnées si présentes
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Configuration des transports
const transports = [
  // Console pour le développement
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      logFormat
    )
  })
];

// Fichiers de log pour la production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    // Erreurs dans un fichier séparé
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Tous les logs
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10
    })
  );
}

// Créer le logger
const logger = winston.createLogger({
  levels: customLevels.levels,
  format: logFormat,
  transports,
  exitOnError: false
});

// Ajouter les couleurs
winston.addColors(customLevels.colors);

// Créer le dossier logs si nécessaire
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Fonctions utilitaires
const createContextLogger = (context) => {
  return {
    error: (message, meta = {}) => logger.error(message, { context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { context, ...meta }),
    info: (message, meta = {}) => logger.info(message, { context, ...meta }),
    http: (message, meta = {}) => logger.http(message, { context, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { context, ...meta })
  };
};

// Logger pour les requêtes HTTP
const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, url, ip } = req;
    const { statusCode } = res;
    
    logger.http(`${method} ${url}`, {
      ip,
      statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
};

// Logger pour les erreurs d'API
const logApiError = (error, context = {}) => {
  logger.error('API Error', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

// Logger pour les analyses IA
const logAIAnalysis = (searchQuery, model, duration, success = true) => {
  logger.info('AI Analysis', {
    searchQuery,
    model,
    duration: `${duration}ms`,
    success
  });
};

module.exports = {
  logger,
  createContextLogger,
  httpLogger,
  logApiError,
  logAIAnalysis
};