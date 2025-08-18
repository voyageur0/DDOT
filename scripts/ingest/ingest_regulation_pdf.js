/**
 * Pipeline d'ingestion des règlements communaux PDF
 * Extrait les données des PDFs et les insère dans la table regulations_normalized
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const pino = require('pino');
const { performOCR, needsOCR, cleanOCRText } = require('../utils/ocr');
const { extractTables, extractRegulationData } = require('../utils/tableExtractor');
const zoneDictionary = require('../mappings/zone_dictionary.json');

// Configuration du logger
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

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Normalise un code de zone selon le dictionnaire
 * @param {string} sourceCode - Code de zone source
 * @returns {string} Code normalisé
 */
function normalizeZoneCode(sourceCode) {
  if (!sourceCode) return 'UNKNOWN';
  
  // Nettoyage du code
  const cleanCode = sourceCode.toUpperCase().trim();
  
  // Recherche directe dans le dictionnaire
  if (zoneDictionary.mappings[cleanCode]) {
    return zoneDictionary.mappings[cleanCode];
  }
  
  // Recherche par préfixe
  const prefix = cleanCode.charAt(0);
  const number = cleanCode.substring(1);
  
  // Essayer de construire un code normalisé basé sur le préfixe
  if (zoneDictionary.prefixes[prefix]) {
    if (prefix === 'R') {
      const num = parseInt(number);
      if (num <= 5) return `HAB_COLL_${num}`;
      else return `HAB_RES_${number}`;
    }
    if (prefix === 'H') return `HAB_IND_${number}`;
    if (prefix === 'T') return `TOUR_${number.replace('.', '_')}`;
    if (prefix === 'C') return `CENTRE_${number}`;
  }
  
  // Fallback : utiliser le code source préfixé
  return `CUSTOM_${cleanCode}`;
}

/**
 * Extrait le nom de la commune depuis le chemin du fichier
 * @param {string} filePath - Chemin du fichier
 * @returns {string} ID de la commune
 */
function extractCommuneId(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  
  // Patterns courants pour les noms de fichiers
  // Ex: "reglement_riddes.pdf", "RCCZ_Sion_2020.pdf", "PAZ_martigny.pdf"
  const patterns = [
    /reglement[_-]?(\w+)/i,
    /rccz[_-]?(\w+)/i,
    /paz[_-]?(\w+)/i,
    /rbcz[_-]?(\w+)/i,
    /^(\w+)[_-]?reglement/i,
    /^(\w+)[_-]?rccz/i
  ];
  
  for (const pattern of patterns) {
    const match = basename.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  }
  
  // Fallback: premier mot du nom de fichier
  const firstWord = basename.split(/[_-]/)[0];
  return firstWord.toLowerCase();
}

/**
 * Traite un fichier PDF
 * @param {string} pdfPath - Chemin vers le PDF
 * @returns {Promise<Array>} Données extraites
 */
async function processPDF(pdfPath) {
  try {
    logger.info({ pdfPath }, 'Traitement du PDF');
    
    const communeId = extractCommuneId(pdfPath);
    const relativePath = path.relative(process.cwd(), pdfPath);
    
    // Vérifier si OCR nécessaire
    let text = null;
    if (await needsOCR(pdfPath)) {
      logger.info({ pdfPath }, 'OCR nécessaire');
      const ocrResults = await performOCR(pdfPath);
      
      if (Array.isArray(ocrResults)) {
        text = ocrResults.map(r => r.text).join('\n\n');
      } else {
        text = ocrResults;
      }
      
      text = cleanOCRText(text);
    }
    
    // Extraire les tableaux
    const tables = await extractTables(pdfPath, text);
    
    // Extraire aussi les données non tabulaires
    const additionalData = text ? extractRegulationData(text) : [];
    
    // Combiner et normaliser toutes les données
    const allData = [];
    
    // Données des tableaux
    for (const table of tables) {
      for (const row of table.rows) {
        if (!row.data || !row.data.zone_code) continue;
        
        const normalized = {
          commune_id: communeId,
          zone_code_source: row.data.zone_code,
          zone_code_norm: normalizeZoneCode(row.data.zone_code),
          source_pdf_path: relativePath,
          source_page: table.page || 1,
          ...row.data.values
        };
        
        allData.push(normalized);
      }
    }
    
    // Données additionnelles non tabulaires
    for (const data of additionalData) {
      if (!data.zone_code_source) continue;
      
      // Éviter les doublons
      const exists = allData.some(d => 
        d.zone_code_source === data.zone_code_source && 
        d.source_page === (data.page || 1)
      );
      
      if (!exists) {
        const normalized = {
          commune_id: communeId,
          zone_code_source: data.zone_code_source,
          zone_code_norm: normalizeZoneCode(data.zone_code_source),
          source_pdf_path: relativePath,
          source_page: data.page || 1,
          ...data.values
        };
        
        allData.push(normalized);
      }
    }
    
    logger.info({ pdfPath, extractedRows: allData.length }, 'Extraction terminée');
    return allData;
    
  } catch (error) {
    logger.error({ pdfPath, error: error.message }, 'Erreur traitement PDF');
    throw error;
  }
}

/**
 * Insère les données dans PostgreSQL
 * @param {Array} data - Données à insérer
 */
async function insertData(data) {
  if (!data || data.length === 0) return;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const row of data) {
      // Préparer les données JSON
      const toitTypes = row.toit_types ? JSON.stringify(row.toit_types) : null;
      const penteMinMax = row.pente_toit_min_max ? JSON.stringify(row.pente_toit_min_max) : null;
      
      // Upsert avec ON CONFLICT
      const query = `
        INSERT INTO regulations_normalized (
          commune_id, zone_code_source, zone_code_norm,
          indice_u, ibus, emprise_max, h_max_m, niveaux_max,
          toit_types, pente_toit_min_max, recul_min_m,
          remarques, source_pdf_path, source_page
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
        ON CONFLICT (commune_id, zone_code_source, source_pdf_path, source_page)
        DO UPDATE SET
          zone_code_norm = EXCLUDED.zone_code_norm,
          indice_u = EXCLUDED.indice_u,
          ibus = EXCLUDED.ibus,
          emprise_max = EXCLUDED.emprise_max,
          h_max_m = EXCLUDED.h_max_m,
          niveaux_max = EXCLUDED.niveaux_max,
          toit_types = EXCLUDED.toit_types,
          pente_toit_min_max = EXCLUDED.pente_toit_min_max,
          recul_min_m = EXCLUDED.recul_min_m,
          remarques = EXCLUDED.remarques,
          inserted_at = now()
      `;
      
      const values = [
        row.commune_id,
        row.zone_code_source,
        row.zone_code_norm,
        row.indice_u || null,
        row.ibus || null,
        row.emprise_max || null,
        row.h_max_m || null,
        row.niveaux_max || null,
        toitTypes,
        penteMinMax,
        row.recul_min_m || null,
        row.remarques || null,
        row.source_pdf_path,
        row.source_page
      ];
      
      await client.query(query, values);
    }
    
    await client.query('COMMIT');
    logger.info({ rowsInserted: data.length }, 'Données insérées avec succès');
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error: error.message }, 'Erreur insertion données');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  try {
    logger.info('Démarrage du pipeline d\'ingestion PDF');
    
    // Créer la table si elle n'existe pas
    await createTableIfNotExists();
    
    // Dossier des PDFs
    const pdfDir = process.env.PDF_DIR || path.join(process.cwd(), 'data', 'pdfs');
    
    // Vérifier que le dossier existe
    try {
      await fs.access(pdfDir);
    } catch {
      logger.error({ pdfDir }, 'Dossier PDF introuvable');
      process.exit(1);
    }
    
    // Lister tous les PDFs
    const files = await fs.readdir(pdfDir);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    
    logger.info({ pdfCount: pdfFiles.length, pdfDir }, 'PDFs trouvés');
    
    let totalRows = 0;
    
    // Traiter chaque PDF
    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(pdfDir, pdfFile);
      
      try {
        const data = await processPDF(pdfPath);
        await insertData(data);
        totalRows += data.length;
      } catch (error) {
        logger.error({ pdfFile, error: error.message }, 'Erreur traitement fichier');
        // Continuer avec le fichier suivant
      }
    }
    
    logger.info({ totalRows, filesProcessed: pdfFiles.length }, 'Pipeline terminé');
    
    // Afficher des statistiques
    await displayStats();
    
  } catch (error) {
    logger.error({ error: error.message }, 'Erreur fatale');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Crée la table si elle n'existe pas
 */
async function createTableIfNotExists() {
  const migrationPath = path.join(process.cwd(), 'migrations', 'V20250722__create_regulations_normalized.sql');
  
  try {
    const sql = await fs.readFile(migrationPath, 'utf8');
    await pool.query(sql);
    logger.info('Table regulations_normalized vérifiée/créée');
  } catch (error) {
    logger.warn({ error: error.message }, 'Impossible d\'exécuter la migration automatiquement');
  }
}

/**
 * Affiche les statistiques après ingestion
 */
async function displayStats() {
  try {
    const stats = await pool.query(`
      SELECT 
        commune_id,
        COUNT(DISTINCT zone_code_source) as zones,
        COUNT(*) as total_rows,
        COUNT(indice_u) as with_indice_u,
        COUNT(ibus) as with_ibus,
        COUNT(h_max_m) as with_height
      FROM regulations_normalized
      GROUP BY commune_id
      ORDER BY commune_id
    `);
    
    console.log('\n📊 Statistiques d\'ingestion:');
    console.table(stats.rows);
    
    const total = await pool.query('SELECT COUNT(*) as total FROM regulations_normalized');
    console.log(`\n✅ Total: ${total.rows[0].total} lignes dans regulations_normalized`);
    
  } catch (error) {
    logger.error({ error: error.message }, 'Erreur affichage stats');
  }
}

// Lancer si exécuté directement
if (require.main === module) {
  main();
}

module.exports = {
  processPDF,
  normalizeZoneCode,
  extractCommuneId
};