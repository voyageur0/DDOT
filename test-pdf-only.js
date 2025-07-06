// Test PDF sans OpenAI
require('ts-node').register({ transpileOnly: true });

async function testPdfExtraction() {
  console.log('🔍 Test extraction PDF...');
  
  try {
    // Test 1: Téléchargement RDPPF
    console.log('\n1. Test téléchargement RDPPF...');
    const axios = require('axios');
    const fs = require('fs/promises');
    const path = require('path');
    
    const rdppfUrl = 'https://rdppfvs.geopol.ch/extract/pdf?EGRID=CH773017495270&LANG=fr';
    console.log('🔗 URL:', rdppfUrl);
    
    try {
      const response = await axios.get(rdppfUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000 
      });
      console.log('✅ PDF téléchargé, taille:', response.data.byteLength, 'bytes');
      
      const buffer = Buffer.from(response.data);
      const tmpDir = path.join(process.cwd(), 'uploads');
      await fs.mkdir(tmpDir, { recursive: true });
      const filePath = path.join(tmpDir, `rdppf-test.pdf`);
      await fs.writeFile(filePath, buffer);
      console.log('💾 PDF sauvegardé:', filePath);
      
      // Test extraction texte
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      console.log('📄 Texte extrait:', data.text.length, 'caractères');
      console.log('📄 Début du texte RDPPF:');
      console.log(data.text.substring(0, 300) + '...');
      
    } catch (rdppfError) {
      console.log('❌ Erreur RDPPF:', rdppfError.message);
    }
    
    // Test 2: Lecture règlement local
    console.log('\n2. Test règlement local...');
    try {
      const localPath = path.join(process.cwd(), 'reglements/VS_Vétroz_Règlement des constructions.pdf');
      
      const dataBuffer = await fs.readFile(localPath);
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(dataBuffer);
      console.log('✅ Règlement lu:', data.text.length, 'caractères');
      console.log('📄 Début du règlement:');
      console.log(data.text.substring(0, 300) + '...');
      
    } catch (regError) {
      console.log('❌ Erreur règlement:', regError.message);
    }
    
  } catch (error) {
    console.error('❌ Erreur globale:', error);
  }
}

testPdfExtraction(); 