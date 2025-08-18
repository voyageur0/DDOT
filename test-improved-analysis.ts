#!/usr/bin/env npx ts-node
require('dotenv').config();

import { analyzeSimple } from './src/lib/simpleDocumentAnalysis';

async function testImprovedAnalysis() {
  console.log('🧪 TEST ANALYSE AMÉLIORÉE\n');
  console.log('📍 Parcelle: 12558 Vétroz');
  console.log('📍 EGRID: CH773017495270');
  console.log('📍 Numéro seul: 12558 (sans adresse)\n');
  
  const startTime = Date.now();
  
  try {
    // Test avec le numéro de parcelle SANS l'adresse
    const result = await analyzeSimple('CH773017495270', 'Vétroz', '12558');
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n=== RÉSULTAT ANALYSE AMÉLIORÉE ===\n');
    console.log(result);
    console.log('\n=== STATISTIQUES ===');
    console.log(`⏱️ Durée: ${duration.toFixed(1)}s`);
    console.log(`📊 Longueur réponse: ${result.length} caractères`);
    
    // Vérifier les éléments clés
    const hasZone = result.includes('Zone résidentielle 0.5') || result.includes('Zone résidentielle 0,5');
    const hasIBUS = result.includes('IBUS') || result.includes('0.5') || result.includes('0,5');
    const hasHeight = result.includes('hauteur') || result.includes('mètres') || result.includes('étages');
    const hasDistance = result.includes('distance') || result.includes('limite') || result.includes('recul');
    const hasParking = result.includes('stationnement') || result.includes('parking') || result.includes('place');
    const hasTableau = result.includes('Art 111') || result.includes('tableau synoptique');
    
    console.log('\n=== VÉRIFICATION CONTENU ===');
    console.log(`✅ Zone identifiée: ${hasZone ? 'OUI' : 'NON'}`);
    console.log(`✅ IBUS trouvé: ${hasIBUS ? 'OUI' : 'NON'}`);
    console.log(`✅ Hauteur mentionnée: ${hasHeight ? 'OUI' : 'NON'}`);
    console.log(`✅ Distances mentionnées: ${hasDistance ? 'OUI' : 'NON'}`);
    console.log(`✅ Stationnement mentionné: ${hasParking ? 'OUI' : 'NON'}`);
    console.log(`✅ Tableau synoptique utilisé: ${hasTableau ? 'OUI' : 'NON'}`);
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    if (error.response?.data) {
      console.error('Détails:', error.response.data);
    }
  }
}

testImprovedAnalysis().catch(console.error);