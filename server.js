// Activer ts-node pour importer les modules TypeScript (transpile-only)
require('dotenv').config();
require('ts-node').register({ transpileOnly: true });

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

// Import des middlewares et routes
const authRoutes = require('./routes-node/auth');
const documentRoutes = require('./routes-node/documents');
const analysisRoutes = require('./routes-node/analysis');
const paymentRoutes = require('./routes-node/payment');

// Configuration de l'application
const app = express();
const PORT = 3001;

// Configuration Passport
require('./config/passport');

// === SÉCURITÉ : Configuration des headers de sécurité avec Helmet ===
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

// Configuration de la base de données
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './urban_analysis.db',
  logging: false
});

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
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

// Routes API avec protection CSRF et rate limiting
app.use('/api/auth', authLimiter, csrfMiddleware, authRoutes);
app.use('/api/documents', ensureAuthenticated, csrfMiddleware, documentRoutes);
app.use('/api/analysis', aiAnalysisLimiter, analysisRoutes); // Analyse avec rate limiting
app.use('/api/payment', csrfMiddleware, paymentRoutes);

// Charger la nouvelle route IA (TypeScript) - Correction pour compatibilité CommonJS/ESM
const iaConstraintsRouter = require('./src/routes/iaConstraints').default;
app.use('/api', iaConstraintsRouter);

// Route pour télécharger les règlements communaux locaux
app.get('/api/regulation/:commune', (req, res) => {
  const commune = req.params.commune;
  const fs = require('fs');
  
  // Fonction pour normaliser les noms (enlever accents, standardiser)
  const normalize = (str) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
      .toLowerCase()
      .trim();
  };
  
  // Essayer différentes variantes du nom du fichier
  const baseDir = path.join(__dirname, 'reglements');
  
  try {
    // Lister tous les fichiers du dossier reglements
    const files = fs.readdirSync(baseDir);
    
    // Chercher un fichier qui correspond à la commune
    const matchingFile = files.find(file => {
      if (!file.endsWith('.pdf')) return false;
      
      // Normaliser le nom du fichier pour la comparaison
      const normalizedFile = normalize(file);
      const normalizedCommune = normalize(commune);
      
      // Vérifier si le nom de commune est contenu dans le nom du fichier
      return normalizedFile.includes(normalizedCommune);
    });
    
    if (matchingFile) {
      const filePath = path.join(baseDir, matchingFile);
      
      // Servir le fichier PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${matchingFile}"`);
      res.sendFile(filePath);
    } else {
      // Si aucun fichier n'est trouvé, essayer avec le format standard
      const standardFilename = `VS_${commune}_Règlement des constructions.pdf`;
      const standardPath = path.join(baseDir, standardFilename);
      
      if (fs.existsSync(standardPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${standardFilename}"`);
        res.sendFile(standardPath);
      } else {
        res.status(404).json({ 
          error: `Règlement non disponible pour la commune ${commune}`,
          message: 'Le fichier PDF du règlement communal n\'a pas été trouvé.'
        });
      }
    }
  } catch (error) {
    console.error('Erreur lors de la recherche du règlement:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la recherche du règlement.'
    });
  }
});

// Route d'upload sécurisée avec rate limiting
app.post('/api/upload', uploadLimiter, ensureAuthenticated, upload.single('file'), scanUploadedFile, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const { commune, document_type } = req.body;
    
    // Créer l'entrée en base de données
    const { Document } = require('./models-node');
    const document = await Document.create({
      filename: req.file.filename,
      originalFilename: req.file.originalname,
      userId: req.user.id,
      commune: commune || '',
      documentType: document_type || 'reglement'
    });

    // Extraction PDF supprimée - non nécessaire pour cette application
    // const { extractDocument } = require('./services-node/pdfService');
    // extractDocument(document.id, req.file.path);

    res.json({
      message: 'Document uploadé avec succès',
      documentId: document.id
    });
  } catch (error) {
    console.error('Erreur upload:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

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

// Gestion des erreurs 404
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Endpoint non trouvé' });
  } else {
    res.status(404).render('404');
  }
});

// === SÉCURITÉ : Gestion sécurisée des erreurs ===
app.use((err, req, res, next) => {
  // Logger l'erreur complète côté serveur (sans l'exposer au client)
  console.error('Erreur serveur:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Gestion spécifique des erreurs Multer
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'Fichier trop volumineux',
        message: 'La taille du fichier ne peut pas dépasser 25MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Trop de fichiers',
        message: 'Un seul fichier autorisé à la fois'
      });
    }
    return res.status(400).json({ 
      error: 'Erreur de téléchargement',
      message: 'Problème lors du téléchargement du fichier'
    });
  }

  // Gestion des erreurs de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Données invalides',
      message: 'Les données fournies ne respectent pas le format requis'
    });
  }

  // Gestion des erreurs de base de données
  if (err.name === 'SequelizeError' || err.name === 'SequelizeValidationError') {
    return res.status(500).json({ 
      error: 'Erreur de base de données',
      message: 'Une erreur est survenue lors de l\'accès aux données'
    });
  }

  // Gestion des erreurs d'authentification
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      error: 'Non autorisé',
      message: 'Accès refusé'
    });
  }

  // Erreur générique sans exposer les détails internes
  const statusCode = err.status || err.statusCode || 500;
  
  if (req.path.startsWith('/api/')) {
    res.status(statusCode).json({ 
      error: statusCode === 500 ? 'Erreur serveur interne' : 'Erreur de traitement',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur inattendue s\'est produite'
    });
  } else {
    res.status(statusCode).render('500', { 
      error: 'Une erreur s\'est produite',
      user: req.user || null 
    });
  }
});

// Initialisation de la base de données et démarrage du serveur
async function startServer() {
  try {
    // Importer les modèles pour la synchronisation
    const { sequelize: db } = require('./models-node');
    
    // Tester la connexion Supabase si configurée
    try {
      const { testSupabaseConnection } = require('./config/supabase');
      await testSupabaseConnection();
    } catch (error) {
      console.log('ℹ️ Supabase non configuré, utilisation de SQLite');
    }
    
    // Synchroniser les modèles avec la base de données
    await db.sync();
    const dialect = db.getDialect();
    console.log(`✅ Base de données synchronisée (${dialect.toUpperCase()})`);
    
    if (dialect === 'postgres') {
      console.log('🐘 PostgreSQL/Supabase activé avec Row Level Security');
    } else {
      console.log('📁 SQLite activé (mode développement)');
    }

    // Index vectoriel supprimé - lié à l'extraction PDF
    // const { loadVectorIndex } = require('./services-node/vectorService');
    // await loadVectorIndex();

    // OCR initialisé à la demande (pas d'initialisation au démarrage)

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`✅ Serveur Urban IA démarré sur http://localhost:${PORT}`);
      console.log(`🌐 Interface web accessible à cette adresse`);
      console.log(`📱 Vous pouvez maintenant ouvrir votre navigateur`);
    });
  } catch (error) {
    console.error('Erreur au démarrage:', error);
    process.exit(1);
  }
}

// Export pour les tests
module.exports = app;

// Démarrer le serveur si ce n'est pas un import
if (require.main === module) {
  startServer();
} 