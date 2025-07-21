// Serveur DDOT Ultra Simple
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

// Middlewares essentiels
app.use(express.json());
app.use(express.static('public'));

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route de test
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Serveur fonctionnel' });
});

// Démarrage
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});