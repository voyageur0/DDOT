import fs from 'node:fs/promises';
import path from 'node:path';
import { createWorker } from 'tesseract.js';

export interface PDFOCRResult {
  text: string;
  confidence: number;
  pageCount: number;
  processingTime: number;
  method: 'native' | 'ocr' | 'hybrid';
}

/**
 * Extrait le texte d'un PDF en utilisant OCR sur les images des pages
 * @param pdfPath Chemin vers le fichier PDF
 * @param forceOCR Force l'utilisation de l'OCR même si le texte natif semble correct
 */
export async function extractTextFromPDFWithOCR(pdfPath: string, forceOCR: boolean = false): Promise<PDFOCRResult> {
  const startTime = Date.now();
  console.log(`🔍 Extraction OCR PDF: ${path.basename(pdfPath)}${forceOCR ? ' (OCR forcé)' : ''}`);
  
  try {
    // 1. Tentative d'extraction native rapide d'abord
    const nativeText = await tryNativeExtraction(pdfPath);
    if (!forceOCR && nativeText && nativeText.length > 200 && hasGoodQuality(nativeText)) {
      console.log(`✅ Extraction native suffisante: ${nativeText.length} caractères`);
      return {
        text: nativeText,
        confidence: 95,
        pageCount: 1,
        processingTime: Date.now() - startTime,
        method: 'native'
      };
    } else if (forceOCR) {
      console.log(`🔍 OCR forcé demandé, lancement OCR même avec texte natif de ${nativeText?.length || 0} caractères`);
    }
    
    // 2. Conversion PDF vers images et OCR
    console.log(`🔍 Conversion PDF vers images pour OCR...`);
    const images = await convertPDFToImages(pdfPath);
    
    if (images.length === 0) {
      console.log(`⚠️ Aucune image générée, utilisation du texte natif`);
      return {
        text: nativeText || 'Impossible d\'extraire le texte',
        confidence: 0,
        pageCount: 0,
        processingTime: Date.now() - startTime,
        method: 'native'
      };
    }
    
    // 3. OCR sur chaque image
    console.log(`🔍 OCR sur ${images.length} pages...`);
    const ocrResults = await performOCROnImages(images);
    
    // 4. Nettoyer les images temporaires
    await cleanupTempImages(images);
    
    // 5. Combiner les résultats
    const combinedText = ocrResults.map(r => r.text).join('\n\n');
    const avgConfidence = ocrResults.reduce((sum, r) => sum + r.confidence, 0) / ocrResults.length;
    
    console.log(`✅ OCR terminé: ${combinedText.length} caractères, confiance: ${avgConfidence.toFixed(1)}%`);
    
    // 6. Décider si on utilise OCR ou natif
    const finalText = shouldUseOCR(nativeText, combinedText, avgConfidence) ? combinedText : nativeText;
    const finalMethod = finalText === combinedText ? 'ocr' : 'native';
    
    return {
      text: finalText,
      confidence: avgConfidence,
      pageCount: images.length,
      processingTime: Date.now() - startTime,
      method: finalMethod
    };
    
  } catch (error) {
    console.error('❌ Erreur extraction OCR PDF:', error);
    
    // Fallback vers extraction basique
    const fallbackText = await tryNativeExtraction(pdfPath);
    return {
      text: fallbackText || 'Erreur lors de l\'extraction',
      confidence: 0,
      pageCount: 0,
      processingTime: Date.now() - startTime,
      method: 'native'
    };
  }
}

/**
 * Tentative d'extraction native du PDF
 */
async function tryNativeExtraction(pdfPath: string): Promise<string> {
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.log(`⚠️ Extraction native échouée: ${error instanceof Error ? error.message : error}`);
    return '';
  }
}

/**
 * Convertit un PDF en images (une par page)
 */
async function convertPDFToImages(pdfPath: string): Promise<string[]> {
  try {
    const pdf2pic = require('pdf2pic');
    const tempDir = path.join(process.cwd(), 'temp-ocr');
    
    // Créer le dossier temporaire
    await fs.mkdir(tempDir, { recursive: true });
    
    // Configuration de conversion
    const convert = pdf2pic.fromPath(pdfPath, {
      density: 200,           // DPI - qualité d'image
      saveFilename: "page",   // Nom de base
      savePath: tempDir,      // Dossier de sortie
      format: "png",          // Format de sortie
      width: 2000,            // Largeur max
      height: 2000            // Hauteur max
    });
    
    // Convertir toutes les pages (limite à 10 pages max)
    const results = await convert.bulk(-1, { responseType: "buffer" });
    
    // Sauvegarder les images et retourner les chemins
    const imagePaths: string[] = [];
    for (let i = 0; i < Math.min(results.length, 10); i++) {
      const result = results[i];
      if (result.buffer) {
        const imagePath = path.join(tempDir, `page_${i + 1}.png`);
        await fs.writeFile(imagePath, result.buffer);
        imagePaths.push(imagePath);
      }
    }
    
    console.log(`📄 ${imagePaths.length} images générées`);
    return imagePaths;
    
  } catch (error) {
    console.error('❌ Erreur conversion PDF vers images:', error);
    
    // Fallback: essayer avec une alternative simple
    try {
      return await convertPDFToImagesSimple(pdfPath);
    } catch (fallbackError) {
      console.error('❌ Fallback conversion échouée:', fallbackError);
      return [];
    }
  }
}

/**
 * Méthode de conversion simple en fallback
 */
async function convertPDFToImagesSimple(pdfPath: string): Promise<string[]> {
  // Pour l'instant, on retourne un tableau vide
  // On pourrait implémenter une conversion avec pdf.js + canvas ici
  console.log('⚠️ Conversion simple non implémentée');
  return [];
}

/**
 * Effectue l'OCR sur une liste d'images
 */
async function performOCROnImages(imagePaths: string[]): Promise<{text: string, confidence: number}[]> {
  const results: {text: string, confidence: number}[] = [];
  
  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    console.log(`🔍 OCR page ${i + 1}/${imagePaths.length}...`);
    
    try {
      const worker = await createWorker('fra');
      const { data } = await worker.recognize(imagePath);
      await worker.terminate();
      
      results.push({
        text: cleanOCRText(data.text),
        confidence: data.confidence
      });
      
    } catch (error) {
      console.error(`❌ Erreur OCR page ${i + 1}:`, error instanceof Error ? error.message : error);
      results.push({
        text: '',
        confidence: 0
      });
    }
  }
  
  return results;
}

/**
 * Nettoie les images temporaires
 */
async function cleanupTempImages(imagePaths: string[]): Promise<void> {
  try {
    for (const imagePath of imagePaths) {
      await fs.unlink(imagePath);
    }
    
    // Supprimer le dossier temporaire s'il est vide
    const tempDir = path.dirname(imagePaths[0]);
    const files = await fs.readdir(tempDir);
    if (files.length === 0) {
      await fs.rmdir(tempDir);
    }
  } catch (error) {
    console.log('⚠️ Erreur nettoyage images:', error instanceof Error ? error.message : error);
  }
}

/**
 * Vérifie la qualité d'un texte extrait
 */
function hasGoodQuality(text: string): boolean {
  if (!text || text.length < 100) return false;
  
  // Calculer le ratio de caractères alphanumériques
  const alphanumeric = text.match(/[a-zA-ZÀ-ÿ0-9\s]/g)?.length || 0;
  const ratio = alphanumeric / text.length;
  
  return ratio > 0.8; // Plus de 80% de caractères normaux
}

/**
 * Décide si on doit utiliser le résultat OCR ou le texte natif
 */
function shouldUseOCR(nativeText: string, ocrText: string, ocrConfidence: number): boolean {
  if (!nativeText || nativeText.length < 100) return true;
  if (!ocrText || ocrText.length < 100) return false;
  if (ocrConfidence < 70) return false;
  
  // Si l'OCR est significativement plus long et a une bonne confiance
  return (ocrText.length > nativeText.length * 1.2) && (ocrConfidence > 80);
}

/**
 * Nettoie le texte extrait par OCR
 */
function cleanOCRText(text: string): string {
  return text
    .replace(/\f/g, '\n')                    // Form feeds vers nouvelles lignes
    .replace(/\r\n/g, '\n')                  // Normaliser les fins de ligne
    .replace(/\s{3,}/g, '  ')                // Réduire les espaces multiples
    .replace(/\n{3,}/g, '\n\n')              // Réduire les sauts de ligne multiples
    .replace(/[^\w\s\.\,\;\:\!\?\-\(\)\[\]\{\}\"\'\/\\\n\r]/g, ' ') // Supprimer caractères bizarres
    .trim();
} 