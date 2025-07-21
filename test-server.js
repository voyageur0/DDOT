const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Serveur OK\n');
});

server.listen(3001, '127.0.0.1', () => {
  console.log('Serveur de test démarré sur http://127.0.0.1:3001');
});

server.on('error', (err) => {
  console.error('Erreur:', err);
});