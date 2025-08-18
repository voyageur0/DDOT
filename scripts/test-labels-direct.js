const axios = require('axios');

async function testLabelsInAPI() {
  console.log('🧪 Test des labels dans l\'API\n');
  
  try {
    // Faire une requête de test
    const response = await axios.post('http://127.0.0.1:3001/api/ia-constraints', {
      searchQuery: 'Rue de Lausanne 35 Sion',
      analysisType: 'quick'  // Pour aller plus vite
    });
    
    if (response.data.data && response.data.data.constraints) {
      const constraints = response.data.data.constraints;
      
      console.log(`📊 ${constraints.length} contraintes trouvées:\n`);
      
      constraints.forEach((c, i) => {
        console.log(`${i+1}. TITRE: "${c.title}"`);
        console.log(`   DESC: "${c.description}"`);
        console.log(`   Longueur titre: ${c.title.split(' ').length} mots`);
        console.log(`   Longueur desc: ${c.description.split(' ').length} mots`);
        console.log(`   Catégorie: ${c.category}`);
        console.log(`   Sévérité: ${c.severity}`);
        console.log('   ---');
      });
      
      // Analyser les problèmes
      console.log('\n❌ PROBLÈMES DÉTECTÉS:');
      let problems = 0;
      
      constraints.forEach((c, i) => {
        const titleWords = c.title.split(' ').length;
        const descWords = c.description.split(' ').length;
        
        if (titleWords > 12) {
          console.log(`- Contrainte ${i+1}: Titre trop long (${titleWords} mots)`);
          problems++;
        }
        if (descWords > 12) {
          console.log(`- Contrainte ${i+1}: Description trop longue (${descWords} mots)`);
          problems++;
        }
        if (c.description.endsWith('…') && descWords < 12) {
          console.log(`- Contrainte ${i+1}: Description tronquée inutilement`);
          problems++;
        }
      });
      
      if (problems === 0) {
        console.log('✅ Tous les labels respectent la limite de 12 mots');
      }
      
      // Vérifier si les labels normalisés sont utilisés
      console.log('\n🏷️  VÉRIFICATION DES LABELS NORMALISÉS:');
      
      const expectedPatterns = [
        { pattern: /Hauteur max/, found: false },
        { pattern: /IBUS/, found: false },
        { pattern: /Espaces verts/, found: false },
        { pattern: /Stationnement/, found: false },
        { pattern: /Distance limite/, found: false }
      ];
      
      constraints.forEach(c => {
        expectedPatterns.forEach(p => {
          if (c.title.match(p.pattern) || c.description.match(p.pattern)) {
            p.found = true;
          }
        });
      });
      
      expectedPatterns.forEach(p => {
        console.log(`${p.found ? '✅' : '❌'} Pattern "${p.pattern.source}" ${p.found ? 'trouvé' : 'non trouvé'}`);
      });
      
    } else {
      console.log('❌ Aucune contrainte dans la réponse');
    }
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Erreur API:', error.response.status, error.response.data);
    } else {
      console.error('❌ Erreur:', error.message);
    }
  }
}

testLabelsInAPI();