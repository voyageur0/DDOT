const fs = require('fs');
const path = require('path');

// Lire le contenu du RDPPF extrait
const rdppfPath = '/Users/oktaydemir/DDOT/uploads/rdppf-1754916726577.pdf';
const pdfParse = require('pdf-parse');

async function displayRdppfContent() {
  const dataBuffer = await fs.promises.readFile(rdppfPath);
  const data = await pdfParse(dataBuffer);
  
  console.log('=== CONTENU DU RDPPF (parcelle 12558 Vétroz) ===\n');
  console.log('Pages:', data.numpages);
  console.log('Caractères:', data.text.length);
  console.log('\n=== EXTRAIT DU TEXTE (2000 premiers caractères) ===\n');
  console.log(data.text.substring(0, 2000));
  
  console.log('\n=== RECHERCHE DE VALEURS IMPORTANTES ===\n');
  
  // Rechercher des patterns importants
  const patterns = [
    /Zone.*?:\s*(.+)/gi,
    /Surface.*?:\s*(\d+)\s*m²/gi,
    /IBUS.*?:\s*([\d.]+)/gi,
    /Indice.*?:\s*([\d.]+)/gi,
    /Hauteur.*?:\s*(\d+)\s*m/gi,
    /Distance.*?:\s*(\d+)\s*m/gi,
    /DS\s*(I+)/gi,
    /étages?.*?:\s*(\d+)/gi
  ];
  
  for (const pattern of patterns) {
    const matches = [...data.text.matchAll(pattern)];
    if (matches.length > 0) {
      console.log(`Pattern ${pattern.source}:`);
      for (const match of matches.slice(0, 3)) {
        console.log(`  - ${match[0]}`);
      }
    }
  }
  
  // Sauvegarder le texte complet pour analyse
  const outputPath = '/Users/oktaydemir/DDOT/rdppf-text.txt';
  await fs.promises.writeFile(outputPath, data.text);
  console.log(`\n✅ Texte complet sauvegardé dans: ${outputPath}`);
}

displayRdppfContent().catch(console.error);