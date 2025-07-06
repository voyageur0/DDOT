const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const { Document } = require('../models-node');
const { generateEmbeddings } = require('./openaiService');
const { indexDocument } = require('./vectorService');

/**
 * Extraire le contenu d'un PDF
 */
async function extractPdfContent(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    
    return {
      text: data.text,
      pages: data.numpages,
      metadata: data.metadata
    };
  } catch (error) {
    console.error('Erreur extraction PDF:', error);
    throw error;
  }
}

/**
 * OCR pour les PDFs scannés
 */
async function performOCR(filePath) {
  const worker = await createWorker('fra');
  
  try {
    const { data: { text } } = await worker.recognize(filePath);
    return text;
  } catch (error) {
    console.error('Erreur OCR:', error);
    throw error;
  } finally {
    await worker.terminate();
  }
}

/**
 * Extraire les données structurées d'urbanisme
 */
function extractUrbanData(text) {
  const data = {
    zones: [],
    rules: {},
    coefficients: {}
  };
  
  // Patterns regex pour extraire les valeurs
  const patterns = {
    ibus: /IBUS[\s:]*(\d+[.,]\d+)/gi,
    hauteur: /hauteur\s*(?:maximale|max)?\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m/gi,
    distance: /distance\s*(?:minimale|min)?\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m/gi,
    emprise: /emprise\s*au\s*sol\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*%/gi,
    cos: /COS[\s:]*(\d+[.,]\d+)/gi,
    ces: /CES[\s:]*(\d+[.,]\d+)/gi
  };
  
  // Recherche des valeurs
  for (const [key, pattern] of Object.entries(patterns)) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      // Convertir en float
      const values = matches.map(m => parseFloat(m[1].replace(',', '.')));
      data.coefficients[key] = values.length === 1 ? values[0] : values;
    }
  }
  
  // Extraction des zones
  const zonePattern = /zone\s+([A-Z0-9]+)/gi;
  const zones = [...text.matchAll(zonePattern)];
  data.zones = [...new Set(zones.map(m => m[1]))];
  
  // Extraction des règles par zone
  for (const zone of data.zones) {
    const zoneSection = extractZoneSection(text, zone);
    if (zoneSection) {
      data.rules[zone] = extractZoneRules(zoneSection);
    }
  }
  
  return data;
}

/**
 * Extraire la section de texte d'une zone
 */
function extractZoneSection(text, zone) {
  const pattern = new RegExp(`zone\\s+${zone}\\b(.*?)(?=zone\\s+[A-Z0-9]+|$)`, 'gis');
  const match = pattern.exec(text);
  return match ? match[1] : null;
}

/**
 * Extraire les règles spécifiques d'une zone
 */
function extractZoneRules(zoneText) {
  const rules = {};
  
  const patterns = {
    hauteur_max: /hauteur\s*(?:maximale|max)?\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m/i,
    hauteur_facade: /hauteur\s*(?:de\s*)?facade\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m/i,
    distance_limite: /distance\s*(?:aux?\s*)?limite[s]?\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m/i,
    ibus: /IBUS[\s:]*(\d+[.,]\d+)/i,
    emprise_sol: /emprise\s*au\s*sol\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*%/i
  };
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = pattern.exec(zoneText);
    if (match) {
      rules[key] = parseFloat(match[1].replace(',', '.'));
    }
  }
  
  return rules;
}

/**
 * Traiter un document complet
 */
async function extractDocument(documentId, filePath) {
  try {
    // Récupérer le document de la base
    const document = await Document.findByPk(documentId);
    if (!document) {
      throw new Error('Document non trouvé');
    }
    
    let text = '';
    let metadata = {};
    
    // Extraction du PDF
    try {
      const pdfResult = await extractPdfContent(filePath);
      text = pdfResult.text;
      metadata = pdfResult.metadata;
    } catch (error) {
      console.log('PDF non lisible, tentative OCR...');
      // Si le PDF n'est pas lisible, essayer l'OCR
      text = await performOCR(filePath);
    }
    
    // Si le texte est vide ou trop court
    if (!text || text.length < 100) {
      console.log('Texte insuffisant, utilisation de l\'OCR...');
      text = await performOCR(filePath);
    }
    
    // Extraction des données structurées
    const structuredData = extractUrbanData(text);
    
    // Mise à jour du document
    await document.update({
      rawText: text,
      extractedData: structuredData
    });
    
    // Générer les chunks pour l'indexation
    const chunks = splitTextIntoChunks(text);
    
    // Indexer le document pour la recherche vectorielle
    await indexDocument(documentId, chunks);
    
    console.log(`Document ${documentId} extrait et indexé avec succès`);
    
    return {
      success: true,
      data: structuredData
    };
    
  } catch (error) {
    console.error(`Erreur extraction document ${documentId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Diviser le texte en chunks
 */
function splitTextIntoChunks(text, maxLength = 2000, overlap = 200) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;
  
  for (const sentence of sentences) {
    const sentenceLength = sentence.length;
    
    if (currentLength + sentenceLength > maxLength && currentChunk.length > 0) {
      // Créer le chunk
      chunks.push(currentChunk.join(' '));
      
      // Garder les dernières phrases pour le chevauchement
      const overlapSentences = [];
      let overlapLength = 0;
      
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const s = currentChunk[i];
        if (overlapLength + s.length <= overlap) {
          overlapSentences.unshift(s);
          overlapLength += s.length;
        } else {
          break;
        }
      }
      
      currentChunk = overlapSentences;
      currentLength = overlapLength;
    }
    
    currentChunk.push(sentence);
    currentLength += sentenceLength;
  }
  
  // Ajouter le dernier chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  return chunks;
}

module.exports = {
  extractDocument,
  extractPdfContent,
  extractUrbanData,
  splitTextIntoChunks
}; 