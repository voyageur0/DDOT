#!/usr/bin/env node

/**
 * Script de test pour l'analyse IA conversationnelle
 * Compare l'ancienne approche structurée avec la nouvelle approche conversationnelle
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api/ia-constraints';

// Parcelle de test
const TEST_PARCEL = 'Rue du Scex 10, Sion';

async function testAnalysis(useConversational = true) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Test ${useConversational ? 'CONVERSATIONNEL' : 'STRUCTURÉ'} - ${TEST_PARCEL}`);
  console.log('='.repeat(80));
  
  try {
    const response = await axios.post(API_URL, {
      searchQuery: TEST_PARCEL,
      analysisType: 'complete',
      useConversational: useConversational
    }, {
      timeout: 120000 // 2 minutes timeout
    });
    
    const { data, metadata } = response.data;
    
    console.log('\n📊 MÉTADONNÉES:');
    console.log(`  - Type d'analyse: ${response.data.analysisType}`);
    console.log(`  - Complétude: ${metadata.completeness}%`);
    console.log(`  - Confiance: ${metadata.confidence}%`);
    console.log(`  - Temps de traitement: ${metadata.elapsedMs}ms`);
    
    if (useConversational) {
      // Affichage mode conversationnel
      console.log('\n📝 ANALYSE CONVERSATIONNELLE:');
      console.log('-'.repeat(80));
      console.log(data.analysis);
      console.log('-'.repeat(80));
      
      if (data.additionalInsights) {
        console.log('\n💡 INSIGHTS SUPPLÉMENTAIRES:');
        console.log(data.additionalInsights);
      }
      
      if (metadata.sources) {
        console.log('\n📚 SOURCES CONSULTÉES:');
        metadata.sources.forEach(source => console.log(`  - ${source}`));
      }
      
      if (metadata.webSearchResults) {
        console.log('\n🔍 RECHERCHES WEB:');
        metadata.webSearchResults.forEach(result => {
          console.log(`  - ${result.title}`);
          console.log(`    ${result.snippet}`);
        });
      }
    } else {
      // Affichage mode structuré
      console.log('\n📋 CONTRAINTES STRUCTURÉES:');
      if (data.constraints && data.constraints.length > 0) {
        data.constraints.forEach((constraint, idx) => {
          console.log(`\n${idx + 1}. ${constraint.title} [${constraint.severity}]`);
          console.log(`   ${constraint.description}`);
          if (constraint.source) console.log(`   Source: ${constraint.source}`);
        });
      }
      
      if (data.summary) {
        console.log('\n📄 RÉSUMÉ:');
        console.log(data.summary);
      }
    }
    
    console.log('\n✅ Test terminé avec succès');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.response?.data || error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Le serveur n\'est pas démarré. Lancez "npm run dev" d\'abord.');
    }
  }
}

async function runComparison() {
  console.log('🚀 Démarrage des tests d\'analyse IA\n');
  console.log('Ce test va comparer les deux modes d\'analyse:');
  console.log('1. Mode structuré (ancien système avec contraintes formatées)');
  console.log('2. Mode conversationnel (nouveau système avec réponse naturelle)');
  
  // Test mode structuré
  await testAnalysis(false);
  
  // Attendre un peu entre les tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test mode conversationnel
  await testAnalysis(true);
  
  console.log('\n' + '='.repeat(80));
  console.log('🏁 TESTS TERMINÉS');
  console.log('='.repeat(80));
  console.log('\n📊 COMPARAISON:');
  console.log('- Mode STRUCTURÉ: Fournit des contraintes catégorisées et normalisées');
  console.log('- Mode CONVERSATIONNEL: Fournit une analyse naturelle et fluide');
  console.log('\n💡 Recommandation: Utiliser le mode conversationnel pour une meilleure UX');
}

// Lancer les tests
runComparison().catch(console.error);