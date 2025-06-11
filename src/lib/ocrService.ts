import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

export interface OCRResult {
  text: string;
  confidence: number;
  processingTime: number;
}

/**
 * Extrait le texte d'un buffer PDF/image avec Tesseract
 */
export async function extractTextFromBuffer(buffer: Buffer, language = 'fra'): Promise<OCRResult> {
  const startTime = Date.now();
  console.log(`🔍 Début OCR (${buffer.length} bytes, langue: ${language})`);
  
  try {
    const worker = await createWorker(language);
    
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ OCR terminé en ${processingTime}ms - Confiance: ${data.confidence.toFixed(2)}%`);
    
    return {
      text: data.text.trim(),
      confidence: data.confidence,
      processingTime
    };
  } catch (error) {
    console.error('❌ Erreur OCR:', error);
    return {
      text: '',
      confidence: 0,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Extrait le texte d'un PDF depuis une URL
 */
export async function extractTextFromPdfUrl(url: string, language = 'fra'): Promise<OCRResult> {
  try {
    console.log(`📄 Téléchargement PDF pour OCR: ${url}`);
    
    const { data } = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 45000,
      headers: {
        'Accept': 'application/pdf,image/*'
      }
    });
    
    const buffer = Buffer.from(data);
    return await extractTextFromBuffer(buffer, language);
    
  } catch (error) {
    console.error('❌ Erreur téléchargement/OCR PDF:', error);
    return {
      text: '',
      confidence: 0,
      processingTime: 0
    };
  }
}

/**
 * Vérifie si un texte nécessite un OCR (détecte si c'est du texte scanné/image)
 */
export function needsOCR(text: string): boolean {
  // Si le texte est très court ou contient beaucoup de caractères étranges
  if (text.length < 50) return true;
  
  // Calculer le ratio de caractères alphanumériques
  const alphanumeric = text.match(/[a-zA-Z0-9\s]/g)?.length || 0;
  const ratio = alphanumeric / text.length;
  
  // Si moins de 70% de caractères normaux, probablement besoin d'OCR
  return ratio < 0.7;
}

/**
 * Nettoie et formate le texte extrait par OCR
 */
export function cleanOCRText(text: string): string {
  return text
    // Supprimer les caractères bizarres
    .replace(/[^\w\s\.\,\;\:\!\?\-\(\)\[\]\{\}\"\'\/\\\n\r]/g, ' ')
    // Normaliser les espaces multiples
    .replace(/\s+/g, ' ')
    // Supprimer les lignes très courtes (probablement des erreurs OCR)
    .split('\n')
    .filter(line => line.trim().length > 3)
    .join('\n')
    // Nettoyer les espaces en début/fin
    .trim();
}

/**
 * Analyse spécialisée pour les règlements d'urbanisme
 */
export function extractUrbanismRules(text: string, zone?: string): string {
  console.log(`📖 Extraction règles d'urbanisme${zone ? ` pour zone: ${zone}` : ''}`);
  
  // Mots-clés pour identifier les sections pertinentes
  const keywords = [
    'indice d\'utilisation',
    'coefficient d\'occupation',
    'hauteur maximale',
    'distance aux limites',
    'emprise au sol',
    'surface de plancher',
    'gabarit',
    'implantation',
    'alignement',
    'stationnement',
    'espaces verts',
    'toiture',
    'façade'
  ];
  
  const lines = text.split('\n');
  const relevantSections: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    // Si la ligne contient un mot-clé d'urbanisme
    if (keywords.some(keyword => line.includes(keyword))) {
      // Prendre cette ligne + quelques lignes suivantes pour le contexte
      const section = lines.slice(i, Math.min(i + 5, lines.length))
        .join('\n')
        .trim();
      
      if (section.length > 20) {
        relevantSections.push(section);
      }
    }
    
    // Si on cherche une zone spécifique
    if (zone && line.includes(zone.toLowerCase())) {
      const section = lines.slice(Math.max(0, i - 2), Math.min(i + 10, lines.length))
        .join('\n')
        .trim();
      
      if (section.length > 50) {
        relevantSections.push(`### Zone ${zone}:\n${section}`);
      }
    }
  }
  
  if (relevantSections.length === 0) {
    return 'Aucune règle d\'urbanisme spécifique extraite du document.';
  }
  
  return relevantSections.join('\n\n---\n\n');
}

/**
 * Cache simple pour éviter de refaire l'OCR des mêmes documents
 */
const ocrCache = new Map<string, OCRResult>();

export function getCachedOCR(url: string): OCRResult | null {
  return ocrCache.get(url) || null;
}

export function setCachedOCR(url: string, result: OCRResult): void {
  // Limiter la taille du cache
  if (ocrCache.size > 50) {
    const firstKey = ocrCache.keys().next().value;
    if (firstKey) {
      ocrCache.delete(firstKey);
    }
  }
  ocrCache.set(url, result);
} 