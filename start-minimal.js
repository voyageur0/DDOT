// Serveur minimal pour test Safari
require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware basique
app.use(express.static('public'));
app.use(express.json());

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API simple de test
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Serveur fonctionnel',
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent']
  });
});

// Démarrage
app.listen(PORT, () => {
  console.log(`🚀 Serveur minimal démarré sur le port ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
});