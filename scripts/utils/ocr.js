/**
 * Wrapper Tesseract pour l'OCR des PDFs
 * Utilise node-tesseract-ocr pour extraire le texte des PDFs scannés
 */

const tesseract = require('node-tesseract-ocr');
const pdf2img = require('pdf-img-convert');
const fs = require('fs').promises;
const path = require('path');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

/**
 * Configuration par défaut pour Tesseract
 */
const defaultConfig = {
  lang: 'fra+deu', // Français + Allemand pour le Valais
  oem: 1,          // LSTM neural nets mode
  psm: 3,          // Fully automatic page segmentation
};

/**
 * Effectue l'OCR sur un fichier PDF
 * @param {string} pdfPath - Chemin vers le fichier PDF
 * @param {number} pageNum - Numéro de page (optionnel, par défaut toutes les pages)
 * @param {object} config - Configuration Tesseract (optionnel)
 * @returns {Promise<string|string[]>} Texte extrait (string si une page, array si plusieurs)
 */
async function performOCR(pdfPath, pageNum = null, config = {}) {
  try {
    logger.info({ pdfPath, pageNum }, 'Début OCR');
    
    // Vérifier que le fichier existe
    await fs.access(pdfPath);
    
    // Configuration finale
    const tesseractConfig = { ...defaultConfig, ...config };
    
    // Convertir PDF en images
    const options = {
      width: 2480,  // A4 à 300 DPI
      height: 3508, // A4 à 300 DPI
      density: 300,
      savePath: null // Retourner en mémoire
    };
    
    if (pageNum !== null) {
      options.page_numbers = [pageNum];
    }
    
    logger.debug({ options }, 'Options de conversion PDF');
    const images = await pdf2img.convert(pdfPath, options);
    
    // OCR sur chaque image
    const results = [];
    for (let i = 0; i < images.length; i++) {
      const pageNumber = pageNum !== null ? pageNum : i + 1;
      logger.debug({ pageNumber }, 'OCR sur la page');
      
      try {
        // Convertir l'image buffer en base64 pour Tesseract
        const imageBase64 = Buffer.from(images[i]).toString('base64');
        const text = await tesseract.recognize(
          `data:image/png;base64,${imageBase64}`,
          tesseractConfig
        );
        
        results.push({
          page: pageNumber,
          text: text.trim()
        });
        
        logger.debug({ pageNumber, textLength: text.length }, 'Page extraite');
      } catch (ocrError) {
        logger.error({ pageNumber, error: ocrError.message }, 'Erreur OCR sur la page');
        results.push({
          page: pageNumber,
          text: '',
          error: ocrError.message
        });
      }
    }
    
    logger.info({ pdfPath, pagesProcessed: results.length }, 'OCR terminé');
    
    // Retourner string si une seule page, sinon array
    if (pageNum !== null && results.length === 1) {
      return results[0].text;
    }
    
    return results;
  } catch (error) {
    logger.error({ pdfPath, error: error.message }, 'Erreur OCR globale');
    throw error;
  }
}

/**
 * Vérifie si un PDF nécessite l'OCR
 * @param {string} pdfPath - Chemin vers le fichier PDF
 * @returns {Promise<boolean>} true si le PDF nécessite l'OCR
 */
async function needsOCR(pdfPath) {
  try {
    // Essayer d'extraire le texte avec pdf-parse d'abord
    const pdfParse = require('pdf-parse');
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdfParse(dataBuffer);
    
    // Si très peu de texte extrait, probablement un scan
    const textLength = data.text.trim().length;
    const needsOcr = textLength < 100; // Seuil arbitraire
    
    logger.debug({ pdfPath, textLength, needsOcr }, 'Vérification besoin OCR');
    return needsOcr;
  } catch (error) {
    logger.warn({ pdfPath, error: error.message }, 'Erreur vérification OCR, assumant besoin OCR');
    return true;
  }
}

/**
 * Nettoie le texte OCR
 * @param {string} text - Texte brut OCR
 * @returns {string} Texte nettoyé
 */
function cleanOCRText(text) {
  return text
    // Remplacer les ligatures courantes
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    // Normaliser les espaces
    .replace(/\s+/g, ' ')
    // Supprimer les caractères de contrôle
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    // Corriger les erreurs OCR courantes
    .replace(/\bl\s*'/g, "l'")
    .replace(/\bd\s*'/g, "d'")
    .replace(/\bI\b/g, '1') // I majuscule souvent confondu avec 1
    .replace(/\bO\b/g, '0') // O majuscule souvent confondu avec 0 dans les nombres
    .trim();
}

module.exports = {
  performOCR,
  needsOCR,
  cleanOCRText
};