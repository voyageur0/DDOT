#!/usr/bin/env npx ts-node
import * as fs from 'fs/promises';
import * as path from 'path';
const pdfParse = require('pdf-parse');

async function extractArticle91() {
  const regulationPath = path.join(
    process.cwd(),
    'reglements',
    'VS_Vétroz_Règlement des constructions.pdf'
  );
  
  console.log('📖 Lecture du règlement de Vétroz...\n');
  
  const pdfBuffer = await fs.readFile(regulationPath);
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text;
  
  // Chercher l'article 91
  const lines = text.split('\n');
  let inArticle91 = false;
  let article91Content = [];
  let contextLines = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Détecter le début de l'article 91
    if (line.match(/Art\.?\s*91/i) || line.includes('Zone résidentielle 0.5')) {
      console.log(`✅ Trouvé à la ligne ${i}: ${line}\n`);
      inArticle91 = true;
      contextLines = 0;
      
      // Prendre aussi quelques lignes avant
      if (i > 2) {
        article91Content.push('--- Contexte avant ---');
        article91Content.push(lines[i-2]);
        article91Content.push(lines[i-1]);
      }
    }
    
    if (inArticle91) {
      article91Content.push(line);
      contextLines++;
      
      // Arrêter après 30 lignes ou au prochain article
      if (contextLines > 30 || (contextLines > 5 && line.match(/Art\.?\s*92/i))) {
        break;
      }
    }
  }
  
  if (article91Content.length > 0) {
    console.log('=== ARTICLE 91 ET CONTEXTE ===\n');
    console.log(article91Content.join('\n'));
  } else {
    console.log('❌ Article 91 non trouvé');
    
    // Chercher des indices IBUS ou zone 0.5 dans tout le document
    console.log('\n🔍 Recherche de "0.5" ou "IBUS" dans le document...\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('0.5') || line.includes('0,5') || line.toUpperCase().includes('IBUS')) {
        console.log(`Ligne ${i}: ${line}`);
      }
    }
  }
  
  // Chercher aussi le tableau synoptique (Art. 111)
  console.log('\n\n=== RECHERCHE TABLEAU SYNOPTIQUE (Art. 111) ===\n');
  
  let inTableau = false;
  let tableauContent = [];
  contextLines = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.match(/Art\.?\s*111/i) || line.includes('Tableau synoptique')) {
      console.log(`✅ Trouvé tableau à la ligne ${i}: ${line}\n`);
      inTableau = true;
      contextLines = 0;
    }
    
    if (inTableau) {
      tableauContent.push(line);
      contextLines++;
      
      // Prendre plus de lignes pour le tableau
      if (contextLines > 100 || (contextLines > 10 && line.match(/Art\.?\s*112/i))) {
        break;
      }
    }
  }
  
  if (tableauContent.length > 0) {
    console.log(tableauContent.slice(0, 50).join('\n'));
  }
}

extractArticle91().catch(console.error);