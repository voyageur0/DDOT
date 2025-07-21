const path = require('path');

module.exports = {
  // Configuration du serveur
  server: {
    port: process.env.PORT || 3001,
    host: '0.0.0.0', // Écouter sur toutes les interfaces réseau
    env: process.env.NODE_ENV || 'development'
  },
  
  // Configuration CORS permissive pour le développement
  cors: {
    origin: function(origin, callback) {
      // Permettre toutes les origines en développement
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        const allowedOrigins = [
          'http://localhost:3001',
          'http://127.0.0.1:3001',
          'http://localhost:3000',
          'http://127.0.0.1:3000'
        ];
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  },
  
  // Configuration des chemins statiques
  static: {
    paths: [
      { route: '/', dir: path.join(__dirname, '..', 'public') },
      { route: '/css', dir: path.join(__dirname, '..', 'public', 'css') },
      { route: '/js', dir: path.join(__dirname, '..', 'public', 'js') },
      { route: '/images', dir: path.join(__dirname, '..', 'public', 'images') }
    ],
    options: {
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
      etag: false, // Désactiver etag pour éviter le cache
      dotfiles: 'ignore',
      index: 'index.html' // Servir index.html automatiquement
    }
  },
  
  // Configuration de sécurité Helmet adaptée
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "https://api.openai.com",
          "https://api.geo.admin.ch",
          "https://wmts.geo.admin.ch",
          "http://localhost:*",
          "http://127.0.0.1:*"
        ]
      }
    },
    crossOriginEmbedderPolicy: false
  }
};