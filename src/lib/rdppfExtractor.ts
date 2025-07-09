import fs from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import pdfParse from 'pdf-parse';
import { callOpenAI } from '../utils/openai';

export interface RdppfConstraint {
  theme: string; // Un des 8 thèmes obligatoires
  rule: string;  // Description textuelle de la contrainte
}

/**
 * Télécharge le fichier PDF RDPPF dans un dossier temporaire et renvoie le chemin local.
 */
export async function downloadRdppf(pdfUrl: string): Promise<string> {
  console.log(`🔗 Début téléchargement: ${pdfUrl}`);
  const response = await axios.get(pdfUrl, { 
    responseType: 'arraybuffer',
    timeout: 30000 
  });
  console.log(`✅ PDF téléchargé, taille: ${response.data.byteLength} bytes`);
  const buffer = Buffer.from(response.data);
  const tmpDir = path.join(process.cwd(), 'uploads');
  await fs.mkdir(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `rdppf-${Date.now()}.pdf`);
  await fs.writeFile(filePath, buffer);
  console.log(`💾 PDF sauvegardé: ${filePath}`);
  return filePath;
}

/**
 * Extrait le texte brut du PDF.
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  console.log(`📖 Extraction texte de: ${filePath}`);
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  console.log(`📄 Texte extrait: ${data.text.length} caractères`);
  return data.text;
}

const SYSTEM_PROMPT = `Vous êtes un juriste spécialisé en droit de la construction suisse.
À partir du texte RDPPF ci-dessous, identifiez toutes les informations pertinentes pour les 8 thèmes obligatoires et restituez-les sous forme JSON.

Thèmes: Identification, Destination de zone, Indice d'utilisation (IBUS), Gabarits & reculs, Toiture, Stationnement, Espaces de jeux / détente, Prescriptions architecturales.

IMPORTANT: Le champ "rule" doit être une DESCRIPTION TEXTUELLE complète, pas un objet structuré.

Format: [{"theme":"<thème>","rule":"<description textuelle complète>"}, …]

Exemple:
- Correct: {"theme":"Identification","rule":"Immeuble n° 12558, Commune de Vétroz, Surface 862 m², E-GRID CH773017495270"}
- Incorrect: {"theme":"Identification","rule":{"No":"12558","Commune":"Vétroz"}}`;

/**
 * Analyse le texte du RDPPF et renvoie un tableau de contraintes structurées.
 * Avec GPT-4.1, analyse du document RDPPF complet sans limitation.
 */
export async function extractRdppfConstraints(rawText: string): Promise<RdppfConstraint[]> {
  if (!rawText || rawText.length < 50) return [];

  console.log(`🔍 Analyse RDPPF complète avec GPT-4.1: ${rawText.length} caractères`);

  const messages: any = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: rawText } // Analyse du document RDPPF complet !
  ];

  try {
    const response = await callOpenAI({
      model: 'gpt-4.1',
      temperature: 0,
      messages,
      max_tokens: 2000 // Augmenter pour une analyse plus détaillée
    });

    const content = response.choices[0].message?.content ?? '[]';
    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']') + 1;
    const jsonString = content.slice(jsonStart, jsonEnd);

    return JSON.parse(jsonString) as RdppfConstraint[];
  } catch (err) {
    console.error('Erreur extraction contraintes RDPPF:', err);
    return [];
  }
}

/**
 * Pipeline complet: télécharger le PDF + extraire texte + extraire contraintes.
 */
export async function analyzeRdppf(pdfUrl: string): Promise<RdppfConstraint[]> {
  const pathLocal = await downloadRdppf(pdfUrl);
  const text = await extractTextFromPdf(pathLocal);
  return extractRdppfConstraints(text);
} 