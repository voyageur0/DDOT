// Test simple de l'extraction RDPPF
const { downloadRdppf, extractTextFromPdf, extractRdppfConstraints } = require('./dist/lib/rdppfExtractor');

async function testRdppfExtraction() {
  console.log('🧪 Test de l\'extraction RDPPF améliorée...\n');
  
  // EGRID de test (Vétroz 12558)
  const egrid = 'CH773017495270';
  const rdppfUrl = `https://rdppfvs.geopol.ch/extract/pdf?EGRID=${egrid}&LANG=fr`;
  
  try {
    console.log('📥 Téléchargement du RDPPF...');
    const pdfPath = await downloadRdppf(rdppfUrl);
    console.log(`✅ PDF téléchargé: ${pdfPath}`);
    
    console.log('\n📄 Extraction du texte...');
    const text = await extractTextFromPdf(pdfPath);
    console.log(`✅ Texte extrait: ${text.length} caractères`);
    
    // Chercher la zone dans le texte brut
    const lines = text.split('\n');
    console.log('\n🔍 Recherche de la zone d\'affectation...');
    
    for (const line of lines) {
      if (line.includes('Zone résidentielle') || 
          line.includes('Zone à bâtir') ||
          line.includes('Degré de sensibilité')) {
        console.log(`  > ${line.trim()}`);
      }
    }
    
    console.log('\n🤖 Analyse avec OpenAI...');
    const constraints = await extractRdppfConstraints(text);
    
    console.log(`\n✅ ${constraints.length} contraintes extraites:`);
    constraints.forEach((c, i) => {
      console.log(`\n${i + 1}. ${c.theme}`);
      console.log(`   ${c.rule}`);
    });
    
    // Vérifier si on a bien extrait la zone
    const zoneConstraint = constraints.find(c => c.theme === 'Destination de zone');
    if (zoneConstraint) {
      console.log('\n✅ ZONE TROUVÉE:', zoneConstraint.rule);
    } else {
      console.log('\n❌ Aucune zone trouvée');
    }
    
    // Vérifier le degré de sensibilité
    const noiseConstraint = constraints.find(c => 
      c.rule.includes('Degré de sensibilité')
    );
    if (noiseConstraint) {
      console.log('✅ DEGRÉ DE SENSIBILITÉ TROUVÉ:', noiseConstraint.rule);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

// Lancer le test
testRdppfExtraction().catch(console.error);