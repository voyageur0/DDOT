// Test extraction RDPPF spécifique
require('dotenv').config();
require('ts-node').register({ transpileOnly: true });

async function testRdppfExtraction() {
  console.log('🔍 Test extraction RDPPF...');
  
  try {
    const { analyzeRdppf } = require('./src/lib/rdppfExtractor');
    
    const rdppfUrl = 'https://rdppfvs.geopol.ch/extract/pdf?EGRID=CH773017495270&LANG=fr';
    console.log('\n📑 Analyse RDPPF...');
    
    const constraints = await analyzeRdppf(rdppfUrl);
    
    console.log('\n📊 Contraintes RDPPF extraites:');
    console.log('- Nombre:', constraints.length);
    
    if (constraints.length > 0) {
      console.log('\n📋 Détail des contraintes:');
      constraints.forEach((c, i) => {
        console.log(`${i+1}. Thème: "${c.theme}"`);
        console.log(`   Type: ${typeof c.theme}, ${typeof c.rule}`);
        console.log(`   Règle: "${c.rule}"`);
        console.log(`   JSON: ${JSON.stringify(c)}`);
        console.log('---');
      });
    } else {
      console.log('❌ Aucune contrainte extraite');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testRdppfExtraction(); 