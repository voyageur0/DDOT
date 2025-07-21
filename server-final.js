const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3001;

// Middleware basique
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  console.log('GET /');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/test', (req, res) => {
  console.log('GET /api/test');
  res.json({ 
    status: 'ok', 
    message: 'Serveur DDOT fonctionnel',
    timestamp: new Date().toISOString()
  });
});

// Démarrage
const server = app.listen(PORT, '127.0.0.1', (err) => {
  if (err) {
    console.error('Erreur démarrage:', err);
    process.exit(1);
  }
  console.log(`\n✅ Serveur démarré sur http://127.0.0.1:${PORT}`);
  console.log(`✅ Accessible aussi sur http://localhost:${PORT}\n`);
});

// Gestion erreurs
server.on('error', (err) => {
  console.error('Erreur serveur:', err);
});

process.on('SIGINT', () => {
  console.log('\nArrêt du serveur...');
  server.close();
  process.exit(0);
});