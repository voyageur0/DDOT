// Test orchestrateur avec debug
require('dotenv').config();
require('ts-node').register({ transpileOnly: true });

async function testOrchestrator() {
  console.log('🔍 Test orchestrateur avec debug...');
  
  try {
    const { performComprehensiveAnalysis } = require('./src/lib/parcelAnalysisOrchestrator');
    
    console.log('\n🚀 Lancement analyse complète...');
    const analysis = await performComprehensiveAnalysis('12558 vetroz 6025 ch773017495270');
    
    console.log('\n📊 Résultat orchestrateur:');
    console.log('- searchResult.egrid:', analysis.searchResult?.egrid);
    console.log('- parcelDetails:', !!analysis.parcelDetails);
    console.log('- rdppfConstraints.length:', analysis.rdppfConstraints?.length || 0);
    console.log('- communalConstraints.length:', analysis.communalConstraints?.length || 0);
    console.log('- erreurs:', analysis.errors);
    console.log('- complétude:', analysis.completeness + '%');
    
    if (analysis.rdppfConstraints?.length) {
      console.log('\n📋 RDPPF constraints échantillon:');
      analysis.rdppfConstraints.slice(0, 3).forEach((c, i) => {
        console.log(`${i+1}. ${c.theme}: ${c.rule.substring(0, 100)}...`);
      });
    }
    
    if (analysis.communalConstraints?.length) {
      console.log('\n🏛️ Contraintes communales échantillon:');
      analysis.communalConstraints.slice(0, 3).forEach((c, i) => {
        console.log(`${i+1}. ${c.theme} (${c.zone}): ${c.rule.substring(0, 100)}...`);
      });
    }
    
    console.log('\n📝 Données formatées pour IA (début):');
    console.log(analysis.formattedForAI.substring(0, 500) + '...');
    
  } catch (error) {
    console.error('❌ Erreur orchestrateur:', error.message);
  }
}

testOrchestrator(); 