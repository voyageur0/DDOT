const axios = require('axios');

async function testAPI() {
  console.log('🧪 Test simple de l\'API avec timeout court...\n');
  
  try {
    // Test avec une requête simple et timeout court
    const response = await axios.post('http://127.0.0.1:3001/api/ia-constraints', {
      searchQuery: 'test parcelle Sion',
      analysisType: 'quick'
    }, {
      timeout: 5000 // 5 secondes max
    });
    
    console.log('✅ Réponse reçue');
    
    if (response.data.error) {
      console.log('❌ Erreur API:', response.data.error);
    } else {
      console.log('📊 Données reçues');
    }
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('⏱️ Timeout - L\'API prend trop de temps');
    } else if (error.response) {
      console.log('❌ Erreur HTTP:', error.response.status);
    } else {
      console.log('❌ Erreur:', error.message);
    }
  }
}

testAPI();