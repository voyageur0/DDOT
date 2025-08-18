#!/usr/bin/env npx ts-node
require('dotenv').config();

import { analyzeSimple } from './src/lib/simpleDocumentAnalysis';

async function testO3Model() {
  console.log('🧪 TEST MODÈLE O3 (o1-preview)\n');
  console.log('📍 Parcelle: 12558 Vétroz');
  console.log('📍 EGRID: CH773017495270\n');
  
  const startTime = Date.now();
  
  try {
    const result = await analyzeSimple('CH773017495270', 'Vétroz');
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n=== RÉSULTAT ANALYSE O3 ===\n');
    console.log(result);
    console.log('\n=== STATISTIQUES ===');
    console.log(`⏱️ Durée: ${duration.toFixed(1)}s`);
    console.log(`📊 Longueur réponse: ${result.length} caractères`);
    
    // Vérifier que le résultat contient des contraintes réelles
    const hasRealData = result.includes('IBUS') || 
                       result.includes('hauteur') || 
                       result.includes('distance') ||
                       result.includes('stationnement') ||
                       result.includes('Zone');
    
    if (hasRealData) {
      console.log('✅ L\'analyse contient des contraintes réelles');
    } else {
      console.log('⚠️ L\'analyse semble générique');
    }
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    if (error.response?.data) {
      console.error('Détails:', error.response.data);
    }
  }
}

testO3Model().catch(console.error);