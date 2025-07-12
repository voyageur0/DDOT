// === GESTIONNAIRE D'ERREURS CENTRALISÉ ===

const { logApiError, createContextLogger } = require('./logger');

const errorLogger = createContextLogger('ERROR');

/**
 * Types d'erreurs personnalisées
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Non autorisé') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Accès refusé') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Ressource') {
    super(`${resource} non trouvé(e)`, 404, 'NOT_FOUND');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Trop de requêtes') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

class ExternalServiceError extends AppError {
  constructor(service, originalError) {
    super(`Erreur du service externe: ${service}`, 502, 'EXTERNAL_SERVICE_ERROR', {
      service,
      originalMessage: originalError.message
    });
  }
}

/**
 * Formate la réponse d'erreur pour l'API
 * @param {Error} error - Erreur à formater
 * @param {boolean} includeStack - Inclure la stack trace
 * @returns {object} Réponse formatée
 */
function formatErrorResponse(error, includeStack = false) {
  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.code || 'INTERNAL_ERROR',
      statusCode: error.statusCode || 500
    }
  };

  // Ajouter les détails pour les erreurs opérationnelles
  if (error.isOperational && error.details) {
    response.error.details = error.details;
  }

  // Ajouter la stack trace en développement
  if (includeStack && error.stack) {
    response.error.stack = error.stack;
  }

  // Ajouter un timestamp
  response.timestamp = new Date().toISOString();

  return response;
}

/**
 * Middleware de gestion d'erreur global
 */
function globalErrorHandler(err, req, res, next) {
  // S'assurer que l'erreur a un statusCode
  err.statusCode = err.statusCode || 500;
  err.code = err.code || 'INTERNAL_ERROR';

  // Logger l'erreur
  logApiError(err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Erreurs spécifiques selon l'environnement
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Erreurs de validation Sequelize
  if (err.name === 'SequelizeValidationError') {
    const validationErrors = err.errors.map(e => ({
      field: e.path,
      message: e.message,
      value: e.value
    }));
    
    return res.status(400).json(formatErrorResponse(
      new ValidationError('Erreur de validation', { validationErrors }),
      isDevelopment
    ));
  }

  // Erreurs de contrainte Sequelize
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json(formatErrorResponse(
      new AppError('Cette ressource existe déjà', 409, 'RESOURCE_CONFLICT'),
      isDevelopment
    ));
  }

  // Erreurs de connexion Sequelize
  if (err.name === 'SequelizeConnectionError') {
    return res.status(503).json(formatErrorResponse(
      new AppError('Service temporairement indisponible', 503, 'SERVICE_UNAVAILABLE'),
      isDevelopment
    ));
  }

  // Erreurs Multer (upload de fichiers)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json(formatErrorResponse(
      new ValidationError('Fichier trop volumineux'),
      isDevelopment
    ));
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json(formatErrorResponse(
      new ValidationError('Type de fichier non autorisé'),
      isDevelopment
    ));
  }

  // Erreurs CSRF
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json(formatErrorResponse(
      new AuthorizationError('Token CSRF invalide'),
      isDevelopment
    ));
  }

  // Erreurs JSON malformé
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json(formatErrorResponse(
      new ValidationError('JSON malformé'),
      isDevelopment
    ));
  }

  // Erreurs 404 pour les routes non trouvées
  if (err.statusCode === 404) {
    return res.status(404).json(formatErrorResponse(
      new NotFoundError('Endpoint'),
      isDevelopment
    ));
  }

  // Erreurs opérationnelles (erreurs métier)
  if (err.isOperational) {
    return res.status(err.statusCode).json(formatErrorResponse(err, isDevelopment));
  }

  // Erreurs non gérées (500)
  errorLogger.error('Erreur non gérée:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });

  // En production, ne pas exposer les détails des erreurs internes
  const message = isDevelopment ? err.message : 'Erreur interne du serveur';
  
  return res.status(500).json(formatErrorResponse(
    new AppError(message, 500, 'INTERNAL_ERROR'),
    isDevelopment
  ));
}

/**
 * Middleware pour les routes non trouvées
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
}

/**
 * Wrapper pour les fonctions async afin de capturer les erreurs
 * @param {Function} fn - Fonction async à wrapper
 * @returns {Function} Fonction wrappée
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation des paramètres de requête
 * @param {object} schema - Schéma de validation (utilisant Joi ou similaire)
 * @returns {Function} Middleware de validation
 */
function validateRequest(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return next(new ValidationError('Paramètres invalides', { details }));
    }
    
    next();
  };
}

module.exports = {
  // Classes d'erreurs
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
  
  // Middlewares
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
  validateRequest,
  
  // Utilitaires
  formatErrorResponse
};