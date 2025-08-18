/**
 * Extracteur de tableaux PDF avec heuristiques pour les règlements communaux
 * Utilise pdf-parse et des regex pour détecter les structures tabulaires
 */

const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
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
 * Patterns pour détecter les zones et indices
 */
const PATTERNS = {
  // Codes de zones (R1, R2, T0.3, H20, etc.)
  zoneCode: /\b([RTHCZMI]\d{1,2}(?:\.\d)?)\b/g,
  
  // Indices U et IBUS
  indiceU: /(?:indice\s+u|u\s*[:=])\s*(\d+[.,]\d+|\d+\s*%?)/gi,
  ibus: /(?:ibus|i\.b\.u\.s\.?)\s*[:=]?\s*(\d+[.,]\d+|\d+\s*%?)/gi,
  
  // Hauteurs
  hauteur: /(?:h(?:auteur)?\s*max(?:imale)?|h\s*[:=])\s*(\d+(?:[.,]\d+)?)\s*m(?:ètres?)?/gi,
  niveaux: /(\d+)\s*(?:niveaux?|étages?)/gi,
  
  // Emprise et reculs
  emprise: /(?:emprise|e\.s\.)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*%?/gi,
  recul: /(?:recul|distance)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m(?:ètres?)?/gi,
  
  // Toitures
  toitType: /(?:toit(?:ure)?|couverture)\s*[:=]?\s*([^,\n]+)/gi,
  pente: /(?:pente)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:[-à]\s*(\d+(?:[.,]\d+)?))?\s*[°%]/gi,
  
  // Détection de lignes de tableau
  tableLine: /^[\s|]*([RTHCZMI]\d{1,2}(?:\.\d)?)\s*[|:\s]+(.+)$/gm,
  
  // Séparateurs de colonnes
  columnSeparator: /\s{2,}|\t+|\|/
};

/**
 * Extrait les tableaux d'un PDF
 * @param {string} pdfPath - Chemin vers le fichier PDF
 * @param {string} ocrText - Texte OCR optionnel si PDF scanné
 * @returns {Promise<Array>} Tableaux extraits avec métadonnées
 */
async function extractTables(pdfPath, ocrText = null) {
  try {
    logger.info({ pdfPath }, 'Début extraction tableaux');
    
    let text = ocrText;
    let pages = [];
    
    // Si pas de texte OCR fourni, extraire avec pdf-parse
    if (!text) {
      const dataBuffer = await fs.readFile(pdfPath);
      const pdfData = await pdfParse(dataBuffer, {
        // Options pour préserver la structure
        normalizeWhitespace: false,
        disableCombineTextItems: false
      });
      
      text = pdfData.text;
      pages = pdfData.pages || [];
    }
    
    // Analyser le texte pour trouver les tableaux
    const tables = [];
    const lines = text.split('\n');
    
    let currentTable = null;
    let currentPage = 1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Détecter le début d'un tableau (ligne avec code de zone)
      const zoneMatch = line.match(PATTERNS.zoneCode);
      if (zoneMatch && detectTableStructure(line)) {
        // Si on était déjà dans un tableau, le sauvegarder
        if (currentTable && currentTable.rows.length > 0) {
          tables.push(currentTable);
        }
        
        // Commencer un nouveau tableau
        currentTable = {
          page: currentPage,
          startLine: i,
          headers: detectHeaders(lines, i),
          rows: []
        };
      }
      
      // Ajouter la ligne au tableau courant si elle contient des données
      if (currentTable && zoneMatch) {
        const rowData = parseTableRow(line);
        if (rowData) {
          currentTable.rows.push({
            line: i,
            data: rowData
          });
        }
      }
      
      // Détecter les changements de page
      if (line.includes('Page') || line.match(/^\d+$/)) {
        const pageMatch = line.match(/(\d+)/);
        if (pageMatch) {
          currentPage = parseInt(pageMatch[1]);
        }
      }
    }
    
    // Sauvegarder le dernier tableau
    if (currentTable && currentTable.rows.length > 0) {
      tables.push(currentTable);
    }
    
    logger.info({ pdfPath, tablesFound: tables.length }, 'Extraction tableaux terminée');
    
    // Post-traitement pour enrichir les données
    return tables.map(table => enrichTableData(table, text));
    
  } catch (error) {
    logger.error({ pdfPath, error: error.message }, 'Erreur extraction tableaux');
    throw error;
  }
}

/**
 * Détecte si une ligne fait partie d'une structure tabulaire
 * @param {string} line - Ligne à analyser
 * @returns {boolean}
 */
function detectTableStructure(line) {
  // Vérifier la présence de séparateurs
  const hasSeparators = PATTERNS.columnSeparator.test(line);
  
  // Vérifier la présence de multiples valeurs numériques
  const numbers = line.match(/\d+(?:[.,]\d+)?/g);
  const hasMultipleNumbers = numbers && numbers.length >= 2;
  
  // Vérifier la structure générale
  const hasTablePattern = PATTERNS.tableLine.test(line);
  
  return hasSeparators || (hasMultipleNumbers && hasTablePattern);
}

/**
 * Détecte les en-têtes de tableau
 * @param {string[]} lines - Toutes les lignes
 * @param {number} startIndex - Index de début
 * @returns {string[]} Headers détectés
 */
function detectHeaders(lines, startIndex) {
  // Chercher en arrière pour trouver les en-têtes
  const headers = [];
  const headerKeywords = ['zone', 'indice', 'ibus', 'hauteur', 'emprise', 'recul', 'remarque'];
  
  for (let i = Math.max(0, startIndex - 5); i < startIndex; i++) {
    const line = lines[i].toLowerCase();
    const hasKeywords = headerKeywords.some(kw => line.includes(kw));
    
    if (hasKeywords) {
      // Extraire les en-têtes de la ligne
      const parts = lines[i].split(PATTERNS.columnSeparator);
      return parts.map(h => h.trim()).filter(h => h.length > 0);
    }
  }
  
  // Headers par défaut si non trouvés
  return ['Zone', 'Indice U', 'IBUS', 'Hauteur max', 'Emprise', 'Recul', 'Remarques'];
}

/**
 * Parse une ligne de tableau
 * @param {string} line - Ligne à parser
 * @returns {object|null} Données extraites
 */
function parseTableRow(line) {
  const parts = line.split(PATTERNS.columnSeparator);
  if (parts.length < 2) return null;
  
  const row = {
    zone_code: '',
    values: {}
  };
  
  // Extraire le code de zone (première colonne généralement)
  const zoneMatch = parts[0].match(/([RTHCZMI]\d{1,2}(?:\.\d)?)/);
  if (zoneMatch) {
    row.zone_code = zoneMatch[1];
  }
  
  // Analyser le reste de la ligne
  const restOfLine = parts.slice(1).join(' ');
  
  // Extraire les indices
  const indiceUMatch = restOfLine.match(/(\d+[.,]\d+|\d+)\s*%?/);
  if (indiceUMatch) {
    row.values.indice_u = parseNumericValue(indiceUMatch[1]);
  }
  
  // Extraire IBUS
  const ibusMatch = restOfLine.match(/ibus[:\s]*(\d+[.,]\d+|\d+)\s*%?/i);
  if (ibusMatch) {
    row.values.ibus = parseNumericValue(ibusMatch[1]);
  }
  
  // Extraire hauteur
  const hauteurMatch = restOfLine.match(/(\d+(?:[.,]\d+)?)\s*m/);
  if (hauteurMatch) {
    row.values.h_max_m = parseFloat(hauteurMatch[1].replace(',', '.'));
  }
  
  // Extraire niveaux
  const niveauxMatch = restOfLine.match(/(\d+)\s*(?:niv|étage)/i);
  if (niveauxMatch) {
    row.values.niveaux_max = parseInt(niveauxMatch[1]);
  }
  
  return row.zone_code ? row : null;
}

/**
 * Parse une valeur numérique en tenant compte des pourcentages
 * @param {string} value - Valeur à parser
 * @returns {number} Valeur numérique (0-1 pour les ratios)
 */
function parseNumericValue(value) {
  if (!value) return null;
  
  // Remplacer virgule par point
  let num = parseFloat(value.replace(',', '.'));
  
  // Si c'est un pourcentage, convertir en ratio
  if (value.includes('%') || num > 10) {
    num = num / 100;
  }
  
  return num;
}

/**
 * Enrichit les données du tableau avec le contexte
 * @param {object} table - Tableau à enrichir
 * @param {string} fullText - Texte complet du PDF
 * @returns {object} Tableau enrichi
 */
function enrichTableData(table, fullText) {
  // Extraire le contexte autour du tableau
  const contextStart = Math.max(0, table.startLine - 10);
  const contextEnd = table.startLine + table.rows.length + 10;
  const context = fullText.split('\n').slice(contextStart, contextEnd).join('\n');
  
  // Enrichir chaque ligne avec des données supplémentaires
  table.rows = table.rows.map(row => {
    const enrichedRow = { ...row };
    
    // Chercher des informations supplémentaires dans le contexte
    if (!enrichedRow.data.values.ibus && row.data.zone_code) {
      const ibusPattern = new RegExp(`${row.data.zone_code}[^\\n]*ibus[:\\s]*(\\d+[.,]\\d+)`, 'i');
      const ibusMatch = context.match(ibusPattern);
      if (ibusMatch) {
        enrichedRow.data.values.ibus = parseNumericValue(ibusMatch[1]);
      }
    }
    
    // Extraire les types de toiture
    const toitPattern = new RegExp(`${row.data.zone_code}[^\\n]*(?:toit|couverture)[:\\s]*([^\\n,]+)`, 'i');
    const toitMatch = context.match(toitPattern);
    if (toitMatch) {
      enrichedRow.data.values.toit_types = [toitMatch[1].trim()];
    }
    
    return enrichedRow;
  });
  
  return table;
}

/**
 * Extrait toutes les données de règlement d'un texte
 * @param {string} text - Texte à analyser
 * @returns {Array} Données extraites
 */
function extractRegulationData(text) {
  const results = [];
  
  // Diviser par zones
  const zoneBlocks = text.split(/(?=\b[RTHCZMI]\d{1,2}(?:\.\d)?\b)/);
  
  for (const block of zoneBlocks) {
    const zoneMatch = block.match(/\b([RTHCZMI]\d{1,2}(?:\.\d)?)\b/);
    if (!zoneMatch) continue;
    
    const data = {
      zone_code_source: zoneMatch[1],
      values: {}
    };
    
    // Extraire tous les indices
    const indiceUMatch = block.match(PATTERNS.indiceU);
    if (indiceUMatch) {
      data.values.indice_u = parseNumericValue(indiceUMatch[1]);
    }
    
    const ibusMatch = block.match(PATTERNS.ibus);
    if (ibusMatch) {
      data.values.ibus = parseNumericValue(ibusMatch[1]);
    }
    
    const hauteurMatch = block.match(PATTERNS.hauteur);
    if (hauteurMatch) {
      data.values.h_max_m = parseFloat(hauteurMatch[1].replace(',', '.'));
    }
    
    const niveauxMatch = block.match(PATTERNS.niveaux);
    if (niveauxMatch) {
      data.values.niveaux_max = parseInt(niveauxMatch[1]);
    }
    
    const empriseMatch = block.match(PATTERNS.emprise);
    if (empriseMatch) {
      data.values.emprise_max = parseNumericValue(empriseMatch[1]);
    }
    
    const reculMatch = block.match(PATTERNS.recul);
    if (reculMatch) {
      data.values.recul_min_m = parseFloat(reculMatch[1].replace(',', '.'));
    }
    
    // Types de toiture
    const toitMatches = Array.from(block.matchAll(PATTERNS.toitType));
    if (toitMatches.length > 0) {
      data.values.toit_types = toitMatches.map(m => m[1].trim());
    }
    
    // Pentes
    const penteMatch = block.match(PATTERNS.pente);
    if (penteMatch) {
      data.values.pente_toit_min_max = {
        min: parseFloat(penteMatch[1].replace(',', '.')),
        max: penteMatch[2] ? parseFloat(penteMatch[2].replace(',', '.')) : null
      };
    }
    
    results.push(data);
  }
  
  return results;
}

module.exports = {
  extractTables,
  extractRegulationData,
  parseNumericValue
};