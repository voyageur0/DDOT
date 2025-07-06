// Test du nouvel extracteur OCR PDF
require('dotenv').config();
require('ts-node').register({ transpileOnly: true });

async function testPDFOCR() {
  console.log('🔍 Test extracteur OCR PDF complet...');
  
  try {
    const path = require('path');
    const { extractTextFromPDFWithOCR } = require('./src/lib/pdfOcrExtractor');
    
    // Fichier de test
    const regulationPath = path.join(process.cwd(), 'reglements/VS_Vétroz_Règlement des constructions.pdf');
    console.log('\n📄 Fichier testé:', path.basename(regulationPath));
    
    // Lancer l'extraction OCR complète
    console.log('\n🚀 Lancement extraction OCR...');
    const result = await extractTextFromPDFWithOCR(regulationPath);
    
    console.log('\n📊 Résultats de l\'extraction:');
    console.log(`- Texte extrait: ${result.text.length} caractères`);
    console.log(`- Confiance: ${result.confidence.toFixed(2)}%`);
    console.log(`- Pages traitées: ${result.pageCount}`);
    console.log(`- Temps de traitement: ${result.processingTime}ms`);
    console.log(`- Méthode utilisée: ${result.method}`);
    
    // Aperçu du texte extrait
    if (result.text.length > 0) {
      console.log('\n📝 Aperçu du texte extrait (500 premiers caractères):');
      console.log(result.text.substring(0, 500) + '...');
      
      console.log('\n🔍 Analyse du contenu:');
      const words = result.text.split(/\s+/).filter(w => w.length > 3);
      console.log(`- Nombre de mots: ${words.length}`);
      console.log(`- Mots-clés détectés: ${words.slice(0, 20).join(', ')}`);
      
      // Vérifier la présence de mots-clés d'urbanisme
      const urbanismKeywords = ['zone', 'construction', 'stationnement', 'hauteur', 'indice', 'gabarit'];
      const foundKeywords = urbanismKeywords.filter(keyword => 
        result.text.toLowerCase().includes(keyword)
      );
      console.log(`- Mots-clés d'urbanisme trouvés: ${foundKeywords.join(', ')}`);
      
      if (foundKeywords.length > 0) {
        console.log('✅ Le texte contient des informations d\'urbanisme');
      } else {
        console.log('⚠️ Peu de mots-clés d\'urbanisme détectés');
      }
    } else {
      console.log('❌ Aucun texte extrait');
    }
    
    console.log('\n🎯 Test terminé avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPDFOCR(); 