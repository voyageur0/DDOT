const axios = require('axios');

async function testAPIOutput() {
  try {
    console.log('🔍 Test de l\'API /api/ia-constraints...\n');
    
    const response = await axios.post('http://127.0.0.1:3001/api/ia-constraints', {
      searchQuery: 'Rue de Lausanne 35 Sion'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 RÉPONSE COMPLÈTE:\n');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.data && response.data.data.constraints) {
      console.log('\n⚠️  CONTRAINTES RETOURNÉES:');
      response.data.data.constraints.forEach((c, i) => {
        console.log(`\n${i+1}. ${c.title}`);
        console.log(`   Description: ${c.description}`);
        console.log(`   Sévérité: ${c.severity}`);
        console.log(`   Source: ${c.source}`);
      });
    }
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Erreur API:', error.response.status, error.response.data);
    } else {
      console.error('❌ Erreur:', error.message);
    }
  }
}

testAPIOutput();