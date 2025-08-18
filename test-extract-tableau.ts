#!/usr/bin/env npx ts-node
import * as fs from 'fs/promises';
import * as path from 'path';
const pdfParse = require('pdf-parse');

async function extractTableau() {
  const regulationPath = path.join(
    process.cwd(),
    'reglements',
    'VS_Vétroz_Règlement des constructions.pdf'
  );
  
  console.log('📖 Extraction du tableau synoptique...\n');
  
  const pdfBuffer = await fs.readFile(regulationPath);
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text;
  
  // Chercher le tableau synoptique
  const startIdx = text.indexOf('Art 111');
  if (startIdx > 0) {
    // Prendre 8000 caractères pour voir ce qu'on récupère
    const tableauText = text.substring(startIdx, startIdx + 8000);
    
    console.log('=== TABLEAU SYNOPTIQUE EXTRAIT ===\n');
    console.log(tableauText);
    
    // Chercher spécifiquement la zone 0.5
    console.log('\n=== RECHERCHE ZONE 0.5 ===\n');
    const lines = tableauText.split('\n');
    for (const line of lines) {
      if (line.includes('0.5') || line.includes('0,5') || 
          line.includes('R1') || line.includes('R2') || line.includes('R3') ||
          line.includes('hauteur') || line.includes('distance') || 
          line.includes('IBUS') || line.includes('étages')) {
        console.log(line);
      }
    }
  } else {
    console.log('❌ Art 111 non trouvé');
  }
}

extractTableau().catch(console.error);