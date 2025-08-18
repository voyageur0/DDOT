/**
 * ANALYSE SIMPLE AVEC IMAGE : Donner les documents + image tableau à l'IA
 */

import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
const pdfParse = require('pdf-parse');
import OpenAI from 'openai';
import { extractTableauSynoptiqueAsImage, encodeImageBase64 } from './pdfImageExtractor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-dummy',
});

export async function analyzeSimpleWithImage(egrid: string, municipality: string, parcelNumber?: string): Promise<string> {
  console.log('📄 ANALYSE SIMPLE AVEC IMAGE - On donne tout à l\'IA');
  
  let rdppfText = '';
  let reglementText = '';
  let tableauImageBase64 = '';
  
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
    // Nettoyer le nom de la commune
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
    
    // 3. EXTRAIRE LE TABLEAU SYNOPTIQUE COMME IMAGE
    console.log('📸 Extraction du tableau synoptique comme image...');
    const tableauImagePath = await extractTableauSynoptiqueAsImage(cleanMunicipality);
    
    if (tableauImagePath) {
      tableauImageBase64 = await encodeImageBase64(tableauImagePath);
      console.log(`✅ Tableau synoptique extrait comme image (${tableauImageBase64.length} caractères base64)`);
      
      // Nettoyer le fichier temporaire
      try {
        await fs.unlink(tableauImagePath);
      } catch (e) {}
    }
    
  } catch (error) {
    console.error('❌ Erreur règlement:', error.message);
  }
  
  // 4. DONNER TOUT A L'IA (avec image)
  const maxCharsRdppf = 8000;
  const maxCharsReglement = 8000; // Réduit car on a l'image du tableau
  
  // Construction du message selon qu'on a l'image ou pas
  const messages: any[] = [];
  
  // Ne PAS donner l'adresse, juste le numéro de parcelle
  const parcelInfo = parcelNumber ? `Parcelle n°${parcelNumber}` : `EGRID ${egrid}`;
  
  if (tableauImageBase64) {
    // Avec image du tableau
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Tu es un expert urbaniste suisse. Analyse ces documents pour ${parcelInfo}.
EXTRAIS TOUTES les contraintes avec les VALEURS EXACTES.

=== DOCUMENT 1: RDPPF (${rdppfText.length} caractères) ===
${rdppfText.substring(0, maxCharsRdppf)}

=== DOCUMENT 2: REGLEMENT COMMUNAL (${reglementText.length} caractères) ===
${reglementText.substring(0, maxCharsReglement)}

=== DOCUMENT 3: TABLEAU SYNOPTIQUE (image ci-dessous) ===
Ce tableau contient les valeurs exactes pour chaque zone (hauteurs, distances, IBUS, etc.)

MISSION:
1. TROUVE la zone exacte dans le RDPPF
2. LIS le tableau synoptique pour cette zone (colonnes: hauteur, distance, IBUS, etc.)
3. EXTRAIS TOUTES les valeurs du tableau pour cette zone
4. CITE les articles et valeurs exactes
5. PAS de généralités, UNIQUEMENT les valeurs des documents

Analyse complète:`
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${tableauImageBase64}`,
            detail: 'high'
          }
        }
      ]
    });
  } else {
    // Sans image (fallback)
    messages.push({
      role: 'user',
      content: `Tu es un expert urbaniste suisse. Analyse ces documents pour ${parcelInfo}.
EXTRAIS TOUTES les contraintes avec les VALEURS EXACTES.

=== DOCUMENT 1: RDPPF (${rdppfText.length} caractères) ===
${rdppfText.substring(0, maxCharsRdppf)}

=== DOCUMENT 2: REGLEMENT COMMUNAL (${reglementText.length} caractères) ===
${reglementText.substring(0, maxCharsReglement)}

MISSION:
1. TROUVE la zone exacte dans le RDPPF
2. TROUVE toutes les contraintes pour cette zone dans le règlement
3. LISTE TOUTES les valeurs: IBUS, hauteur, distances, parking, espaces verts, etc.
4. CITE les articles
5. PAS de généralités, UNIQUEMENT ce qui est DANS les documents

Analyse (500 mots max):`
    });
  }
  
  // Utiliser un modèle qui supporte les images
  const model = tableauImageBase64 ? 'gpt-4o' : 'o3'; // gpt-4o supporte les images, o3 non
  
  console.log(`🧠 Analyse avec modèle ${model}${tableauImageBase64 ? ' (avec image)' : ''}...`);
  
  const response = await openai.chat.completions.create({
    model,
    messages,
    max_tokens: 2000,
    temperature: 0
  });
  
  return response.choices[0].message?.content || 'Erreur analyse';
}