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

const SYSTEM_PROMPT = `Vous êtes un expert en droit de la construction suisse analysant des documents d'urbanisme (RDPPF et règlements communaux).

OBJECTIF: Extraire TOUTES les informations pertinentes pour ces 10 THÈMES PRINCIPAUX. Ne vous limitez PAS à des contraintes figées, mais cherchez TOUT ce qui concerne chaque thème.

LES 10 THÈMES À RECHERCHER:

1. **Zone** - Type de zone d'affectation (résidentielle, mixte, artisanale, etc.)
   - Exemples: "Zone résidentielle 0.5 (3)", "Zone mixte A", "Zone centre-ville"
   - Inclure la désignation COMPLÈTE avec indices et numéros

2. **But de la zone** - Objectif et caractéristiques de la zone
   - Usage principal autorisé
   - Activités permises/interdites
   - Caractère de la zone (résidentiel, commercial, etc.)

3. **Surface de la parcelle** - Toutes les surfaces mentionnées
   - Surface totale de la parcelle
   - Surface constructible
   - Surface minimale requise

4. **Indice U** - Indice d'utilisation du sol (parties chauffées uniquement)
   - Valeur de l'indice U
   - Calcul et application
   - Bonus éventuels

5. **Indice IBUS** - Indice brut d'utilisation du sol (toutes surfaces)
   - Valeur IBUS ou conversion depuis l'indice U
   - Inclut parkings, caves, etc.
   - Tableau de conversion Valais si mentionné

6. **Hauteur maximale** - Toutes les hauteurs selon le type de toiture
   - Hauteur max si toiture en pente
   - Hauteur max si toiture plate
   - Hauteur à la corniche
   - Nombre d'étages autorisés

7. **Distances à la limite** - Tous les reculs et distances
   - Distance minimale aux limites
   - Calcul selon hauteur du bâtiment (ex: H/2)
   - Distances entre bâtiments
   - Alignements obligatoires

8. **Alignements** - Obligations d'alignement
   - Alignement sur rue
   - Alignement sur parcelles voisines
   - Maintien d'alignements existants
   - Plans d'alignement

9. **Places de jeux** - Espaces extérieurs obligatoires
   - Places de jeux pour enfants (immeubles)
   - Espaces verts minimaux
   - Aménagements extérieurs requis
   - Pourcentage de surface libre

10. **Places de parc** - Stationnement obligatoire
    - Nombre de places par logement
    - Places visiteurs requises
    - Dimensions minimales
    - Places pour vélos

INSTRUCTIONS:
- Extraire TOUT ce qui concerne ces 10 thèmes, même si formulé différemment
- Le champ "theme" doit être l'un des 10 thèmes ci-dessus
- Le champ "rule" contient l'information COMPLÈTE extraite du document
- Respecter le texte EXACT du document source
- Si une information concerne plusieurs thèmes, créer plusieurs entrées

FORMAT: [{"theme":"<un des 10 thèmes>","rule":"<texte exact extrait>"}]`;

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
        line.includes('Zones communales d\'affectation') ||
        line.includes('GEOMETRIE TOUCHEE') ||
        line.includes('Type de restriction de droit public')) {
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
        line.includes('Zone centre') ||
        line.includes('Aire forestière') ||
        line.includes('Zone agricole') ||
        line.match(/Zone\s+[a-zA-ZÀ-ÿ\s]+\d+[.,]\d+/)) { // Pattern pour "Zone xxx 0.5"
      inRelevantSection = true;
      zoneSection = true;
    }
    
    // Capturer les lignes avec des surfaces et pourcentages
    if (line.match(/\d+\s*m[²2]/) || line.match(/\d+[.,]\d+\s*%/)) {
      inRelevantSection = true;
    }
    
    // Capturer les lignes avec des indices entre parenthèses (ex: "(3)")
    if (line.match(/\(\d+\)/) && zoneSection) {
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