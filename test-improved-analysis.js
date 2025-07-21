// Test de l'analyse améliorée
const axios = require('axios');

const API_URL = 'http://127.0.0.1:3001/api/ia-constraints';

async function testImprovedAnalysis() {
  console.log('🧪 Test de l\'analyse améliorée avec extraction RDPPF avancée...\n');
  
  const testQueries = [
    'Vétroz 12558',
    'Route de Savoie 10, Vétroz',
    'Parcelle 583, Vétroz'
  ];
  
  for (const query of testQueries) {
    console.log(`\n📍 Test avec: "${query}"`);
    console.log('='.repeat(60));
    
    try {
      const response = await axios.post(API_URL, {
        searchQuery: query,
        analysisType: 'comprehensive'
      }, {
        timeout: 60000 // 60 secondes
      });
      
      const result = response.data;
      
      if (result.success) {
        console.log('\n✅ Analyse réussie!');
        
        // Afficher les informations de zone extraites
        if (result.data.parcel) {
          console.log('\n📋 INFORMATIONS PARCELLE:');
          console.log(`- Zone: ${result.data.parcel.zone || 'Non trouvée'}`);
          console.log(`- Commune: ${result.data.parcel.commune}`);
          console.log(`- Surface: ${result.data.parcel.surface} m²`);
          console.log(`- EGRID: ${result.data.parcel.egrid}`);
        }
        
        // Afficher les contraintes principales
        console.log('\n🏗️ CONTRAINTES PRINCIPALES:');
        const constraints = result.data.constraints || [];
        
        // Grouper par sévérité
        const critical = constraints.filter(c => c.severity === 'critical');
        const high = constraints.filter(c => c.severity === 'high');
        const medium = constraints.filter(c => c.severity === 'medium');
        
        if (critical.length > 0) {
          console.log('\n🚨 Contraintes CRITIQUES:');
          critical.forEach(c => {
            console.log(`  - ${c.title}: ${c.description}`);
            if (c.details?.values) {
              console.log(`    Valeur: ${JSON.stringify(c.details.values)}`);
            }
          });
        }
        
        if (high.length > 0) {
          console.log('\n⚠️  Contraintes ÉLEVÉES:');
          high.slice(0, 5).forEach(c => {
            console.log(`  - ${c.title}: ${c.description.substring(0, 100)}...`);
          });
        }
        
        if (medium.length > 0) {
          console.log('\n📋 Contraintes MOYENNES:');
          medium.slice(0, 3).forEach(c => {
            console.log(`  - ${c.title}: ${c.description.substring(0, 80)}...`);
          });
        }
        
        // Afficher le résumé
        if (result.data.summary) {
          console.log('\n📄 RÉSUMÉ:');
          console.log(result.data.summary);
        }
        
        // Métriques
        console.log('\n📊 MÉTRIQUES:');
        console.log(`- Nombre total de contraintes: ${constraints.length}`);
        console.log(`- Durée d'analyse: ${result.metadata?.duration}ms`);
        console.log(`- Confiance: ${result.metadata?.confidence}%`);
        
      } else {
        console.log('❌ Échec de l\'analyse:', result.error);
      }
      
    } catch (error) {
      console.error('❌ Erreur:', error.response?.data?.error || error.message);
    }
    
    // Attendre entre les tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Lancer le test
testImprovedAnalysis().catch(console.error);