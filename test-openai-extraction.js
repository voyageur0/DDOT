// Test extraction OpenAI avec vrais PDFs
require('dotenv').config(); // Charger les variables d'environnement
require('ts-node').register({ transpileOnly: true });

async function testOpenAIExtraction() {
  console.log('🔍 Test extraction OpenAI...');
  
  try {
    // 1. Charger le texte du règlement
    console.log('\n1. Lecture règlement Vétroz...');
    const fs = require('fs/promises');
    const path = require('path');
    const pdfParse = require('pdf-parse');
    
    const localPath = path.join(process.cwd(), 'reglements/VS_Vétroz_Règlement des constructions.pdf');
    const dataBuffer = await fs.readFile(localPath);
    const data = await pdfParse(dataBuffer);
    
    console.log('✅ Règlement lu:', data.text.length, 'caractères');
    
    // 2. Test extraction contraintes via OpenAI
    console.log('\n2. Test extraction OpenAI...');
    const { extractConstraintsFromLargeText } = require('./src/lib/regulationExtractor');
    
    // Prendre un échantillon du texte pour test
    const sampleText = data.text.substring(0, 5000);
    console.log('📝 Échantillon analysé:', sampleText.length, 'caractères');
    console.log('📝 Début échantillon:');
    console.log(sampleText.substring(0, 300) + '...');
    
    const constraints = await extractConstraintsFromLargeText(sampleText);
    console.log('\n✅ Contraintes extraites:', constraints.length);
    
    if (constraints.length > 0) {
      console.log('📄 Échantillon contraintes:');
      constraints.slice(0, 5).forEach((c, i) => {
        console.log(`${i+1}. Thème: ${c.theme} | Zone: ${c.zone} | Règle: ${c.rule.substring(0, 100)}...`);
      });
    } else {
      console.log('❌ Aucune contrainte extraite - problème OpenAI ou prompt');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testOpenAIExtraction(); 