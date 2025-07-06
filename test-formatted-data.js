// Test données formatées pour OpenAI
require('dotenv').config();
require('ts-node').register({ transpileOnly: true });

async function testFormattedData() {
  console.log('🔍 Test données formatées...');
  
  try {
    const { performComprehensiveAnalysis } = require('./src/lib/parcelAnalysisOrchestrator');
    
    console.log('\n🚀 Analyse complète...');
    const analysis = await performComprehensiveAnalysis('12558 vetroz 6025 ch773017495270');
    
    console.log('\n📊 Contraintes collectées:');
    console.log('- RDPPF:', analysis.rdppfConstraints?.length || 0);
    console.log('- Communales:', analysis.communalConstraints?.length || 0);
    
    if (analysis.rdppfConstraints?.length) {
      console.log('\n📋 Contraintes RDPPF:');
      analysis.rdppfConstraints.forEach((c, i) => {
        console.log(`${i+1}. ${c.theme}: ${c.rule}`);
      });
    }
    
    if (analysis.communalConstraints?.length) {
      console.log('\n🏛️ Contraintes communales:');
      analysis.communalConstraints.slice(0, 5).forEach((c, i) => {
        console.log(`${i+1}. ${c.theme} (${c.zone}): ${c.rule.substring(0, 100)}...`);
      });
    }
    
    console.log('\n📝 SECTION CONTRAINTES dans formattedForAI:');
    const constraintSection = analysis.formattedForAI.split('## 4b. SYNTHÈSE DES CONTRAINTES')[1];
    if (constraintSection) {
      console.log(constraintSection.substring(0, 1000) + '...');
    } else {
      console.log('❌ Section contraintes non trouvée !');
      console.log('\n📄 Structure complète formattedForAI:');
      console.log(analysis.formattedForAI.substring(0, 2000) + '...');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testFormattedData(); 