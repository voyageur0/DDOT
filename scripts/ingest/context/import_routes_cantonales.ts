#!/usr/bin/env ts-node

/**
 * Script d'import des routes cantonales
 * Source: SIT Valais - Réseau routier cantonal
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteCantonale {
  route_id: string;
  route_name: string;
  category: 'principale' | 'secondaire' | 'liaison';
  geometry: any; // LineString
  buffer_geometry?: any; // Polygon (buffer 25m)
}

/**
 * Charge les données des routes cantonales
 */
async function loadRoutes(): Promise<RouteCantonale[]> {
  console.log('📥 Chargement des routes cantonales...');

  // Données de test
  // En production: charger depuis WFS ou fichier SHP
  const testRoutes: RouteCantonale[] = [
    {
      route_id: 'RC9',
      route_name: 'Route cantonale 9 - Sion-Sierre',
      category: 'principale',
      geometry: {
        type: 'LineString',
        coordinates: [
          [2593000, 1120000],
          [2594000, 1120100],
          [2595000, 1120200],
          [2596000, 1120300]
        ]
      }
    },
    {
      route_id: 'RC21',
      route_name: 'Route cantonale 21 - Sion-Nendaz',
      category: 'secondaire',
      geometry: {
        type: 'LineString',
        coordinates: [
          [2594000, 1119000],
          [2594100, 1119500],
          [2594200, 1120000],
          [2594300, 1120500]
        ]
      }
    },
    {
      route_id: 'RC73',
      route_name: 'Route de liaison locale',
      category: 'liaison',
      geometry: {
        type: 'LineString',
        coordinates: [
          [2595000, 1118500],
          [2595500, 1118600],
          [2596000, 1118700]
        ]
      }
    }
  ];

  return testRoutes;
}

/**
 * Crée un buffer de 25m autour des routes
 * En production, utiliser ST_Buffer dans PostGIS
 */
function createBufferGeometry(routes: RouteCantonale[]): any {
  // Simplification: créer des polygones approximatifs
  // En réalité, utiliser PostGIS ST_Buffer
  const bufferPolygons = routes.map(route => {
    const coords = route.geometry.coordinates;
    const bufferCoords = [];
    
    // Créer un rectangle approximatif autour de chaque segment
    for (let i = 0; i < coords.length - 1; i++) {
      const [x1, y1] = coords[i];
      const [x2, y2] = coords[i + 1];
      
      // Buffer simplifié de 25m
      bufferCoords.push([
        [x1 - 25, y1 - 25],
        [x2 - 25, y2 - 25],
        [x2 + 25, y2 + 25],
        [x1 + 25, y1 + 25],
        [x1 - 25, y1 - 25]
      ]);
    }
    
    return bufferCoords;
  });

  return {
    type: 'MultiPolygon',
    coordinates: bufferPolygons
  };
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('🚀 Début import routes cantonales');

    // 1. Charger les données
    const routes = await loadRoutes();
    console.log(`📊 ${routes.length} routes cantonales chargées`);

    // 2. Créer les géométries de buffer
    const bufferGeometry = createBufferGeometry(routes);

    // 3. Importer la couche buffer principale
    const metadata = {
      description: 'Buffer 25m autour des routes cantonales',
      buffer_distance_m: 25,
      route_categories: ['principale', 'secondaire', 'liaison'],
      routes_included: routes.map(r => ({
        id: r.route_id,
        name: r.route_name,
        category: r.category
      })),
      regulations: {
        construction: 'Recul obligatoire',
        recul_min_m: 25,
        bruit: 'Mesures antibruit possibles',
        acces: 'Accès direct limité'
      },
      severity_level: 2,
      message_template: 'À moins de 25m d\'une route cantonale',
      last_import: new Date().toISOString()
    };

    const { error } = await supabase
      .from('context_layers')
      .upsert({
        layer_name: 'roads_cantonal',
        layer_type: 'vector',
        geom: bufferGeometry,
        metadata,
        source_url: 'https://sitonline.vs.ch/reseau-routier',
        last_updated: new Date().toISOString().split('T')[0]
      }, {
        onConflict: 'layer_name'
      });

    if (error) {
      console.error('❌ Erreur import buffer routes:', error);
    } else {
      console.log('✅ Buffer routes cantonales importé');
    }

    // 4. Optionnel: importer aussi les lignes des routes
    const allLines = {
      type: 'MultiLineString',
      coordinates: routes.map(r => r.geometry.coordinates)
    };

    const { error: linesError } = await supabase
      .from('context_layers')
      .upsert({
        layer_name: 'roads_cantonal_lines',
        layer_type: 'vector',
        geom: allLines,
        metadata: {
          description: 'Tracé des routes cantonales',
          routes: routes.map(r => ({
            id: r.route_id,
            name: r.route_name
          }))
        },
        source_url: 'https://sitonline.vs.ch/reseau-routier',
        last_updated: new Date().toISOString().split('T')[0]
      }, {
        onConflict: 'layer_name'
      });

    if (linesError) {
      console.error('⚠️ Erreur import lignes routes:', linesError);
    } else {
      console.log('✅ Lignes routes importées');
    }

    // 5. Créer des couches par catégorie si nécessaire
    const categories = ['principale', 'secondaire', 'liaison'];
    for (const category of categories) {
      const categoryRoutes = routes.filter(r => r.category === category);
      if (categoryRoutes.length === 0) continue;

      const categoryBuffer = createBufferGeometry(categoryRoutes);
      
      const { error: catError } = await supabase
        .from('context_layers')
        .upsert({
          layer_name: `roads_cantonal_${category}`,
          layer_type: 'vector',
          geom: categoryBuffer,
          metadata: {
            description: `Routes cantonales ${category}s - buffer 25m`,
            category,
            count: categoryRoutes.length,
            severity_level: category === 'principale' ? 3 : 2
          },
          source_url: 'https://sitonline.vs.ch/reseau-routier',
          last_updated: new Date().toISOString().split('T')[0]
        }, {
          onConflict: 'layer_name'
        });

      if (catError) {
        console.error(`⚠️ Erreur import catégorie ${category}:`, catError);
      } else {
        console.log(`✅ Catégorie ${category} importée`);
      }
    }

    console.log('✨ Import routes cantonales terminé');

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

// Vérifier les variables d'environnement
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

// Lancer l'import
main().catch(console.error);