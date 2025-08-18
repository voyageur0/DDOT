#!/usr/bin/env node

// Charger les variables d'environnement
require('dotenv').config();

const { performDirectAnalysis } = require('./src/lib/directDocumentAnalysis');

async function testDirect() {
  console.log('🎯 TEST ANALYSE DIRECTE - Parcelle 12558 Vétroz\n');
  console.log('EGRID: CH773017495270');
  console.log('Commune: Vétroz\n');
  
  try {
    const result = await performDirectAnalysis('CH773017495270', 'Vétroz');
    
    console.log('=== RESULTATS EXTRAITS ===\n');
    console.log('📍 Zone:', result.zone);
    console.log('📐 Surface:', result.surface, 'm²');
    
    console.log('\n=== CONTRAINTES TROUVEES ===');
    console.log('IBUS:', result.constraints.ibus || 'NON TROUVE');
    console.log('Hauteur max:', result.constraints.hauteurMax, 'm');
    console.log('Étages max:', result.constraints.etagesMax);
    console.log('Distance limites:', result.constraints.distanceLimites, 'm');
    console.log('Places parking:', result.constraints.parcStationnement, 'par logement');
    console.log('Espaces verts:', result.constraints.espacesVerts, '%');
    console.log('Aires de jeux:', result.constraints.airesJeux || 'NON SPECIFIE');
    console.log('Degré bruit:', result.constraints.degreBruit);
    
    console.log('\n=== CALCULS ===');
    const surfaceConstructible = result.surface * (result.constraints.ibus || 0.5);
    console.log('Surface constructible:', Math.round(surfaceConstructible), 'm²');
    console.log('Places parking pour 4 logements:', Math.ceil(4 * result.constraints.parcStationnement));
    console.log('Espaces verts requis:', Math.round(result.surface * result.constraints.espacesVerts / 100), 'm²');
    
    console.log('\n=== ANALYSE FINALE ===\n');
    console.log(result.analysisText);
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
    console.error(error.stack);
  }
}

testDirect();