#!/usr/bin/env ts-node

/**
 * Script d'import des données de pente (MNT)
 * Source: swissALTI3D traité avec GDAL
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SlopeZone {
  slope_class: string; // '0-15', '15-30', '30-45', '>45'
  slope_min: number;
  slope_max: number;
  geometry: any;
}

/**
 * Charge les zones de pente classifiées
 * En production: traiter le raster MNT avec GDAL puis vectoriser
 */
async function loadSlopeZones(): Promise<SlopeZone[]> {
  console.log('📥 Chargement des zones de pente...');

  // Données de test avec zones de pente classifiées
  const testSlopeZones: SlopeZone[] = [
    {
      slope_class: '0-15',
      slope_min: 0,
      slope_max: 15,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[
          [
            [2592000, 1118000],
            [2594000, 1118000],
            [2594000, 1119000],
            [2592000, 1119000],
            [2592000, 1118000]
          ]
        ]]
      }
    },
    {
      slope_class: '15-30',
      slope_min: 15,
      slope_max: 30,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[
          [
            [2594000, 1119000],
            [2595000, 1119000],
            [2595000, 1120000],
            [2594000, 1120000],
            [2594000, 1119000]
          ]
        ]]
      }
    },
    {
      slope_class: '30-45',
      slope_min: 30,
      slope_max: 45,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[
          [
            [2595000, 1120000],
            [2596000, 1120000],
            [2596000, 1121000],
            [2595000, 1121000],
            [2595000, 1120000]
          ]
        ]]
      }
    },
    {
      slope_class: '>45',
      slope_min: 45,
      slope_max: 90,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[
          [
            [2596000, 1121000],
            [2597000, 1121000],
            [2597000, 1122000],
            [2596000, 1122000],
            [2596000, 1121000]
          ]
        ]]
      }
    }
  ];

  // En production:
  /*
  // 1. Calculer la pente avec GDAL
  // gdaldem slope input_dem.tif slope_percent.tif -p -s 1
  
  // 2. Reclassifier en zones
  // gdal_calc.py -A slope_percent.tif --outfile=slope_classes.tif \
  //   --calc="1*(A<=15) + 2*((A>15)*(A<=30)) + 3*((A>30)*(A<=45)) + 4*(A>45)"
  
  // 3. Vectoriser
  // gdal_polygonize.py slope_classes.tif -f "GeoJSON" slope_zones.geojson
  
  // 4. Charger et parser le GeoJSON
  const geojson = await fs.readFile('slope_zones.geojson', 'utf-8');
  return parseGeoJSONToSlopeZones(geojson);
  */

  return testSlopeZones;
}

/**
 * Détermine la sévérité selon la pente
 */
function getSeverityBySlope(slopeClass: string): number {
  const severityMap: Record<string, number> = {
    '0-15': 1,    // INFO
    '15-30': 1,   // INFO
    '30-45': 2,   // WARNING
    '>45': 3      // CRITICAL
  };
  return severityMap[slopeClass] || 2;
}

/**
 * Génère le message pour la pente
 */
function getSlopeMessage(slopeClass: string): string {
  const messages: Record<string, string> = {
    '0-15': 'Terrain plat à faible pente',
    '15-30': 'Pente modérée (15-30%)',
    '30-45': 'Forte pente (30-45%)',
    '>45': 'Pente très forte (>45%)'
  };
  return messages[slopeClass] || `Pente ${slopeClass}%`;
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('🚀 Début import données de pente');

    // 1. Charger les zones de pente
    const slopeZones = await loadSlopeZones();
    console.log(`📊 ${slopeZones.length} classes de pente chargées`);

    // 2. Importer chaque classe de pente
    for (const zone of slopeZones) {
      const layerName = `slope_pct_${zone.slope_class.replace('>', 'gt')}`;

      const metadata = {
        description: getSlopeMessage(zone.slope_class),
        slope_class: zone.slope_class,
        slope_min_pct: zone.slope_min,
        slope_max_pct: zone.slope_max,
        severity: getSeverityBySlope(zone.slope_class),
        regulations: getSlopeRegulations(zone.slope_class),
        construction_impacts: getConstructionImpacts(zone.slope_class),
        source_resolution_m: 2,
        processing: 'swissALTI3D -> GDAL slope -> vectorization',
        last_import: new Date().toISOString()
      };

      const { error } = await supabase
        .from('context_layers')
        .upsert({
          layer_name: layerName,
          layer_type: 'vector',
          geom: zone.geometry,
          metadata,
          source_url: 'https://www.swisstopo.admin.ch/fr/geodata/height/alti3d.html',
          last_updated: new Date().toISOString().split('T')[0]
        }, {
          onConflict: 'layer_name'
        });

      if (error) {
        console.error(`❌ Erreur import classe ${zone.slope_class}:`, error);
      } else {
        console.log(`✅ Classe de pente ${zone.slope_class} importée`);
      }
    }

    // 3. Créer une méta-couche pour référence raster
    const { error: metaError } = await supabase
      .from('context_layers')
      .upsert({
        layer_name: 'slope_pct',
        layer_type: 'raster',
        geom: null, // Pas de géométrie pour le raster
        raster_ref: 'slope_percent.tif', // Référence au fichier raster
        metadata: {
          description: 'Modèle numérique de pente en pourcentage',
          resolution_m: 2,
          source: 'swissALTI3D',
          classes: slopeZones.map(z => ({
            class: z.slope_class,
            severity: getSeverityBySlope(z.slope_class)
          })),
          default_severity: 2,
          message_template: 'Pente ${value}%',
          processing_notes: 'Utiliser ST_Value pour extraction ponctuelle'
        },
        source_url: 'https://www.swisstopo.admin.ch/',
        last_updated: new Date().toISOString().split('T')[0]
      }, {
        onConflict: 'layer_name'
      });

    if (metaError) {
      console.error('❌ Erreur import méta-couche:', metaError);
    } else {
      console.log('✅ Méta-couche pente créée');
    }

    console.log('✨ Import données de pente terminé');

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

/**
 * Retourne les contraintes réglementaires par classe de pente
 */
function getSlopeRegulations(slopeClass: string): any {
  const regulations: Record<string, any> = {
    '0-15': {
      construction: 'Sans restriction liée à la pente',
      terrassement: 'Minimal'
    },
    '15-30': {
      construction: 'Étude géotechnique recommandée',
      terrassement: 'Modéré',
      drainage: 'Attention aux eaux de ruissellement'
    },
    '30-45': {
      construction: 'Étude géotechnique obligatoire',
      terrassement: 'Important avec soutènement',
      fondations: 'Adaptées à la pente',
      acces: 'Pente d\'accès limitée'
    },
    '>45': {
      construction: 'Très difficile, déconseillée',
      terrassement: 'Très important',
      risques: 'Glissement, érosion',
      autorisation: 'Dérogation nécessaire'
    }
  };

  return regulations[slopeClass] || {};
}

/**
 * Retourne les impacts sur la construction
 */
function getConstructionImpacts(slopeClass: string): any {
  const impacts: Record<string, any> = {
    '0-15': {
      cout_supplementaire: '0-5%',
      complexite: 'Standard'
    },
    '15-30': {
      cout_supplementaire: '5-15%',
      complexite: 'Modérée',
      elements: ['Murs de soutènement bas', 'Drainage renforcé']
    },
    '30-45': {
      cout_supplementaire: '15-30%',
      complexite: 'Élevée',
      elements: ['Murs de soutènement importants', 'Fondations spéciales', 'Accès adapté']
    },
    '>45': {
      cout_supplementaire: '>30%',
      complexite: 'Très élevée',
      elements: ['Techniques spéciales', 'Risques géotechniques', 'Maintenance accrue']
    }
  };

  return impacts[slopeClass] || {};
}

// Vérifier les variables d'environnement
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

// Lancer l'import
main().catch(console.error);