/**
 * Script d'ingestion des compléments PAZ (LEVEL2)
 * Plans d'aménagement de zones et règles complémentaires communales
 */

import { createClient } from '@supabase/supabase-js';
import { RuleLevel, RuleResolver } from '../../src/engine/ruleResolver';
import { config } from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';

config();

const ruleResolver = new RuleResolver();

// Client Supabase avec service role
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Structure des règles PAZ complémentaires
 */
interface PAZComplement {
  zone_id: string;
  field: string;
  value: number | string | any;
  description: string;
  paz_ref?: string;
  date_approbation?: string;
}

/**
 * Données PAZ de test
 * En production, proviendraient de l'API cantonale ou fichiers GeoJSON
 */
const PAZ_TEST_DATA: PAZComplement[] = [
  {
    zone_id: '223e4567-e89b-12d3-a456-426614174000', // Riddes HAB_RES_20
    field: 'places_jeux_m2',
    value: 50, // 50m² minimum pour immeubles > 6 logements
    description: 'Espace de jeux obligatoire pour immeubles collectifs',
    paz_ref: 'PAZ-RIDDES-2023-A1'
  },
  {
    zone_id: '223e4567-e89b-12d3-a456-426614174000',
    field: 'places_parc_ratio',
    value: 1.5, // 1.5 place par logement
    description: 'Ratio de stationnement résidentiel',
    paz_ref: 'PAZ-RIDDES-2023-A1'
  },
  {
    zone_id: '223e4567-e89b-12d3-a456-426614174001', // Riddes HAB_COLL_3
    field: 'alignement_obligatoire',
    value: 'true',
    description: 'Alignement obligatoire sur rue principale',
    paz_ref: 'PAZ-RIDDES-2023-B2'
  },
  {
    zone_id: '223e4567-e89b-12d3-a456-426614174001',
    field: 'materiaux_facade',
    value: ['bois', 'pierre_naturelle', 'crepi'],
    description: 'Matériaux de façade autorisés en zone sensible',
    paz_ref: 'PAZ-RIDDES-2023-B2'
  },
  {
    zone_id: '223e4567-e89b-12d3-a456-426614174002', // Sion CENTRE_1
    field: 'rez_commercial_obligatoire',
    value: 'true',
    description: 'Rez-de-chaussée commercial obligatoire sur axes principaux',
    paz_ref: 'PAZ-SION-2022-C1'
  },
  {
    zone_id: '223e4567-e89b-12d3-a456-426614174002',
    field: 'h_min_rez_m',
    value: 3.5, // Hauteur minimale RDC pour commerces
    description: 'Hauteur minimale du rez-de-chaussée commercial',
    paz_ref: 'PAZ-SION-2022-C1'
  },
  {
    zone_id: '223e4567-e89b-12d3-a456-426614174003', // Martigny ZONE_MIXTE
    field: 'mixite_fonctionnelle',
    value: {
      logement_min: 0.3,
      logement_max: 0.7,
      activites_min: 0.3,
      activites_max: 0.7
    },
    description: 'Répartition obligatoire logement/activités',
    paz_ref: 'PAZ-MARTIGNY-2023-M1'
  }
];

/**
 * Récupère les compléments PAZ depuis l'API SIT Valais
 */
async function fetchPAZFromSITValais(communeName: string): Promise<PAZComplement[]> {
  try {
    const url = 'https://sitonline.vs.ch/wfs';
    const params = {
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: 'ms:paz_complements',
      outputFormat: 'application/json',
      CQL_FILTER: `commune='${communeName.toUpperCase()}'`
    };

    const response = await axios.get(url, { params });
    
    // Parser et convertir les features en règles
    const complements: PAZComplement[] = [];
    
    if (response.data?.features) {
      for (const feature of response.data.features) {
        const props = feature.properties;
        // Mapper les propriétés vers nos règles
        // Structure réelle dépendrait de l'API
      }
    }
    
    return complements;
  } catch (error) {
    console.warn(`Impossible de récupérer PAZ depuis SIT Valais: ${error}`);
    return [];
  }
}

/**
 * Crée ou récupère une source PAZ
 */
async function getOrCreatePAZSource(pazRef: string): Promise<string> {
  const { data: existing } = await supabase
    .from('regulation_sources')
    .select('id')
    .eq('pdf_path', `paz/${pazRef}`)
    .single();

  if (existing) {
    return existing.id;
  }

  const { data: newSource, error } = await supabase
    .from('regulation_sources')
    .insert({
      pdf_path: `paz/${pazRef}`,
      article_ref: pazRef,
      ocr_confidence: 0.95 // PAZ sont des documents officiels
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Erreur création source PAZ: ${error.message}`);
  }

  return newSource.id;
}

/**
 * Charge les règles depuis un fichier local
 */
async function loadPAZFromFile(filePath: string): Promise<PAZComplement[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Fichier ${filePath} non trouvé, utilisation des données de test`);
    return PAZ_TEST_DATA;
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Début de l\'ingestion des compléments PAZ (LEVEL2)');

  try {
    // Sources multiples possibles
    const sources: PAZComplement[] = [];
    
    // 1. Charger depuis fichier local
    const localPath = path.join(process.cwd(), 'data', 'paz', 'complements.json');
    const localRules = await loadPAZFromFile(localPath);
    sources.push(...localRules);
    
    // 2. Optionnel: récupérer depuis API
    // const apiRules = await fetchPAZFromSITValais('Riddes');
    // sources.push(...apiRules);
    
    console.log(`📋 ${sources.length} règles PAZ à traiter`);

    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    // Grouper par source pour optimiser
    const rulesBySource = new Map<string, PAZComplement[]>();
    for (const rule of sources) {
      const key = rule.paz_ref || 'default';
      if (!rulesBySource.has(key)) {
        rulesBySource.set(key, []);
      }
      rulesBySource.get(key)!.push(rule);
    }

    // Traiter par batch par source
    for (const [sourceRef, rules] of rulesBySource) {
      console.log(`\n📁 Traitement source PAZ: ${sourceRef}`);
      
      let sourceId: string | undefined;
      if (sourceRef !== 'default') {
        sourceId = await getOrCreatePAZSource(sourceRef);
      }

      // Préparer le batch
      const batch = rules.map(rule => ({
        zone_id: rule.zone_id,
        level: RuleLevel.LEVEL2,
        field: rule.field,
        value: rule.value,
        description: rule.description,
        source_id: sourceId,
        validity_from: rule.date_approbation ? new Date(rule.date_approbation) : undefined
      }));

      try {
        await ruleResolver.insertRulesBatch(batch);
        successCount += batch.length;
        console.log(`✅ ${batch.length} règles insérées pour ${sourceRef}`);
      } catch (error: any) {
        if (error.message?.includes('duplicate')) {
          skipCount += batch.length;
          console.log(`⏭️  Règles déjà existantes pour ${sourceRef}`);
        } else {
          errorCount += batch.length;
          console.error(`❌ Erreur batch ${sourceRef}: ${error.message}`);
        }
      }
    }

    // Résumé
    console.log('\n📊 Résumé de l\'ingestion PAZ:');
    console.log(`✅ Succès: ${successCount}`);
    console.log(`❌ Erreurs: ${errorCount}`);
    console.log(`⏭️  Ignorées: ${skipCount}`);

    // Validation avec exemple
    if (sources.length > 0) {
      const testZoneId = sources[0].zone_id;
      const consolidated = await ruleResolver.resolveRulesByZone(testZoneId);
      const level2Rules = consolidated.filter(r => r.level === RuleLevel.LEVEL2);
      
      console.log(`\n🔍 Règles PAZ pour zone ${testZoneId}:`);
      for (const rule of level2Rules) {
        console.log(`- ${rule.field}: ${JSON.stringify(rule.value)} (${rule.description})`);
      }
    }

  } catch (error: any) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  }
}

// Vérifier l'environnement
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Variables d\'environnement requises:');
  console.error('- SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Lancer
main().catch(console.error);