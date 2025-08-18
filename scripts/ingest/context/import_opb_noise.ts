#!/usr/bin/env ts-node

/**
 * Script d'import des zones de bruit selon OPB
 * Source: Cadastre du bruit routier/ferroviaire
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface NoiseZone {
  ds_level: string; // DS I, DS II, DS III, DS IV, DS V
  geometry: any;
  db_day?: number;
  db_night?: number;
}

/**
 * Télécharge les données de bruit depuis l'API GeoAdmin
 */
async function fetchNoiseData(): Promise<NoiseZone[]> {
  console.log('📥 Téléchargement des données de bruit OPB...');
  
  // Pour l'exemple, utilisons des données de test
  // En production: appeler l'API GeoAdmin ou charger un fichier local
  const testData: NoiseZone[] = [
    {
      ds_level: 'DS II',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[[2600000, 1120000], [2600100, 1120000], [2600100, 1120100], [2600000, 1120100], [2600000, 1120000]]]]
      },
      db_day: 60,
      db_night: 50
    },
    {
      ds_level: 'DS III',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[[2600100, 1120000], [2600200, 1120000], [2600200, 1120100], [2600100, 1120100], [2600100, 1120000]]]]
      },
      db_day: 65,
      db_night: 55
    },
    {
      ds_level: 'DS IV',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[[2600200, 1120000], [2600300, 1120000], [2600300, 1120100], [2600200, 1120100], [2600200, 1120000]]]]
      },
      db_day: 70,
      db_night: 60
    }
  ];

  // En production, remplacer par:
  /*
  const response = await axios.get('https://api3.geo.admin.ch/rest/services/api/MapServer/identify', {
    params: {
      layers: 'ch.bafu.laerm-strassenlaerm_tag',
      geometryType: 'esriGeometryEnvelope',
      geometry: '2590000,1110000,2610000,1130000', // Bbox Valais central
      mapExtent: '2590000,1110000,2610000,1130000',
      imageDisplay: '1,1,1',
      returnGeometry: true,
      sr: 2056
    }
  });
  
  return response.data.results.map(transformGeoAdminToNoiseZone);
  */

  return testData;
}

/**
 * Fusionne toutes les géométries par niveau DS
 */
function mergeGeometriesByLevel(zones: NoiseZone[]): Map<string, any> {
  const mergedByLevel = new Map<string, any[]>();

  // Grouper par niveau DS
  for (const zone of zones) {
    if (!mergedByLevel.has(zone.ds_level)) {
      mergedByLevel.set(zone.ds_level, []);
    }
    mergedByLevel.get(zone.ds_level)!.push(zone.geometry);
  }

  // Fusionner les géométries
  const result = new Map<string, any>();
  for (const [level, geoms] of mergedByLevel) {
    // En production, utiliser ST_Union côté PostGIS
    result.set(level, {
      type: 'MultiPolygon',
      coordinates: geoms.flatMap(g => g.coordinates)
    });
  }

  return result;
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('🚀 Début import zones de bruit OPB');

    // 1. Récupérer les données
    const noiseZones = await fetchNoiseData();
    console.log(`📊 ${noiseZones.length} zones de bruit récupérées`);

    // 2. Fusionner par niveau
    const mergedZones = mergeGeometriesByLevel(noiseZones);
    console.log(`🔀 ${mergedZones.size} niveaux DS distincts`);

    // 3. Préparer les données pour chaque niveau
    for (const [dsLevel, geometry] of mergedZones) {
      const metadata = {
        description: `Zones de bruit ${dsLevel}`,
        ds_level: dsLevel,
        categories: ['DS I', 'DS II', 'DS III', 'DS IV', 'DS V'],
        default_value: dsLevel,
        thresholds: getNoiseThresholds(dsLevel),
        last_import: new Date().toISOString()
      };

      // 4. Upsert dans la base
      const { error } = await supabase
        .from('context_layers')
        .upsert({
          layer_name: `opb_noise_${dsLevel.toLowerCase().replace(' ', '_')}`,
          layer_type: 'vector',
          geom: geometry,
          metadata,
          source_url: 'https://map.geo.admin.ch/?topic=bafu&layers=ch.bafu.laerm-strassenlaerm_tag',
          last_updated: new Date().toISOString().split('T')[0]
        }, {
          onConflict: 'layer_name'
        });

      if (error) {
        console.error(`❌ Erreur import ${dsLevel}:`, error);
      } else {
        console.log(`✅ ${dsLevel} importé avec succès`);
      }
    }

    // 5. Créer aussi une couche union de toutes les zones
    const allZones = Array.from(mergedZones.values());
    const unionGeometry = {
      type: 'MultiPolygon',
      coordinates: allZones.flatMap(g => g.coordinates)
    };

    const { error: unionError } = await supabase
      .from('context_layers')
      .upsert({
        layer_name: 'opb_noise',
        layer_type: 'vector',
        geom: unionGeometry,
        metadata: {
          description: 'Toutes les zones de bruit OPB',
          categories: ['DS I', 'DS II', 'DS III', 'DS IV', 'DS V'],
          contains_subzones: true
        },
        source_url: 'https://map.geo.admin.ch/?topic=bafu&layers=ch.bafu.laerm-strassenlaerm_tag',
        last_updated: new Date().toISOString().split('T')[0]
      }, {
        onConflict: 'layer_name'
      });

    if (unionError) {
      console.error('❌ Erreur import union:', unionError);
    } else {
      console.log('✅ Couche union créée');
    }

    console.log('✨ Import terminé avec succès');

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

/**
 * Retourne les seuils de bruit par degré de sensibilité
 */
function getNoiseThresholds(dsLevel: string): any {
  const thresholds: Record<string, any> = {
    'DS I': { day_limit: 50, night_limit: 40, description: 'Zone de détente' },
    'DS II': { day_limit: 60, night_limit: 50, description: 'Zone d\'habitation' },
    'DS III': { day_limit: 65, night_limit: 55, description: 'Zone mixte' },
    'DS IV': { day_limit: 70, night_limit: 60, description: 'Zone industrielle' },
    'DS V': { day_limit: 75, night_limit: 65, description: 'Zone spéciale' }
  };
  
  return thresholds[dsLevel] || {};
}

// Vérifier les variables d'environnement
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

// Lancer l'import
main().catch(console.error);