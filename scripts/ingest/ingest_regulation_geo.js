/**
 * Pipeline d'ingestion des données géospatiales de zonage
 * Importe les données depuis GeoAdmin et SIT Valais
 */

const axios = require('axios');
const { Pool } = require('pg');
const pino = require('pino');
const WKT = require('wellknown');

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

// Configuration des APIs
const GEOADMIN_BASE_URL = 'https://api3.geo.admin.ch/rest/services/api';
const SIT_VALAIS_WFS_URL = 'https://sitonline.vs.ch/wfs';

// Liste des communes du Valais avec leurs codes
const COMMUNES_VALAIS = [
  { id: 'riddes', name: 'Riddes', bfs_code: '6033' },
  { id: 'sion', name: 'Sion', bfs_code: '6266' },
  { id: 'martigny', name: 'Martigny', bfs_code: '6136' },
  { id: 'monthey', name: 'Monthey', bfs_code: '6153' },
  { id: 'sierre', name: 'Sierre', bfs_code: '6248' },
  { id: 'brig', name: 'Brig-Glis', bfs_code: '6002' },
  { id: 'visp', name: 'Visp', bfs_code: '6297' },
  { id: 'naters', name: 'Naters', bfs_code: '6213' },
  { id: 'collombey', name: 'Collombey-Muraz', bfs_code: '6152' },
  { id: 'bagnes', name: 'Bagnes', bfs_code: '6031' }
];

/**
 * Recherche les zones d'affectation via GeoAdmin
 * @param {string} communeName - Nom de la commune
 * @param {string} bfsCode - Code BFS de la commune
 * @returns {Promise<Array>} Zones trouvées
 */
async function fetchGeoAdminZones(communeName, bfsCode) {
  try {
    logger.info({ commune: communeName }, 'Recherche zones GeoAdmin');
    
    // Layer des zones d'affectation
    const layer = 'ch.are.bauzonen';
    
    // Recherche par nom de commune
    const searchUrl = `${GEOADMIN_BASE_URL}/MapServer/find`;
    const params = {
      layer: layer,
      searchText: communeName,
      searchField: 'gemeinde_name',
      returnGeometry: true,
      geometryFormat: 'geojson',
      sr: 2056 // CH1903+ / LV95
    };
    
    const response = await axios.get(searchUrl, { params });
    
    if (response.data && response.data.results) {
      logger.info({ 
        commune: communeName, 
        zonesFound: response.data.results.length 
      }, 'Zones GeoAdmin trouvées');
      
      return response.data.results.map(result => ({
        source: 'geoadmin',
        layer: layer,
        commune_id: communeName.toLowerCase(),
        zone_type: result.attributes.typ_kt || result.attributes.typ_ch,
        zone_label: result.attributes.label,
        area_m2: result.attributes.flaeche_m2,
        geometry: result.geometry,
        attributes: result.attributes
      }));
    }
    
    return [];
  } catch (error) {
    logger.error({ 
      commune: communeName, 
      error: error.message 
    }, 'Erreur recherche GeoAdmin');
    return [];
  }
}

/**
 * Recherche les zones via SIT Valais WFS
 * @param {string} communeName - Nom de la commune
 * @returns {Promise<Array>} Zones trouvées
 */
async function fetchSITValaisZones(communeName) {
  try {
    logger.info({ commune: communeName }, 'Recherche zones SIT Valais');
    
    // Requête WFS GetFeature
    const params = {
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: 'ms:paz_zonesaffectation',
      outputFormat: 'application/json',
      srsName: 'EPSG:2056',
      CQL_FILTER: `commune='${communeName.toUpperCase()}'`
    };
    
    const response = await axios.get(SIT_VALAIS_WFS_URL, { 
      params,
      headers: {
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    
    if (response.data && response.data.features) {
      logger.info({ 
        commune: communeName, 
        zonesFound: response.data.features.length 
      }, 'Zones SIT Valais trouvées');
      
      return response.data.features.map(feature => ({
        source: 'sit_valais',
        layer: 'paz_zonesaffectation',
        commune_id: communeName.toLowerCase(),
        zone_type: feature.properties.type_zone,
        zone_code: feature.properties.code_zone,
        zone_label: feature.properties.designation,
        area_m2: feature.properties.surface,
        geometry: feature.geometry,
        attributes: feature.properties
      }));
    }
    
    return [];
  } catch (error) {
    logger.error({ 
      commune: communeName, 
      error: error.message 
    }, 'Erreur recherche SIT Valais');
    return [];
  }
}

/**
 * Insère les données géospatiales dans PostgreSQL
 * @param {Array} zones - Zones à insérer
 */
async function insertGeoData(zones) {
  if (!zones || zones.length === 0) return;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Créer la table si elle n'existe pas
    await client.query(`
      CREATE TABLE IF NOT EXISTS paz_layers (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        layer VARCHAR(100) NOT NULL,
        commune_id VARCHAR(50) NOT NULL,
        zone_type VARCHAR(100),
        zone_code VARCHAR(50),
        zone_label TEXT,
        area_m2 NUMERIC,
        geometry GEOMETRY(Geometry, 2056),
        attributes JSONB,
        inserted_at TIMESTAMP DEFAULT now()
      );
      
      CREATE INDEX IF NOT EXISTS idx_paz_layers_commune 
      ON paz_layers (commune_id);
      
      CREATE INDEX IF NOT EXISTS idx_paz_layers_geometry 
      ON paz_layers USING GIST (geometry);
    `);
    
    // Insérer les zones
    for (const zone of zones) {
      // Convertir la géométrie GeoJSON en WKT puis en geometry PostGIS
      let geometryWKT = null;
      if (zone.geometry) {
        try {
          geometryWKT = WKT.stringify(zone.geometry);
        } catch (err) {
          logger.warn({ error: err.message }, 'Erreur conversion géométrie');
        }
      }
      
      const query = `
        INSERT INTO paz_layers (
          source, layer, commune_id, zone_type, zone_code,
          zone_label, area_m2, geometry, attributes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          ${geometryWKT ? 'ST_GeomFromText($8, 2056)' : 'NULL'},
          $9
        )
      `;
      
      const values = [
        zone.source,
        zone.layer,
        zone.commune_id,
        zone.zone_type,
        zone.zone_code,
        zone.zone_label,
        zone.area_m2,
        geometryWKT,
        JSON.stringify(zone.attributes || {})
      ];
      
      // Retirer le paramètre géométrie si null
      if (!geometryWKT) {
        values.splice(7, 1);
      }
      
      await client.query(query, values);
    }
    
    await client.query('COMMIT');
    logger.info({ zonesInserted: zones.length }, 'Zones géospatiales insérées');
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error: error.message }, 'Erreur insertion zones géospatiales');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Traite une commune
 * @param {object} commune - Données de la commune
 */
async function processCommune(commune) {
  try {
    logger.info({ commune: commune.name }, 'Traitement commune');
    
    const allZones = [];
    
    // Rechercher sur GeoAdmin
    const geoAdminZones = await fetchGeoAdminZones(commune.name, commune.bfs_code);
    allZones.push(...geoAdminZones);
    
    // Rechercher sur SIT Valais
    const sitValaisZones = await fetchSITValaisZones(commune.name);
    allZones.push(...sitValaisZones);
    
    // Insérer dans la base
    if (allZones.length > 0) {
      await insertGeoData(allZones);
    }
    
    logger.info({ 
      commune: commune.name, 
      totalZones: allZones.length 
    }, 'Commune traitée');
    
    return allZones.length;
    
  } catch (error) {
    logger.error({ 
      commune: commune.name, 
      error: error.message 
    }, 'Erreur traitement commune');
    return 0;
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  try {
    logger.info('Démarrage du pipeline d\'ingestion géospatiale');
    
    // Traiter une commune spécifique si fournie
    const targetCommune = process.argv[2];
    let communesToProcess = COMMUNES_VALAIS;
    
    if (targetCommune) {
      const commune = COMMUNES_VALAIS.find(c => 
        c.id === targetCommune.toLowerCase() || 
        c.name.toLowerCase() === targetCommune.toLowerCase()
      );
      
      if (commune) {
        communesToProcess = [commune];
      } else {
        logger.error({ commune: targetCommune }, 'Commune non trouvée');
        process.exit(1);
      }
    }
    
    logger.info({ 
      communeCount: communesToProcess.length 
    }, 'Communes à traiter');
    
    let totalZones = 0;
    
    // Traiter chaque commune
    for (const commune of communesToProcess) {
      const zonesCount = await processCommune(commune);
      totalZones += zonesCount;
      
      // Pause entre les communes pour éviter de surcharger les APIs
      if (communesToProcess.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    logger.info({ 
      totalZones, 
      communesProcessed: communesToProcess.length 
    }, 'Pipeline terminé');
    
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
 * Affiche les statistiques après ingestion
 */
async function displayStats() {
  try {
    const stats = await pool.query(`
      SELECT 
        commune_id,
        source,
        COUNT(*) as zones,
        SUM(area_m2) as total_area_m2,
        COUNT(DISTINCT zone_type) as zone_types
      FROM paz_layers
      GROUP BY commune_id, source
      ORDER BY commune_id, source
    `);
    
    console.log('\n📊 Statistiques d\'ingestion géospatiale:');
    console.table(stats.rows);
    
    const total = await pool.query('SELECT COUNT(*) as total FROM paz_layers');
    console.log(`\n✅ Total: ${total.rows[0].total} zones dans paz_layers`);
    
    // Vérifier spécifiquement Riddes
    const riddes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM paz_layers 
      WHERE commune_id = 'riddes'
    `);
    
    if (riddes.rows[0].count > 0) {
      console.log(`✅ Test Riddes OK: ${riddes.rows[0].count} zones trouvées`);
    } else {
      console.log('⚠️  Test Riddes: Aucune zone trouvée');
    }
    
  } catch (error) {
    logger.error({ error: error.message }, 'Erreur affichage stats');
  }
}

// Lancer si exécuté directement
if (require.main === module) {
  main();
}

module.exports = {
  fetchGeoAdminZones,
  fetchSITValaisZones,
  processCommune
};