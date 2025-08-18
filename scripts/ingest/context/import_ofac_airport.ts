#!/usr/bin/env ts-node

/**
 * Script d'import des surfaces de dégagement aéroport (OFAC)
 * Source: Office fédéral de l'aviation civile - Aéroport de Sion
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AirportZone {
  type: string; // 'obstacle_limitation', 'noise_exposure', 'safety_zone'
  description: string;
  geometry: any;
  max_height_m?: number;
}

/**
 * Charge les données OFAC depuis un fichier local ou API
 */
async function loadAirportZones(): Promise<AirportZone[]> {
  console.log('📥 Chargement des zones aéroport OFAC...');

  // Données de test pour l'aéroport de Sion
  // En production: charger depuis fichier GeoJSON officiel
  const sionAirportZones: AirportZone[] = [
    {
      type: 'obstacle_limitation',
      description: 'Surface de limitation d\'obstacles - Approche piste 25',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[
          [
            [2592000, 1119000],
            [2594000, 1119000],
            [2594500, 1120500],
            [2592500, 1120500],
            [2592000, 1119000]
          ]
        ]]
      },
      max_height_m: 50
    },
    {
      type: 'safety_zone',
      description: 'Zone de sécurité aéroportuaire',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[
          [
            [2593000, 1119500],
            [2594000, 1119500],
            [2594000, 1120000],
            [2593000, 1120000],
            [2593000, 1119500]
          ]
        ]]
      }
    },
    {
      type: 'noise_exposure',
      description: 'Courbe d\'exposition au bruit 65 dB(A)',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[
          [
            [2592500, 1119300],
            [2594500, 1119300],
            [2594800, 1120200],
            [2592200, 1120200],
            [2592500, 1119300]
          ]
        ]]
      }
    }
  ];

  // En production:
  /*
  const filePath = path.join(process.cwd(), 'data', 'ofac', 'sion_airport_surfaces.geojson');
  const content = await fs.readFile(filePath, 'utf-8');
  const geojson = JSON.parse(content);
  
  return geojson.features.map((feature: any) => ({
    type: feature.properties.type,
    description: feature.properties.description,
    geometry: feature.geometry,
    max_height_m: feature.properties.max_height_m
  }));
  */

  return sionAirportZones;
}

/**
 * Fusionne toutes les zones en une seule géométrie
 */
function mergeAllZones(zones: AirportZone[]): any {
  // En production, utiliser ST_Union dans PostGIS
  return {
    type: 'MultiPolygon',
    coordinates: zones.flatMap(z => z.geometry.coordinates)
  };
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('🚀 Début import zones aéroport OFAC');

    // 1. Charger les données
    const airportZones = await loadAirportZones();
    console.log(`📊 ${airportZones.length} zones aéroport chargées`);

    // 2. Importer chaque type de zone séparément
    for (const zone of airportZones) {
      const layerName = `ofac_airport_${zone.type}`;
      
      const metadata = {
        description: zone.description,
        airport: 'Sion',
        type: zone.type,
        max_height_m: zone.max_height_m,
        restrictions: getRestrictionsByType(zone.type),
        legal_basis: 'Plan sectoriel de l\'infrastructure aéronautique (PSIA)',
        last_import: new Date().toISOString()
      };

      const { error } = await supabase
        .from('context_layers')
        .upsert({
          layer_name: layerName,
          layer_type: 'vector',
          geom: zone.geometry,
          metadata,
          source_url: 'https://www.bazl.admin.ch/bazl/fr/home/infrastructure/aerodromes/fiches-des-aerodromes.html',
          last_updated: new Date().toISOString().split('T')[0]
        }, {
          onConflict: 'layer_name'
        });

      if (error) {
        console.error(`❌ Erreur import ${zone.type}:`, error);
      } else {
        console.log(`✅ Zone ${zone.type} importée`);
      }
    }

    // 3. Créer une couche union
    const unionGeometry = mergeAllZones(airportZones);
    
    const { error: unionError } = await supabase
      .from('context_layers')
      .upsert({
        layer_name: 'ofac_airport',
        layer_type: 'vector',
        geom: unionGeometry,
        metadata: {
          description: 'Toutes les surfaces OFAC - Aéroport de Sion',
          airport: 'Sion',
          types: airportZones.map(z => z.type),
          default_value: 'Zone OFAC',
          severity_level: 2,
          message_template: 'Zone de sécurité aéroport (OFAC)'
        },
        source_url: 'https://www.bazl.admin.ch/',
        last_updated: new Date().toISOString().split('T')[0]
      }, {
        onConflict: 'layer_name'
      });

    if (unionError) {
      console.error('❌ Erreur import union:', unionError);
    } else {
      console.log('✅ Couche union OFAC créée');
    }

    console.log('✨ Import OFAC terminé avec succès');

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

/**
 * Retourne les restrictions par type de zone
 */
function getRestrictionsByType(type: string): any {
  const restrictions: Record<string, any> = {
    'obstacle_limitation': {
      construction: 'Hauteur limitée selon plan des surfaces',
      vegetation: 'Arbres soumis à limitation',
      equipment: 'Antennes et grues soumises à autorisation'
    },
    'safety_zone': {
      construction: 'Construction fortement restreinte',
      usage: 'Pas d\'habitation permanente',
      density: 'Densité de personnes limitée'
    },
    'noise_exposure': {
      construction: 'Mesures d\'isolation acoustique requises',
      usage: 'Usage sensible au bruit déconseillé',
      windows: 'Triple vitrage recommandé'
    }
  };

  return restrictions[type] || {};
}

// Vérifier les variables d'environnement
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

// Lancer l'import
main().catch(console.error);