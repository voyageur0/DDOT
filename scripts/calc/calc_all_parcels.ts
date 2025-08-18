#!/usr/bin/env ts-node

/**
 * Script CLI pour calculer les indicateurs en batch pour plusieurs parcelles
 * Usage: npm run calc:batch -- <csv_file> [--save] [--limit <n>]
 */

import { createClient } from '@supabase/supabase-js';
import { RuleResolver } from '../../src/engine/ruleResolver';
import { computeBuildIndicators, CalcInput, summarizeControls } from '../../src/engine/buildCalculator';
import { config } from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ParcelData {
  id: string;
  area_m2: number;
  zone_id: string;
}

interface BatchOptions {
  csvFile: string;
  save: boolean;
  limit?: number;
  outputFile?: string;
}

/**
 * Parse les arguments CLI
 */
function parseArgs(): BatchOptions {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: npm run calc:batch -- <csv_file> [options]

Options:
  --save            Sauvegarder les résultats dans le cache
  --limit <n>       Limiter le nombre de parcelles à traiter
  --output <file>   Fichier de sortie CSV (défaut: calc_results_[timestamp].csv)
  --help            Afficher cette aide

Format CSV attendu:
  id,area_m2,zone_id
  10135,1500,223e4567-e89b-12d3-a456-426614174000
  10136,2000,223e4567-e89b-12d3-a456-426614174001

Exemple:
  npm run calc:batch -- parcels.csv --save --limit 100
    `);
    process.exit(0);
  }

  const options: BatchOptions = {
    csvFile: args[0],
    save: false
  };

  for (let i = 1; i < args.length; i++) {
    const flag = args[i];

    switch (flag) {
      case '--save':
        options.save = true;
        break;
      case '--limit':
        options.limit = parseInt(args[++i]);
        break;
      case '--output':
        options.outputFile = args[++i];
        break;
    }
  }

  return options;
}

/**
 * Lit et parse le fichier CSV
 */
async function readParcelsFromCSV(filePath: string): Promise<ParcelData[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('Fichier CSV vide ou sans données');
    }

    // Vérifier l'en-tête
    const header = lines[0].toLowerCase();
    if (!header.includes('id') || !header.includes('area_m2') || !header.includes('zone_id')) {
      throw new Error('En-tête CSV invalide. Colonnes requises: id,area_m2,zone_id');
    }

    // Parser les données
    const parcels: ParcelData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length >= 3) {
        parcels.push({
          id: parts[0],
          area_m2: parseFloat(parts[1]),
          zone_id: parts[2]
        });
      }
    }

    return parcels;
  } catch (error: any) {
    throw new Error(`Erreur lecture CSV: ${error.message}`);
  }
}

/**
 * Formate les résultats pour export CSV
 */
function formatResultsAsCSV(results: any[]): string {
  const headers = [
    'parcel_id',
    'area_m2',
    'zone_id',
    'su_m2',
    'ibus_m2',
    'emprise_m2',
    'niveaux_est',
    'reliability',
    'errors',
    'warnings',
    'infos',
    'status'
  ];

  const rows = [headers.join(',')];

  for (const result of results) {
    const row = [
      result.parcel_id,
      result.area_m2,
      result.zone_id,
      result.calculations?.suM2 ?? '',
      result.calculations?.ibusM2 ?? '',
      result.calculations?.empriseM2 ?? '',
      result.calculations?.niveauxMaxEst ?? '',
      result.calculations?.reliability ?? '',
      result.control_summary?.errors ?? 0,
      result.control_summary?.warnings ?? 0,
      result.control_summary?.infos ?? 0,
      result.status
    ];

    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Traite une parcelle
 */
async function processParcel(
  parcel: ParcelData,
  ruleResolver: RuleResolver,
  save: boolean
): Promise<any> {
  try {
    // Récupérer les règles consolidées
    const consolidatedRules = await ruleResolver.resolveRulesByZone(parcel.zone_id);

    if (consolidatedRules.length === 0) {
      return {
        parcel_id: parcel.id,
        area_m2: parcel.area_m2,
        zone_id: parcel.zone_id,
        status: 'NO_RULES',
        error: 'Aucune règle trouvée pour cette zone'
      };
    }

    // Effectuer les calculs
    const calcInput: CalcInput = {
      parcelAreaM2: parcel.area_m2,
      rules: consolidatedRules
    };

    const calculations = computeBuildIndicators(calcInput);
    const controlSummary = summarizeControls(calculations.controls);

    // Sauvegarder si demandé
    if (save) {
      await supabase
        .from('feasibility_cache')
        .upsert({
          parcel_id: parcel.id,
          zone_id: parcel.zone_id,
          calc_date: new Date().toISOString().split('T')[0],
          su_m2: calculations.suM2,
          ibus_m2: calculations.ibusM2,
          emprise_m2: calculations.empriseM2,
          niveaux_max_est: calculations.niveauxMaxEst,
          reliability: calculations.reliability,
          controls: calculations.controls,
          consolidated_rules: consolidatedRules
        });
    }

    return {
      parcel_id: parcel.id,
      area_m2: parcel.area_m2,
      zone_id: parcel.zone_id,
      calculations,
      control_summary: controlSummary,
      status: 'SUCCESS'
    };

  } catch (error: any) {
    return {
      parcel_id: parcel.id,
      area_m2: parcel.area_m2,
      zone_id: parcel.zone_id,
      status: 'ERROR',
      error: error.message
    };
  }
}

/**
 * Fonction principale
 */
async function main() {
  const options = parseArgs();
  const ruleResolver = new RuleResolver();

  try {
    // 1. Lire les parcelles depuis le CSV
    console.log(`📂 Lecture du fichier ${options.csvFile}...`);
    const parcels = await readParcelsFromCSV(options.csvFile);
    
    const totalParcels = options.limit 
      ? Math.min(parcels.length, options.limit)
      : parcels.length;

    console.log(`📋 ${totalParcels} parcelles à traiter`);

    // 2. Traiter chaque parcelle
    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < totalParcels; i++) {
      const parcel = parcels[i];
      process.stdout.write(`\r⚙️  Traitement: ${i + 1}/${totalParcels} (${parcel.id})`);

      const result = await processParcel(parcel, ruleResolver, options.save);
      results.push(result);

      // Petite pause pour éviter de surcharger la DB
      if ((i + 1) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Traitement terminé en ${duration}s`);

    // 3. Statistiques
    const stats = {
      total: results.length,
      success: results.filter(r => r.status === 'SUCCESS').length,
      noRules: results.filter(r => r.status === 'NO_RULES').length,
      errors: results.filter(r => r.status === 'ERROR').length
    };

    console.log('\n📊 STATISTIQUES:');
    console.log(`   Total traité:     ${stats.total}`);
    console.log(`   Succès:           ${stats.success}`);
    console.log(`   Sans règles:      ${stats.noRules}`);
    console.log(`   Erreurs:          ${stats.errors}`);

    // Calculer moyennes pour les succès
    const successResults = results.filter(r => r.status === 'SUCCESS');
    if (successResults.length > 0) {
      const avgReliability = successResults
        .reduce((sum, r) => sum + (r.calculations?.reliability || 0), 0) / successResults.length;
      
      const totalErrors = successResults
        .reduce((sum, r) => sum + (r.control_summary?.errors || 0), 0);
      
      const totalWarnings = successResults
        .reduce((sum, r) => sum + (r.control_summary?.warnings || 0), 0);

      console.log(`\n   Fiabilité moy.:   ${(avgReliability * 100).toFixed(0)}%`);
      console.log(`   Total erreurs:    ${totalErrors}`);
      console.log(`   Total avertiss.:  ${totalWarnings}`);
    }

    // 4. Exporter les résultats
    const outputFile = options.outputFile || `calc_results_${Date.now()}.csv`;
    const csvContent = formatResultsAsCSV(results);
    await fs.writeFile(outputFile, csvContent);

    console.log(`\n💾 Résultats exportés vers: ${outputFile}`);

    if (options.save) {
      console.log('✅ Résultats sauvegardés dans le cache');
    }

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Vérifier les variables d'environnement
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Lancer le script
main().catch(console.error);