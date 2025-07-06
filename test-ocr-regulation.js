// Test OCR vs pdf-parse pour les règlements communaux
require('dotenv').config();
require('ts-node').register({ transpileOnly: true });

async function testOCRRegulation() {
  console.log('🔍 Test OCR vs pdf-parse pour règlements communaux...');
  
  try {
    const fs = require('fs/promises');
    const path = require('path');
    
    // Fichier de test
    const regulationPath = path.join(process.cwd(), 'reglements/VS_Vétroz_Règlement des constructions.pdf');
    
    console.log('\n📄 Fichier testé:', regulationPath);
    
    // 1. Extraction avec pdf-parse
    console.log('\n1. Extraction pdf-parse...');
    const { extractTextFromPdf } = require('./src/lib/rdppfExtractor');
    const pdfText = await extractTextFromPdf(regulationPath);
    console.log(`✅ pdf-parse: ${pdfText.length} caractères`);
    
    // 2. Test needsOCR
    console.log('\n2. Test qualité du texte...');
    const { needsOCR } = require('./src/lib/ocrService');
    const needsOcrCheck = needsOCR(pdfText);
    console.log(`🔍 Besoin d'OCR: ${needsOcrCheck}`);
    
    // 3. Extraction avec OCR
    console.log('\n3. Extraction OCR...');
    const { extractTextFromBuffer, cleanOCRText } = require('./src/lib/ocrService');
    const pdfBuffer = await fs.readFile(regulationPath);
    
    console.log(`⏳ Lancement OCR sur ${pdfBuffer.length} bytes...`);
    const ocrResult = await extractTextFromBuffer(pdfBuffer, 'fra');
    
    console.log(`✅ OCR terminé: ${ocrResult.text.length} caractères`);
    console.log(`🎯 Confiance: ${ocrResult.confidence.toFixed(2)}%`);
    console.log(`⏱️ Temps: ${ocrResult.processingTime}ms`);
    
    // 4. Comparaison
    console.log('\n4. Comparaison des résultats:');
    console.log(`- pdf-parse: ${pdfText.length} caractères`);
    console.log(`- OCR: ${ocrResult.text.length} caractères`);
    console.log(`- Rapport: ${(ocrResult.text.length / pdfText.length * 100).toFixed(1)}%`);
    
    // 5. Aperçu du contenu
    console.log('\n5. Aperçu pdf-parse (300 premiers caractères):');
    console.log(pdfText.substring(0, 300) + '...');
    
    console.log('\n6. Aperçu OCR (300 premiers caractères):');
    console.log(ocrResult.text.substring(0, 300) + '...');
    
    // 6. Décision finale
    console.log('\n7. Décision finale:');
    if (needsOcrCheck) {
      console.log('🔍 Texte pdf-parse de faible qualité → OCR recommandé');
    } else {
      console.log('✅ Texte pdf-parse de bonne qualité → OCR pas nécessaire');
    }
    
    if (ocrResult.confidence > 70 && ocrResult.text.length > pdfText.length) {
      console.log('✅ OCR améliore le texte → Utiliser OCR');
    } else {
      console.log('⚠️ OCR pas meilleur → Garder pdf-parse');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
  }
}

testOCRRegulation(); 