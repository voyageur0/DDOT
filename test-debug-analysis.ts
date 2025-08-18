#!/usr/bin/env npx ts-node
require('dotenv').config();

import { performComprehensiveAnalysis } from './src/lib/parcelAnalysisOrchestrator';
import { analyzeSimple } from './src/lib/simpleDocumentAnalysis';

async function debugAnalysis() {
  console.log('🔍 DEBUG ANALYSE COMPLÈTE\n');
  
  // Test avec la vraie parcelle 12558 Vétroz
  console.log('=== TEST 1: Parcelle 12558 Vétroz ===\n');
  
  try {
    // D'abord rechercher la parcelle
    const result = await performComprehensiveAnalysis('12558 Vétroz');
    
    console.log('📍 Résultat recherche:');
    console.log('  - EGRID:', result.searchResult?.egrid);
    console.log('  - Numéro:', result.searchResult?.number);
    console.log('  - Municipality:', result.parcelDetails?.municipality);
    console.log('  - Zone RDPPF:', result.rdppfData?.zoneAffectation?.designation);
    console.log('  - Surface:', result.parcelDetails?.surface || result.rdppfData?.zoneAffectation?.surface);
    
    if (result.searchResult?.egrid) {
      console.log('\n📄 Lancement analyse simple avec EGRID...');
      const municipality = result.parcelDetails?.municipality || 
        result.searchResult?.number?.match(/<b>([^<]+)<\/b>/)?.[1]?.replace(/^\d{4}\s+/, '') || 
        'Vétroz';
      
      const simpleResult = await analyzeSimple(result.searchResult.egrid, municipality);
      
      console.log('\n✅ Résultat analyse (premiers 500 caractères):');
      console.log(simpleResult.substring(0, 500));
      
      // Vérifier le contenu
      const hasRealData = simpleResult.includes('Zone résidentielle') || 
                         simpleResult.includes('IBUS') || 
                         simpleResult.includes('862 m²');
      
      if (hasRealData) {
        console.log('\n✅ L\'analyse contient des données réelles');
      } else {
        console.log('\n⚠️ L\'analyse semble générique');
      }
    }
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  }
  
  // Test avec Route Cantonale 199
  console.log('\n\n=== TEST 2: Route Cantonale 199 Vétroz ===\n');
  
  try {
    const result2 = await performComprehensiveAnalysis('Route Cantonale 199 Vétroz');
    
    console.log('📍 Résultat recherche:');
    console.log('  - EGRID:', result2.searchResult?.egrid);
    console.log('  - Numéro:', result2.searchResult?.number);
    console.log('  - Zone RDPPF:', result2.rdppfData?.zoneAffectation?.designation);
    
    if (result2.searchResult?.egrid) {
      const municipality = result2.parcelDetails?.municipality || 
        result2.searchResult?.number?.match(/<b>([^<]+)<\/b>/)?.[1]?.replace(/^\d{4}\s+/, '') || 
        'Vétroz';
      
      console.log('\n📄 Analyse pour parcelle en zone agricole...');
      const simpleResult = await analyzeSimple(result2.searchResult.egrid, municipality);
      
      console.log('\n✅ Résultat (premiers 500 caractères):');
      console.log(simpleResult.substring(0, 500));
      
      // Cette parcelle devrait être en zone agricole
      const isAgricole = simpleResult.includes('agricole') || 
                        simpleResult.includes('hors zone à bâtir') ||
                        simpleResult.includes('LAT');
      
      if (isAgricole) {
        console.log('\n✅ Parcelle correctement identifiée comme agricole/hors zone');
      } else {
        console.log('\n⚠️ Zone non correctement identifiée');
      }
    }
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  }
}

debugAnalysis().catch(console.error);