"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeOcr = initializeOcr;
exports.cleanupOcr = cleanupOcr;
exports.extractTextFromPdf = extractTextFromPdf;
exports.extractZoneSection = extractZoneSection;
const tesseract_js_1 = require("tesseract.js");
let ocrWorker = null;
/**
 * Initialise le worker Tesseract (à appeler au démarrage)
 */
async function initializeOcr() {
    try {
        console.log('🔍 Initialisation du moteur OCR...');
        ocrWorker = await (0, tesseract_js_1.createWorker)();
        await ocrWorker.loadLanguage('fra+eng');
        await ocrWorker.initialize('fra+eng');
        console.log('✅ OCR initialisé avec succès');
    }
    catch (error) {
        console.error('❌ Erreur initialisation OCR:', error);
        ocrWorker = null;
    }
}
/**
 * Nettoie les ressources OCR
 */
async function cleanupOcr() {
    if (ocrWorker) {
        await ocrWorker.terminate();
        ocrWorker = null;
        console.log('🧹 Ressources OCR nettoyées');
    }
}
/**
 * Extrait le texte d'un buffer PDF - tente d'abord l'extraction native, puis OCR si nécessaire
 */
async function extractTextFromPdf(pdfBuffer) {
    try {
        console.log(`📖 Extraction texte PDF (${pdfBuffer.length} bytes)`);
        // Première tentative: extraction native du texte (si le PDF contient du texte)
        const nativeText = await tryNativeTextExtraction(pdfBuffer);
        if (nativeText && nativeText.length > 100) {
            console.log(`✅ Texte extrait nativement: ${nativeText.length} caractères`);
            return {
                text: nativeText,
                confidence: 99,
                method: 'native'
            };
        }
        // Fallback: OCR si pas de texte natif ou texte trop court
        if (!ocrWorker) {
            console.log('⚠️ OCR non disponible, tentative d\'extraction basique');
            return {
                text: nativeText || 'Texte non extractible',
                confidence: 0,
                method: 'native'
            };
        }
        console.log('🔍 Fallback vers OCR...');
        const ocrResult = await performOcr(pdfBuffer);
        return {
            text: ocrResult.text,
            confidence: ocrResult.confidence,
            method: 'ocr'
        };
    }
    catch (error) {
        console.error('❌ Erreur extraction texte PDF:', error);
        return {
            text: 'Erreur lors de l\'extraction du texte',
            confidence: 0,
            method: 'native'
        };
    }
}
/**
 * Tente d'extraire le texte natif d'un PDF (pour les PDFs non-scannés)
 */
async function tryNativeTextExtraction(pdfBuffer) {
    try {
        // Recherche simple de patterns de texte dans le PDF
        const pdfString = pdfBuffer.toString('latin1');
        // Extraire les objets texte basiques du PDF
        const textMatches = pdfString.match(/\((.*?)\)/g);
        if (textMatches) {
            let extractedText = textMatches
                .map(match => match.slice(1, -1)) // Enlever les parenthèses
                .filter(text => text.length > 2 && /[a-zA-ZÀ-ÿ]/.test(text)) // Filtrer le texte réel
                .join(' ');
            // Nettoyer le texte
            extractedText = extractedText
                .replace(/\\[rnt]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return extractedText;
        }
        return '';
    }
    catch (error) {
        console.log('⚠️ Extraction native échouée');
        return '';
    }
}
/**
 * Effectue l'OCR sur un buffer PDF
 */
async function performOcr(pdfBuffer) {
    try {
        console.log('🔍 Lancement OCR Tesseract...');
        const { data: { text, confidence } } = await ocrWorker.recognize(pdfBuffer);
        console.log(`✅ OCR terminé: ${text.length} caractères, confiance: ${Math.round(confidence)}%`);
        return {
            text: cleanOcrText(text),
            confidence: Math.round(confidence)
        };
    }
    catch (error) {
        console.error('❌ Erreur OCR:', error);
        throw error;
    }
}
/**
 * Nettoie le texte issu de l'OCR
 */
function cleanOcrText(text) {
    return text
        .replace(/\f/g, '\n') // Form feeds vers nouvelles lignes
        .replace(/\r\n/g, '\n') // Normaliser les fins de ligne
        .replace(/\s{3,}/g, '  ') // Réduire les espaces multiples
        .replace(/\n{3,}/g, '\n\n') // Réduire les sauts de ligne multiples
        .trim();
}
/**
 * Extrait spécifiquement les sections relatives à une zone depuis un texte de règlement
 */
function extractZoneSection(fullText, zoneName) {
    try {
        console.log(`🎯 Extraction section zone "${zoneName}"`);
        const normalizedZone = zoneName.toLowerCase().replace(/[^\w\s]/g, '');
        const lines = fullText.split('\n');
        const relevantLines = [];
        let inRelevantSection = false;
        let sectionDepth = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lowerLine = line.toLowerCase();
            // Détecter le début d'une section pertinente
            if (lowerLine.includes(normalizedZone) ||
                lowerLine.includes('zone') && lowerLine.includes(normalizedZone)) {
                inRelevantSection = true;
                sectionDepth = getLineDepth(line);
                relevantLines.push(line);
                continue;
            }
            if (inRelevantSection) {
                const currentDepth = getLineDepth(line);
                // Si on arrive à une nouvelle section de même niveau, on s'arrête
                if (currentDepth <= sectionDepth && isNewSection(line)) {
                    break;
                }
                relevantLines.push(line);
                // Limiter à 100 lignes pour éviter de prendre tout le document
                if (relevantLines.length > 100)
                    break;
            }
        }
        const extracted = relevantLines.join('\n').trim();
        console.log(`✅ Section extraite: ${extracted.length} caractères`);
        return extracted || `Section "${zoneName}" non trouvée dans le règlement.`;
    }
    catch (error) {
        console.error('❌ Erreur extraction section zone:', error);
        return `Erreur lors de l'extraction de la section "${zoneName}".`;
    }
}
/**
 * Détermine la profondeur/niveau d'une ligne (basé sur l'indentation et la numérotation)
 */
function getLineDepth(line) {
    // Compter les espaces en début de ligne
    const leadingSpaces = line.match(/^\s*/)?.[0]?.length || 0;
    // Détecter les numérotations (1., 1.1, a), etc.)
    if (/^\s*\d+\./.test(line))
        return 1;
    if (/^\s*\d+\.\d+/.test(line))
        return 2;
    if (/^\s*[a-z]\)/.test(line))
        return 3;
    return Math.floor(leadingSpaces / 4) + 1;
}
/**
 * Détermine si une ligne commence une nouvelle section
 */
function isNewSection(line) {
    const lowerLine = line.toLowerCase().trim();
    // Patterns typiques de début de section
    const sectionPatterns = [
        /^\d+\./, // 1., 2., etc.
        /^art/, // Article
        /^chapitre/,
        /^titre/,
        /^section/
    ];
    return sectionPatterns.some(pattern => pattern.test(lowerLine));
}
