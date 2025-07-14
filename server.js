// Activer ts-node pour importer les modules TypeScript (transpile-only)
require('dotenv').config();
require('ts-node').register({ transpileOnly: true });

// Validation des variables d'environnement
const { validateEnvironment } = require('./config/env-validation');
validateEnvironment();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const helmet = require('helmet');
const csrf = require('csrf');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Sequelize } = require('sequelize');
const expressLayouts = require('express-ejs-layouts');

// Système de logging centralisé
const { logger, httpLogger, createContextLogger, logApiError } = require('./utils/logger');
const serverLogger = createContextLogger('SERVER');

// Gestionnaire de cache
const { cacheMiddleware } = require('./utils/cache-manager');

// Gestion d'erreurs centralisée
const { globalErrorHandler, notFoundHandler, asyncHandler, ValidationError, NotFoundError } = require('./utils/error-handler');

// Import des middlewares et routes
const authRoutes = require('./routes-node/auth');
const documentRoutes = require('./routes-node/documents');
const analysisRoutes = require('./routes-node/analysis');
const paymentRoutes = require('./routes-node/payment');

// Import des nouvelles routes refactorisées
const aiAnalysisRoutes = require('./routes/ai-analysis');
const iaConstraintsRoutes = require('./routes-node/ia-constraints');

// Configuration de l'application
const app = express();
const PORT = process.env.PORT || 3001;

// Configuration Passport
require('./config/passport');

// === SÉCURITÉ : Configuration des headers de sécurité avec Helmet ===
// Désactiver en mode développement pour éviter les problèmes HTTPS
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    // Content Security Policy (CSP)
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'", 
          "'unsafe-inline'", // Nécessaire pour les scripts inline existants
          "https://cdnjs.cloudflare.com", 
          "https://unpkg.com",
          "https://api3.geo.admin.ch",
          "https://maps.googleapis.com"
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Permet les handlers onclick inline
        styleSrc: [
          "'self'", 
          "'unsafe-inline'", // Nécessaire pour les styles inline
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com"
        ],
        imgSrc: [
          "'self'", 
          "data:", 
          "https:", 
          "blob:"
        ],
        connectSrc: [
          "'self'", 
          "http://localhost:3001",
          "http://127.0.0.1:3001",
          "https://api3.geo.admin.ch",
          "https://rdppfvs.geopol.ch",
          "https://nominatim.openstreetmap.org",
          "https://maps.googleapis.com",
          "https://api.openai.com"
        ],
        fontSrc: [
          "'self'", 
          "https://fonts.gstatic.com",
          "data:"
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: [
          "'self'",
          "https://maps.google.com",
          "https://www.google.com"
        ]
      }
    },
    // Protection contre les attaques de clickjacking
    frameguard: { action: 'deny' },
    // Protection contre le sniffing MIME
    noSniff: true,
    // Protection XSS
    xssFilter: true,
    // Référent Policy
    referrerPolicy: { policy: "same-origin" },
    // HSTS (HTTPS Strict Transport Security) - uniquement en production
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000, // 1 an
      includeSubDomains: true,
      preload: true
    } : false
  }));
} else {
  // Mode développement - sécurité minimale pour éviter les problèmes HTTPS
  console.log('🔧 Mode développement - Helmet désactivé pour éviter les problèmes HTTPS');
}

// Configuration de la base de données
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './urban_analysis.db',
  logging: false,
  // Optimisation pour le développement
  pool: {
    max: 2,
    min: 0,
    acquire: 3000,
    idle: 1000
  },
  define: {
    timestamps: true,
    paranoid: false
  }
});

// Middlewares
app.use(cors({
  origin: ['http://localhost:3001', 'http://127.0.0.1:3001', 'https://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// === SÉCURITÉ : Configuration du Rate Limiting ===
// Rate limiting général pour toutes les requêtes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limite à 1000 requêtes par IP
  message: {
    error: 'Trop de requêtes, veuillez réessayer plus tard',
    retryAfter: 900 // 15 minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Exclure les assets statiques du rate limiting
  skip: (req) => {
    return req.path.startsWith('/css/') || 
           req.path.startsWith('/js/') || 
           req.path.startsWith('/images/') ||
           req.path.endsWith('.css') ||
           req.path.endsWith('.js') ||
           req.path.endsWith('.png') ||
           req.path.endsWith('.jpg') ||
           req.path.endsWith('.ico');
  }
});

// Rate limiting strict pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Seulement 5 tentatives de connexion
  message: {
    error: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting pour les uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // Maximum 10 uploads par heure
  message: {
    error: 'Trop d\'uploads, veuillez réessayer dans une heure',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting pour les analyses IA
const aiAnalysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 50, // Maximum 50 analyses IA par heure
  message: {
    error: 'Limite d\'analyses IA atteinte, veuillez réessayer dans une heure',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Appliquer le rate limiting général
app.use(generalLimiter);

app.use(express.json({ limit: '10mb' })); // Limiter la taille des JSON
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Ajout du middleware de cache et de logging
app.use(httpLogger);
app.use(cacheMiddleware);

// Configuration des sessions avec secret sécurisé
app.use(session({
  secret: process.env.SESSION_SECRET || require('crypto').randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: false,
  name: 'ddot.sid', // Nom de session personnalisé pour éviter l'empreinte
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 heures
    sameSite: 'strict' // Protection CSRF supplémentaire
  }
}));

// === SÉCURITÉ : Protection CSRF ===
const csrfProtection = csrf();

// Middleware CSRF pour les routes sensibles (POST, PUT, DELETE)
const csrfMiddleware = (req, res, next) => {
  // Exclure les webhooks Stripe qui ont leur propre validation
  if (req.path.startsWith('/api/payment/webhook')) {
    return next();
  }
  
  // Exclure la route publique des règlements communaux
  if (req.path === '/api/documents/communal-regulations' && req.method === 'GET') {
    return next();
  }
  
  // Exclure les API publiques (lecture seule)
  if (req.method === 'GET' || req.path.startsWith('/api/analysis/search')) {
    return next();
  }
  
  // Appliquer la protection CSRF pour les autres routes
  const token = req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;
  
  if (!token) {
    return res.status(403).json({ error: 'Token CSRF manquant' });
  }
  
  try {
    if (!csrfProtection.verify(req.session.csrfSecret || '', token)) {
      return res.status(403).json({ error: 'Token CSRF invalide' });
    }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Erreur validation CSRF' });
  }
};

// Route pour obtenir un token CSRF
app.get('/api/csrf-token', (req, res) => {
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = csrfProtection.secretSync();
  }
  const token = csrfProtection.create(req.session.csrfSecret);
  res.json({ csrfToken: token });
});

// Initialisation de Passport
app.use(passport.initialize());
app.use(passport.session());

// Configuration du moteur de template EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// === SÉCURITÉ : Configuration sécurisée de l'upload de fichiers ===
const fs = require('fs');
const crypto = require('crypto');

// Créer le dossier uploads s'il n'existe pas
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Nom de fichier sécurisé avec hash pour éviter les conflits
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(file.originalname).toLowerCase();
    const safeName = `${timestamp}_${randomBytes}${extension}`;
    cb(null, safeName);
  }
});

// Liste des types MIME autorisés avec leurs extensions
const allowedMimeTypes = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max (réduit pour la sécurité)
    files: 1, // Un seul fichier à la fois
    parts: 10, // Limite le nombre de parties dans une requête multipart
    headerPairs: 20 // Limite les headers
  },
  fileFilter: (req, file, cb) => {
    try {
      // Vérification stricte du type MIME et de l'extension
      const mimeType = file.mimetype.toLowerCase();
      const extension = path.extname(file.originalname).toLowerCase();
      
      if (!allowedMimeTypes[mimeType]) {
        return cb(new Error('Type de fichier non autorisé'), false);
      }
      
      if (!allowedMimeTypes[mimeType].includes(extension)) {
        return cb(new Error('Extension de fichier non correspondante'), false);
      }
      
      // Vérification du nom de fichier pour éviter les caractères dangereux
      const unsafeChars = /[<>:"/\\|?*\x00-\x1f]/;
      if (unsafeChars.test(file.originalname)) {
        return cb(new Error('Nom de fichier contient des caractères non autorisés'), false);
      }
      
      // Vérification de la longueur du nom
      if (file.originalname.length > 255) {
        return cb(new Error('Nom de fichier trop long'), false);
      }
      
      cb(null, true);
    } catch (error) {
      cb(new Error('Erreur lors de la validation du fichier'), false);
    }
  }
});

// Middleware pour scanner les fichiers uploadés (détection basique de malware)
const scanUploadedFile = async (req, res, next) => {
  if (!req.file) {
    return next();
  }
  
  try {
    const filePath = req.file.path;
    const stats = fs.statSync(filePath);
    
    // Vérifications basiques de sécurité
    if (stats.size === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Fichier vide détecté' });
    }
    
    // Lecture des premiers bytes pour vérifier la signature du fichier
    const buffer = fs.readFileSync(filePath, { start: 0, end: 10 });
    const signature = buffer.toString('hex').toUpperCase();
    
    // Signatures de fichiers autorisés
    const validSignatures = {
      'PDF': ['255044462D'], // %PDF-
      'JPEG': ['FFD8FF'],
      'PNG': ['89504E470D0A1A0A'],
      'WEBP': ['52494646'] // RIFF
    };
    
    let isValidSignature = false;
    for (const [type, signatures] of Object.entries(validSignatures)) {
      for (const sig of signatures) {
        if (signature.startsWith(sig)) {
          isValidSignature = true;
          break;
        }
      }
    }
    
    if (!isValidSignature) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Signature de fichier invalide' });
    }
    
    next();
  } catch (error) {
    console.error('Erreur scan fichier:', error);
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Erreur suppression fichier:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Erreur lors de la validation du fichier' });
  }
};

// Route pour le favicon pour éviter les erreurs 404
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content
});

// Routes principales
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

app.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('login', { user: null });
});

app.get('/register', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('register', { user: null });
});

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Erreur lors de la déconnexion:', err);
    }
    res.redirect('/');
  });
});

app.get('/dashboard', ensureAuthenticated, (req, res) => {
  res.render('dashboard', { user: req.user });
});

// Route publique pour règlements communaux (AVANT la route protégée)
app.get('/api/documents/communal-regulations', async (req, res) => {
  try {
    const commune = req.query.commune;
    
    if (!commune) {
      return res.status(400).json({ error: 'Paramètre commune requis' });
    }

    res.json({
      success: true,
      message: `Règlement communal pour ${commune}`,
      commune: commune,
      document_url: `/documents/reglements/${commune.toLowerCase()}.pdf`,
      available: false,
      note: "Fonctionnalité en cours de développement"
    });
  } catch (error) {
    console.error('Erreur téléchargement règlement:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement du règlement' });
  }
});

// Routes API avec protection CSRF et rate limiting
app.use('/api/auth', authLimiter, csrfMiddleware, authRoutes);
app.use('/api/documents', ensureAuthenticated, csrfMiddleware, documentRoutes);
app.use('/api/analysis', aiAnalysisLimiter, analysisRoutes); // Analyse avec rate limiting

app.use('/api/payment', csrfMiddleware, paymentRoutes);
app.use('/api/ia-constraints', aiAnalysisLimiter, iaConstraintsRoutes);

// Route IA SUPPRIMÉE - remplacée par iaConstraintsRoutes
/*app.post('/api/ia-constraints', aiAnalysisLimiter, async (req, res) => {
  console.log('🔍 Requête IA reçue:', req.body);
  
  try {
    const { address, searchQuery } = req.body;
    const finalAddress = address || searchQuery;
    
    if (!finalAddress) {
      return res.status(400).json({ error: 'Adresse ou searchQuery requise' });
    }

    // Analyse simplifiée de test
    const testConstraints = [
      {
        title: "Zone villa individuelle",
        description: "IBUS: 0.3, Hauteur max: 8.5m, Distance min: 5m",
        severity: "medium",
        source: "Règlement communal",
        icon: "🏗️"
      },
      {
        title: "Places de parc",
        description: "2 places par logement requis",
        severity: "medium",
        source: "Règlement stationnement",
        icon: "🚗"
      },
      {
        title: "Espaces verts",
        description: "30% de la surface minimum",
        severity: "low",
        source: "Règlement espaces verts",
        icon: "🌱"
      }
    ];

    const result = {
      success: true,
      data: {
        constraints: testConstraints,
        parcel: {
          address: finalAddress,
          commune: "Test Commune",
          model_used: "test-mode"
        },
        metadata: {
          model_used: "test-mode",
          note: "Analyse de test - fonctionnalité en développement"
        }
      },
      analysisType: "test",
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ Analyse de test terminée');
    return res.json(result);
    
  } catch (error) {
    console.error('❌ Erreur analyse IA:', error);
    res.status(500).json({ error: 'Erreur lors de l\'analyse: ' + error.message });
  }
});*/

// Middleware d'authentification
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  res.redirect('/login');
}

// === ROUTES D'ANALYSE IA REFACTORISÉES ===
// L'ancienne route complexe a été remplacée par des modules séparés
// pour une meilleure maintenabilité et performance

// === DÉMARRAGE DU SERVEUR ===
app.listen(PORT, () => {
  console.log(`🚀 Serveur Express démarré sur le port ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Base de données: SQLite`);
});
