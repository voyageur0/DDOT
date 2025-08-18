/**
 * ANALYSE SIMPLE : Donner les 2 documents à l'IA et c'est tout
 */

import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
const pdfParse = require('pdf-parse');
import { callOpenAI } from '../utils/openai';

export async function analyzeSimple(egrid: string, municipality: string, parcelNumber?: string): Promise<string> {
  console.log('📄 ANALYSE SIMPLE - On donne tout à l\'IA');
  
  let rdppfText = '';
  let reglementText = '';
  
  // 1. TELECHARGER ET LIRE LE RDPPF
  if (egrid) {
    try {
      console.log(`📥 Téléchargement RDPPF pour ${egrid}...`);
      const rdppfUrl = `https://rdppfvs.geopol.ch/extract/pdf?EGRID=${egrid}&LANG=fr`;
      const response = await axios.get(rdppfUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000
      });
      const pdfData = await pdfParse(Buffer.from(response.data));
      rdppfText = pdfData.text;
      console.log(`✅ RDPPF lu: ${rdppfText.length} caractères`);
    } catch (error) {
      console.error('❌ Erreur RDPPF:', error.message);
    }
  }
  
  // 2. LIRE LE REGLEMENT COMMUNAL
  try {
    // Nettoyer le nom de la commune (enlever code postal si présent)
    const cleanMunicipality = municipality.replace(/^\d{4}\s+/, '');
    
    console.log(`📖 Lecture règlement ${cleanMunicipality}...`);
    const regulationPath = path.join(
      process.cwd(),
      'reglements',
      `VS_${cleanMunicipality}_Règlement des constructions.pdf`
    );
    
    const pdfBuffer = await fs.readFile(regulationPath);
    const pdfData = await pdfParse(pdfBuffer);
    reglementText = pdfData.text;
    console.log(`✅ Règlement lu: ${reglementText.length} caractères`);
  } catch (error) {
    console.error('❌ Erreur règlement:', error.message);
  }
  
  // 3. DONNER TOUT A L'IA (avec limite pour o3: 30k tokens max)
  // o3 limite: ~30k tokens = ~22k caractères de texte
  const maxCharsRdppf = 8000;  // Réduit pour o3
  const maxCharsReglement = 10000; // Réduit pour o3
  
  // Identifier la parcelle SANS donner l'adresse complète
  const parcelIdentification = parcelNumber 
    ? `Parcelle n°${parcelNumber}` 
    : `Parcelle EGRID ${egrid}`;
  
  // Essayer d'extraire le tableau synoptique spécifiquement
  let tableauSynoptique = '';
  if (reglementText.includes('Art 111') || reglementText.includes('Tableau synoptique')) {
    const startIdx = reglementText.indexOf('Art 111');
    if (startIdx > 0) {
      // Prendre 5000 caractères après Art 111 pour capturer tout le tableau
      tableauSynoptique = reglementText.substring(startIdx, startIdx + 5000);
      console.log('📊 Tableau synoptique trouvé et extrait');
    }
  }
  
  const prompt = `Tu es un expert urbaniste suisse. Voici les documents pour ${parcelIdentification}. 
ANALYSE-LES et donne TOUTES les contraintes avec les VALEURS EXACTES.

=== DOCUMENT 1: RDPPF (extrait de ${rdppfText.length} caractères) ===
${rdppfText.substring(0, maxCharsRdppf)}

=== DOCUMENT 2: REGLEMENT COMMUNAL (extrait de ${reglementText.length} caractères) ===
${reglementText.substring(0, maxCharsReglement)}

${tableauSynoptique ? `=== DOCUMENT 3: TABLEAU SYNOPTIQUE (Art. 111) ===
${tableauSynoptique}` : ''}

MISSION CRITIQUE:
1. IDENTIFIER la zone exacte dans le RDPPF (ex: Zone résidentielle 0.5)
2. CHERCHER dans le règlement/tableau TOUTES les valeurs pour cette zone:
   - IBUS (indice de bâtisse d'utilisation du sol)
   - Hauteur maximale (en mètres)
   - Nombre d'étages maximum
   - Distance minimale aux limites (en mètres)
   - Taux d'occupation du sol (en %)
   - Places de stationnement (nombre par logement ou m²)
   - Espaces verts obligatoires (en %)
   - Aires de jeux (en m² ou %)
3. CITER les articles exacts
4. Si une valeur n'est PAS dans les documents, dire "Non spécifié dans les extraits"
5. NE JAMAIS inventer ou supposer des valeurs

Analyse exhaustive:`;

  const response = await callOpenAI({
    model: 'o3',  // Utilise o1-preview pour le raisonnement avancé
    temperature: 0,
    messages: [
      { role: 'system', content: 'Expert urbaniste. LIS les documents et extrais les contraintes REELLES.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2000
  });
  
  return response.choices[0].message?.content || 'Erreur analyse';
}