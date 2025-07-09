// Activer ts-node pour importer les modules TypeScript (transpile-only)
require('dotenv').config();
require('ts-node').register({ transpileOnly: true });

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuration des sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

// Initialisation de Passport
app.use(passport.initialize());
app.use(passport.session());

// Configuration du moteur de template EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Configuration de l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.originalname}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|png|jpg|jpeg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  }
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

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/documents', ensureAuthenticated, documentRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/payment', paymentRoutes);

// Charger la nouvelle route IA (TypeScript)
const iaConstraintsRouter = require('./src/routes/iaConstraints');
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

// Route d'upload
app.post('/api/upload', ensureAuthenticated, upload.single('file'), async (req, res) => {
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

    // Lancer l'extraction en arrière-plan
    const { extractDocument } = require('./services-node/pdfService');
    extractDocument(document.id, req.file.path);

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

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ error: 'Erreur serveur' });
  } else {
    res.status(500).render('500');
  }
});

// Initialisation de la base de données et démarrage du serveur
async function startServer() {
  try {
    // Importer les modèles pour la synchronisation
    const { sequelize: db } = require('./models-node');
    
    // Synchroniser les modèles avec la base de données
    await db.sync();
    console.log('Base de données synchronisée');

    // Charger l'index vectoriel s'il existe
    const { loadVectorIndex } = require('./services-node/vectorService');
    await loadVectorIndex();

    // Initialiser l'OCR en arrière-plan
    console.log('🔍 Initialisation OCR en cours...');
    const { initializeOcr } = require('./src/lib/ocr');
    await initializeOcr().catch(error => {
      console.error('⚠️ Erreur initialisation OCR:', error.message);
    });

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