const http = require('http');

const data = JSON.stringify({
  searchQuery: "test parcelle"
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/ia-constraints',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('🔍 Test de la route /api/ia-constraints...');

const req = http.request(options, (res) => {
  console.log(`✅ Réponse reçue: ${res.statusCode} ${res.statusMessage}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('📄 Données reçues:', responseData.substring(0, 200) + '...');
  });
});

req.on('error', (e) => {
  console.error(`❌ Erreur: ${e.message}`);
});

req.write(data);
req.end(); 