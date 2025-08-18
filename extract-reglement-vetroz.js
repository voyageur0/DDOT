const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');

async function extractReglement() {
  console.log('📋 Extraction du règlement de Vétroz pour zone 0.5\n');
  
  const pdfPath = path.join(__dirname, 'reglements', 'VS_Vétroz_Règlement des constructions.pdf');
  const pdfBuffer = await fs.readFile(pdfPath);
  const pdfData = await pdfParse(pdfBuffer);
  
  console.log('Pages:', pdfData.numpages);
  console.log('Caractères:', pdfData.text.length, '\n');
  
  // Chercher spécifiquement la zone 0.5
  const lines = pdfData.text.split('\n');
  
  console.log('=== RECHERCHE ZONE 0.5 ===\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('0.5') || line.includes('0,5')) {
      console.log(`Ligne ${i}: ${line}`);
      // Afficher le contexte
      if (i > 0) console.log(`  Avant: ${lines[i-1]}`);
      if (i < lines.length - 1) console.log(`  Après: ${lines[i+1]}`);
      console.log('---');
    }
  }
  
  console.log('\n=== RECHERCHE HAUTEURS ===\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/hauteur.*?\d+\s*m/i) || line.match(/\d+\s*m.*?hauteur/i)) {
      console.log(`Ligne ${i}: ${line}`);
    }
  }
  
  console.log('\n=== RECHERCHE DISTANCES ===\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/distance.*?limite.*?\d+/i) || line.match(/\d+\s*m.*?limite/i)) {
      console.log(`Ligne ${i}: ${line}`);
    }
  }
  
  console.log('\n=== RECHERCHE STATIONNEMENT ===\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/place.*?parc|stationnement|parking/i)) {
      console.log(`Ligne ${i}: ${line.substring(0, 150)}`);
    }
  }
  
  console.log('\n=== RECHERCHE ESPACES VERTS ===\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/espace.*?vert|vert.*?%|arborisation/i)) {
      console.log(`Ligne ${i}: ${line.substring(0, 150)}`);
    }
  }
  
  console.log('\n=== RECHERCHE TABLEAU SYNOPTIQUE (page 40) ===\n');
  // Chercher autour de la page 40
  const pageSize = Math.floor(pdfData.text.length / pdfData.numpages);
  const page40Start = pageSize * 39;
  const page40End = pageSize * 41;
  const page40Text = pdfData.text.substring(page40Start, page40End);
  
  console.log('Extrait autour de la page 40:');
  console.log(page40Text.substring(0, 2000));
}

extractReglement().catch(console.error);