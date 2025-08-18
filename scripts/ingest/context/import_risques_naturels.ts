#!/usr/bin/env ts-node

/**
 * Script d'import des zones de dangers naturels
 * Source: SIT Valais - Cartes des dangers
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import axios from 'axios';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface NaturalHazard {
  hazard_type: 'crue' | 'glissement' | 'avalanche' | 'chute_pierres';
  danger_level: 'faible' | 'moyen' | 'fort' | 'tres_fort';
  geometry: any;
  commune?: string;
}

/**
 * Récupère les données de dangers naturels
 */
async function fetchNaturalHazards(): Promise<NaturalHazard[]> {
  console.log('📥 Récupération des données de dangers naturels...');

  // Données de test
  // En production: appeler WFS du SIT Valais
  const testHazards: NaturalHazard[] = [
    {
      hazard_type: 'crue',
      danger_level: 'moyen',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[
          [
            [2595000, 1118000],
            [2595500, 1118000],
            [2595500, 1118500],
            [2595000, 1118500],
            [2595000, 1118000]
          ]
        ]]
      },
      commune: 'Sion'
    },
    {
      hazard_type: 'glissement',
      danger_level: 'fort',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[
          [
            [2596000, 1119000],
            [2596300, 1119000],
            [2596300, 1119400],
            [2596000, 1119400],
            [2596000, 1119000]
          ]
        ]]
      },
      commune: 'Sion'
    },
    {
      hazard_type: 'avalanche',
      danger_level: 'tres_fort',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[
          [
            [2597000, 1120000],
            [2597500, 1120000],
            [2597500, 1120500],
            [2597000, 1120500],
            [2597000, 1120000]
          ]
        ]]
      },
      commune: 'Nax'
    }
  ];

  // En production:
  /*
  const wfsUrl = 'https://sitonline.vs.ch/wfs';
  const response = await axios.get(wfsUrl, {
    params: {
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: 'ms:dangers_naturels',
      outputFormat: 'application/json',
      srsName: 'EPSG:2056'
    }
  });

  return response.data.features.map((f: any) => ({
    hazard_type: f.properties.type_danger,
    danger_level: f.properties.niveau_danger,
    geometry: f.geometry,
    commune: f.properties.commune
  }));
  */

  return testHazards;
}

/**
 * Groupe et fusionne les géométries par type et niveau
 */
function groupHazardsByTypeAndLevel(hazards: NaturalHazard[]): Map<string, any> {
  const grouped = new Map<string, NaturalHazard[]>();

  // Grouper
  for (const hazard of hazards) {
    const key = `${hazard.hazard_type}_${hazard.danger_level}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(hazard);
  }

  // Fusionner les géométries
  const merged = new Map<string, any>();
  for (const [key, hazardGroup] of grouped) {
    merged.set(key, {
      type: 'MultiPolygon',
      coordinates: hazardGroup.flatMap(h => h.geometry.coordinates)
    });
  }

  return merged;
}

/**
 * Détermine la sévérité selon le niveau de danger
 */
function getSeverityLevel(dangerLevel: string): number {
  const severityMap: Record<string, number> = {
    'faible': 1,
    'moyen': 2,
    'fort': 3,
    'tres_fort': 3
  };
  return severityMap[dangerLevel] || 2;
}

/**
 * Génère le message descriptif
 */
function getHazardMessage(type: string, level: string): string {
  const typeLabels: Record<string, string> = {
    'crue': 'Zone de danger de crue',
    'glissement': 'Zone de danger de glissement',
    'avalanche': 'Zone de danger d\'avalanche',
    'chute_pierres': 'Zone de danger de chute de pierres'
  };

  const levelLabels: Record<string, string> = {
    'faible': 'faible',
    'moyen': 'moyen',
    'fort': 'élevé',
    'tres_fort': 'très élevé'
  };

  return `${typeLabels[type] || 'Zone de danger'} - niveau ${levelLabels[level] || level}`;
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('🚀 Début import dangers naturels');

    // 1. Récupérer les données
    const hazards = await fetchNaturalHazards();
    console.log(`📊 ${hazards.length} zones de danger récupérées`);

    // 2. Grouper par type et niveau
    const groupedHazards = groupHazardsByTypeAndLevel(hazards);
    console.log(`🔀 ${groupedHazards.size} combinaisons type/niveau`);

    // 3. Importer chaque combinaison
    for (const [key, geometry] of groupedHazards) {
      const [type, level] = key.split('_');
      const layerName = `risk_nat_${key}`;

      const metadata = {
        description: getHazardMessage(type, level),
        hazard_type: type,
        danger_level: level,
        severity: getSeverityLevel(level),
        regulations: getRegulationsByLevel(level),
        default_value: `${type} ${level}`,
        last_import: new Date().toISOString()
      };

      const { error } = await supabase
        .from('context_layers')
        .upsert({
          layer_name: layerName,
          layer_type: 'vector',
          geom: geometry,
          metadata,
          source_url: 'https://sitonline.vs.ch/dangers-naturels',
          last_updated: new Date().toISOString().split('T')[0]
        }, {
          onConflict: 'layer_name'
        });

      if (error) {
        console.error(`❌ Erreur import ${key}:`, error);
      } else {
        console.log(`✅ ${getHazardMessage(type, level)} importé`);
      }
    }

    // 4. Créer une couche union de tous les dangers
    const allHazards = Array.from(groupedHazards.values());
    const unionGeometry = {
      type: 'MultiPolygon',
      coordinates: allHazards.flatMap(g => g.coordinates)
    };

    const { error: unionError } = await supabase
      .from('context_layers')
      .upsert({
        layer_name: 'risk_nat',
        layer_type: 'vector',
        geom: unionGeometry,
        metadata: {
          description: 'Toutes les zones de dangers naturels',
          types: ['crue', 'glissement', 'avalanche', 'chute_pierres'],
          levels: ['faible', 'moyen', 'fort', 'tres_fort'],
          default_severity: 3,
          message_template: 'Zone de danger naturel'
        },
        source_url: 'https://sitonline.vs.ch/dangers-naturels',
        last_updated: new Date().toISOString().split('T')[0]
      }, {
        onConflict: 'layer_name'
      });

    if (unionError) {
      console.error('❌ Erreur import union:', unionError);
    } else {
      console.log('✅ Couche union dangers naturels créée');
    }

    console.log('✨ Import dangers naturels terminé');

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

/**
 * Retourne les restrictions réglementaires par niveau
 */
function getRegulationsByLevel(level: string): any {
  const regulations: Record<string, any> = {
    'faible': {
      construction: 'Autorisée avec mesures',
      mesures: 'Mesures de protection locales'
    },
    'moyen': {
      construction: 'Restreinte',
      mesures: 'Mesures de protection obligatoires',
      etude: 'Étude de risque requise'
    },
    'fort': {
      construction: 'Fortement limitée',
      usage: 'Pas d\'habitation permanente',
      mesures: 'Mesures lourdes requises'
    },
    'tres_fort': {
      construction: 'Interdite',
      usage: 'Zone inconstructible',
      exception: 'Ouvrages de protection uniquement'
    }
  };

  return regulations[level] || {};
}

// Vérifier les variables d'environnement
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

// Lancer l'import
main().catch(console.error);