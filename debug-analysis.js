// Test de débogage pour l'analyse de parcelle étape par étape
require('ts-node').register({ transpileOnly: true });

async function testAnalysisSteps() {
  console.log('🔍 Test étapes d\'analyse...');
  
  try {
    // Test 1: Recherche de parcelle
    console.log('\n1. Test recherche parcelle...');
    const { searchParcel } = require('./src/lib/geoAdmin');
    const searchResult = await searchParcel('12558 vetroz 6025 ch773017495270');
    
    console.log('📄 Structure complète searchResult:');
    console.log(JSON.stringify(searchResult, null, 2));
    
    if (!searchResult?.egrid) {
      console.log('❌ Pas d\'EGRID dans searchResult, test de l\'API brute...');
      
      // Test API brute pour voir la réponse
      const axios = require('axios');
      const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/api/SearchServer', {
        params: {
          searchText: '12558 vetroz 6025 ch773017495270',
          type: 'locations',
          origins: 'parcel',
          limit: 3,
          sr: 2056,
          lang: 'fr'
        }
      });
      
      console.log('📄 Réponse API brute (premier résultat):');
      if (data?.results?.length) {
        console.log(JSON.stringify(data.results[0], null, 2));
      } else {
        console.log('Aucun résultat dans la réponse API');
      }
      return;
    }
    
    console.log('✅ EGRID trouvé:', searchResult.egrid);
    
    // Test 2: Construction URL RDPPF
    console.log('\n2. Test URL RDPPF...');
    const rdppfUrl = `https://rdppfvs.geopol.ch/extract/pdf?EGRID=${searchResult.egrid}&LANG=fr`;
    console.log('🔗 URL RDPPF:', rdppfUrl);
    
    // Test 3: Téléchargement RDPPF
    console.log('\n3. Test téléchargement RDPPF...');
    try {
      const { analyzeRdppf } = require('./src/lib/rdppfExtractor');
      const rdppfConstraints = await analyzeRdppf(rdppfUrl);
      console.log('✅ RDPPF analysé:', rdppfConstraints.length, 'contraintes');
      console.log('📄 Échantillon contraintes:', rdppfConstraints.slice(0, 2));
    } catch (rdppfError) {
      console.log('❌ Erreur RDPPF:', rdppfError.message);
    }
    
    // Test 4: Lecture règlement communal local
    console.log('\n4. Test règlement local...');
    try {
      const fs = require('fs/promises');
      const path = require('path');
      const localPath = path.join(process.cwd(), 'reglements/VS_Vétroz_Règlement des constructions.pdf');
      
      await fs.access(localPath);
      console.log('✅ Fichier règlement trouvé:', localPath);
      
      const { extractTextFromPdf } = require('./src/lib/rdppfExtractor');
      const regulationText = await extractTextFromPdf(localPath);
      console.log('✅ Texte extrait:', regulationText.length, 'caractères');
      console.log('📄 Début du texte:', regulationText.substring(0, 200) + '...');
      
      if (regulationText.length > 500) {
        const { extractConstraintsFromLargeText } = require('./src/lib/regulationExtractor');
        const constraints = await extractConstraintsFromLargeText(regulationText);
        console.log('✅ Contraintes extraites:', constraints.length);
        console.log('📄 Échantillon contraintes:', constraints.slice(0, 3));
      }
      
    } catch (regError) {
      console.log('❌ Erreur règlement:', regError.message);
    }
    
  } catch (error) {
    console.error('❌ Erreur globale:', error);
  }
}

testAnalysisSteps(); 