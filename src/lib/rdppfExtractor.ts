import fs from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import pdfParse from 'pdf-parse';
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