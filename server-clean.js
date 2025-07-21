// Serveur DDOT - Version simplifiée et fonctionnelle
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration CORS simple
app.use(cors({
  origin: true,
  credentials: true
}));

// Middlewares de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging simple
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Désactiver le cache pour le développement
app.use((req, res, next) => {
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  res.header('Surrogate-Control', 'no-store');
  next();
});

// Fichiers statiques
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0
}));

// Routes principales
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route de test
app.get('/api/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Serveur DDOT fonctionnel',
    timestamp: new Date().toISOString()
  });
});

// Import des routes essentielles
try {
  const searchRoutes = require('./routes-node/search');
  const suggestionsRoutes = require('./routes-node/suggestions-geoadmin');
  const iaConstraintsRoutes = require('./routes-node/ia-constraints');
  
  app.use('/api/search', searchRoutes);
  app.use('/api/suggestions', suggestionsRoutes);
  app.use('/api/ia-constraints', iaConstraintsRoutes);
  
  console.log('✅ Routes API chargées');
} catch (error) {
  console.error('⚠️ Erreur chargement routes:', error.message);
}

// Gestion d'erreur simple
app.use((err, req, res, next) => {
  console.error('Erreur:', err);
  res.status(500).json({ error: 'Erreur serveur' });
});

// Route 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Démarrage du serveur
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 Serveur DDOT démarré avec succès');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log('🔄 Rechargement automatique: activé avec nodemon');
  console.log('🚫 Cache: désactivé');
  console.log('');
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('Arrêt du serveur...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nArrêt du serveur...');
  server.close(() => {
    process.exit(0);
  });
});