import fs from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
const pdfParse = require('pdf-parse');
import { callOpenAI } from '../utils/openai';

export interface RdppfConstraint {
  theme: string; // Un des 8 thèmes obligatoires
  rule: string;  // Description textuelle de la contrainte
}

// Cache temporaire pour éviter les conflits avec les clics utilisateur
interface CacheEntry {
  data: Buffer;
  timestamp: number;
  egrid: string;
}

const rdppfCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Nettoie le cache des entrées expirées
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of rdppfCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      rdppfCache.delete(key);
    }
  }
}

/**
 * Télécharge le fichier PDF RDPPF avec gestion de cache et de conflits.
 * Implémente un délai intelligent si le PDF a été récemment accédé par l'utilisateur.
 */
export async function downloadRdppf(pdfUrl: string): Promise<string> {
  console.log(`🔗 Début téléchargement: ${pdfUrl}`);
  
  // Extraire l'EGRID de l'URL pour le cache
  const egridMatch = pdfUrl.match(/EGRID=([A-Z0-9]+)/);
  const egrid = egridMatch ? egridMatch[1] : '';
  
  // Nettoyer le cache expiré
  cleanExpiredCache();
  
  // Vérifier si le PDF est déjà en cache
  const cacheKey = egrid || pdfUrl;
  const cachedEntry = rdppfCache.get(cacheKey);
  
  if (cachedEntry) {
    const ageMinutes = (Date.now() - cachedEntry.timestamp) / (1000 * 60);
    console.log(`💾 PDF trouvé en cache (âge: ${ageMinutes.toFixed(1)} min)`);
    
    // Utiliser le cache directement
    const tmpDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `rdppf-cached-${Date.now()}.pdf`);
    await fs.writeFile(filePath, cachedEntry.data);
    console.log(`✅ PDF restauré depuis le cache: ${filePath}`);
    return filePath;
  }
  
  try {
    // Premier essai de téléchargement
    const buffer = await downloadWithRetry(pdfUrl);
    
    // Sauvegarder en cache pour éviter les futurs conflits
    rdppfCache.set(cacheKey, {
      data: buffer,
      timestamp: Date.now(),
      egrid
    });
    
    const tmpDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `rdppf-${Date.now()}.pdf`);
    await fs.writeFile(filePath, buffer);
    console.log(`💾 PDF sauvegardé: ${filePath}`);
    return filePath;
    
  } catch (error: any) {
    // Si erreur 500, probablement un conflit avec le navigateur
    if (error.response?.status === 500) {
      console.log(`⚠️ Erreur 500 détectée - possible conflit utilisateur. Tentative avec délai...`);
      
      // Attendre quelques secondes pour laisser le serveur se libérer
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        const buffer = await downloadWithRetry(pdfUrl, 2); // Retry réduit
        
        // Sauvegarder en cache
        rdppfCache.set(cacheKey, {
          data: buffer,
          timestamp: Date.now(),
          egrid
        });
        
        const tmpDir = path.join(process.cwd(), 'uploads');
        await fs.mkdir(tmpDir, { recursive: true });
        const filePath = path.join(tmpDir, `rdppf-delayed-${Date.now()}.pdf`);
        await fs.writeFile(filePath, buffer);
        console.log(`✅ PDF téléchargé après délai: ${filePath}`);
        return filePath;
        
      } catch (retryError) {
        console.log(`❌ Échec même après délai. RDPPF temporairement indisponible.`);
        throw retryError;
      }
    }
    
    throw error;
  }
}

/**
 * Télécharge le PDF avec retry automatique
 */
async function downloadWithRetry(pdfUrl: string, maxRetries = 3): Promise<Buffer> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(pdfUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000,
        // Headers pour éviter les blocages
        headers: {
          'User-Agent': 'DDOT-Urban-Analysis/1.0 (Automated PDF Analysis)',
          'Accept': 'application/pdf,*/*'
        }
      });
      
      console.log(`✅ PDF téléchargé (essai ${attempt}), taille: ${response.data.byteLength} bytes`);
      return Buffer.from(response.data);
      
    } catch (error: any) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = attempt * 2000; // Délai croissant: 2s, 4s, 6s
        console.log(`⚠️ Erreur essai ${attempt} (${error.response?.status || error.code}). Retry dans ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
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

IMPORTANT: 
1. Le champ "rule" doit être une DESCRIPTION TEXTUELLE complète, pas un objet structuré.
2. Pour la "Destination de zone", extraire EXACTEMENT la dénomination complète de la zone telle qu'elle apparaît dans le document.
   - La zone principale doit être extraite en premier (ex: "Zone résidentielle 0.5 (3)")
   - Ajouter ensuite la surface et le pourcentage si disponibles
   - Format attendu: "Zone résidentielle 0.5 (3), Surface: 862 m², 100.0%"
3. NE PAS inclure les zones de dangers (avalanches, inondations, etc.) SAUF si elles sont explicitement mentionnées dans le RDPPF.
4. Extraire la surface de la parcelle si disponible.
5. TOUJOURS extraire le degré de sensibilité au bruit s'il est présent (ex: "Degré de sensibilité II").
6. Si plusieurs zones sont présentes, créer une contrainte séparée pour chaque zone avec son pourcentage respectif.

Format: [{"theme":"<thème>","rule":"<description textuelle complète>"}, …]

Exemple:
- Correct: {"theme":"Destination de zone","rule":"Zone résidentielle 0.5 (3), Surface: 862 m², 100.0%"}
- Correct: {"theme":"Prescriptions architecturales","rule":"Degré de sensibilité au bruit: II, Surface: 2257 m², 100.0%"}
- Incorrect: {"theme":"Destination de zone","rule":{"type":"Zone résidentielle","indice":"0.5"}}`;

/**
 * Extrait les sections pertinentes du texte RDPPF
 */
function extractRelevantSectionsFromText(fullText: string): string {
  const lines = fullText.split('\n');
  const relevantLines: string[] = [];
  let inRelevantSection = false;
  let captureAll = false;
  let zoneSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';
    
    // Détecter les sections importantes
    if (line.includes('Plans d\'affectation') || 
        line.includes('Affectation primaire') ||
        line.includes('Légende des objets touchés') ||
        line.includes('Zones communales d\'affectation')) {
      inRelevantSection = true;
      captureAll = true;
      zoneSection = true;
    }
    
    // Détecter spécifiquement les zones
    if (line.includes('Degré de sensibilité') ||
        line.includes('Zone résidentielle') ||
        line.includes('Zone à bâtir') ||
        line.includes('Zone d\'habitation') ||
        line.includes('Zone mixte') ||
        line.includes('Zone centre')) {
      inRelevantSection = true;
      zoneSection = true;
    }
    
    // Capturer les lignes avec des surfaces et pourcentages
    if (line.match(/\d+\s*m[²2]/) || line.match(/\d+\.\d+\s*%/)) {
      inRelevantSection = true;
    }
    
    // Collecter les lignes pertinentes
    if (inRelevantSection && line.trim().length > 0) {
      relevantLines.push(line);
      
      // Si on est dans une section de zone, capturer aussi la ligne suivante
      // car souvent la surface est sur la ligne suivante
      if (zoneSection && nextLine.trim().length > 0) {
        relevantLines.push(nextLine);
        i++; // Skip la ligne suivante dans la boucle
      }
    }
    
    // Arrêter après les dispositions juridiques si on a assez de contenu
    if (line.includes('Dispositions juridiques') && captureAll) {
      relevantLines.push(line);
      // Capturer encore quelques lignes pour les références
      for (let j = 0; j < 10 && lines[i + j + 1]; j++) {
        relevantLines.push(lines[i + j + 1]);
      }
      break;
    }
    
    // Reset si on change de section
    if (line.includes('Page') && !captureAll) {
      inRelevantSection = false;
      zoneSection = false;
    }
  }
  
  return relevantLines.join('\n');
}

/**
 * Analyse le texte du RDPPF et renvoie un tableau de contraintes structurées.
 * Avec GPT-4.1, analyse du document RDPPF complet sans limitation.
 */
export async function extractRdppfConstraints(rawText: string): Promise<RdppfConstraint[]> {
  if (!rawText || rawText.length < 50) return [];

  console.log(`🔍 Analyse RDPPF complète avec GPT-4.1: ${rawText.length} caractères`);
  
  // Extraire les sections pertinentes pour une meilleure analyse
  const relevantSections = extractRelevantSectionsFromText(rawText);

  const messages: any = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: relevantSections } // Analyse des sections pertinentes
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