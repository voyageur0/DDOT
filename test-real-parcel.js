const http = require('http');

const data = JSON.stringify({
  searchQuery: "12558 vetroz 6025 ch773017495270"
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

console.log('🔍 Test analyse parcelle Vétroz...');

const req = http.request(options, (res) => {
  console.log(`✅ Réponse reçue: ${res.statusCode} ${res.statusMessage}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsed = JSON.parse(responseData);
      console.log('📄 Analyse terminée:');
      if (parsed.constraints) {
        console.log('🤖 Synthèse IA (premiers 500 caractères):');
        console.log(parsed.constraints.substring(0, 500) + '...');
      }
      if (parsed.completeness) {
        console.log(`📊 Complétude: ${parsed.completeness}%`);
      }
    } catch (e) {
      console.log('📄 Réponse brute:', responseData.substring(0, 300) + '...');
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Erreur: ${e.message}`);
});

req.write(data);
req.end(); 