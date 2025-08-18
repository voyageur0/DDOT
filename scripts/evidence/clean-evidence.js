#!/usr/bin/env node

/**
 * Script pour nettoyer les anciennes preuves et scores
 * Usage: npm run evidence:clean -- --days=90 --dry-run
 */

const { createClient } = require('@supabase/supabase-js');
const { program } = require('commander');
const chalk = require('chalk');
require('dotenv').config();

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration CLI
program
  .option('-d, --days <number>', 'Supprimer les données plus anciennes que X jours', '90')
  .option('--dry-run', 'Simuler sans supprimer')
  .option('--keep-quality', 'Garder les scores de qualité')
  .option('--keep-evidence', 'Garder les preuves')
  .option('-c, --confirm', 'Confirmer la suppression sans prompt')
  .parse(process.argv);

const options = program.opts();

/**
 * Nettoie les anciennes données
 */
async function cleanEvidence() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(options.days));
    
    console.log(chalk.blue('\n🧹 Nettoyage des données de traçabilité\n'));
    console.log(chalk.gray(`Date limite: ${cutoffDate.toISOString().split('T')[0]}`));
    console.log(chalk.gray(`Mode: ${options.dryRun ? 'SIMULATION' : 'RÉEL'}\n`));

    let totalDeleted = 0;

    // 1. Nettoyer les preuves
    if (!options.keepEvidence) {
      console.log(chalk.yellow('📋 Analyse des preuves à supprimer...'));
      
      // Compter d'abord
      const { count: evidenceCount, error: countError } = await supabase
        .from('evidence_items')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', cutoffDate.toISOString());

      if (countError) {
        console.error(chalk.red('❌ Erreur comptage evidence:'), countError.message);
      } else {
        console.log(`   ${chalk.red(evidenceCount)} preuves à supprimer`);
        
        if (!options.dryRun && evidenceCount > 0) {
          if (!options.confirm && !await confirmDeletion('preuves', evidenceCount)) {
            console.log(chalk.yellow('⏭️  Suppression des preuves annulée'));
          } else {
            const { error: deleteError } = await supabase
              .from('evidence_items')
              .delete()
              .lt('created_at', cutoffDate.toISOString());

            if (deleteError) {
              console.error(chalk.red('❌ Erreur suppression evidence:'), deleteError.message);
            } else {
              console.log(chalk.green(`✅ ${evidenceCount} preuves supprimées`));
              totalDeleted += evidenceCount;
            }
          }
        }
      }
    }

    // 2. Nettoyer les scores de qualité
    if (!options.keepQuality) {
      console.log(chalk.yellow('\n📊 Analyse des scores de qualité à supprimer...'));
      
      // Compter d'abord
      const { count: qualityCount, error: countError } = await supabase
        .from('analysis_quality')
        .select('*', { count: 'exact', head: true })
        .lt('calc_date', cutoffDate.toISOString().split('T')[0]);

      if (countError) {
        console.error(chalk.red('❌ Erreur comptage quality:'), countError.message);
      } else {
        console.log(`   ${chalk.red(qualityCount)} scores à supprimer`);
        
        if (!options.dryRun && qualityCount > 0) {
          if (!options.confirm && !await confirmDeletion('scores', qualityCount)) {
            console.log(chalk.yellow('⏭️  Suppression des scores annulée'));
          } else {
            const { error: deleteError } = await supabase
              .from('analysis_quality')
              .delete()
              .lt('calc_date', cutoffDate.toISOString().split('T')[0]);

            if (deleteError) {
              console.error(chalk.red('❌ Erreur suppression quality:'), deleteError.message);
            } else {
              console.log(chalk.green(`✅ ${qualityCount} scores supprimés`));
              totalDeleted += qualityCount;
            }
          }
        }
      }
    }

    // 3. Analyser l'espace libéré (estimation)
    if (totalDeleted > 0) {
      const estimatedSpace = (totalDeleted * 1024) / (1024 * 1024); // ~1KB par entrée
      console.log(chalk.blue(`\n💾 Espace libéré estimé: ${estimatedSpace.toFixed(2)} MB`));
    }

    // 4. Statistiques post-nettoyage
    if (!options.dryRun) {
      await showPostCleanStats();
    }

    // Résumé
    console.log(chalk.green('\n✨ Nettoyage terminé !'));
    if (options.dryRun) {
      console.log(chalk.yellow('ℹ️  Mode simulation - aucune donnée supprimée'));
      console.log(chalk.gray('   Relancer sans --dry-run pour effectuer la suppression'));
    }

  } catch (error) {
    console.error(chalk.red('❌ Erreur inattendue:'), error);
    process.exit(1);
  }
}

/**
 * Demande confirmation avant suppression
 */
async function confirmDeletion(type, count) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    readline.question(
      chalk.yellow(`⚠️  Confirmer la suppression de ${count} ${type} ? (y/N) `),
      (answer) => {
        readline.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      }
    );
  });
}

/**
 * Affiche les statistiques après nettoyage
 */
async function showPostCleanStats() {
  console.log(chalk.blue('\n📈 Statistiques après nettoyage:'));

  // Compter les preuves restantes
  const { count: evidenceRemaining } = await supabase
    .from('evidence_items')
    .select('*', { count: 'exact', head: true });

  // Compter les scores restants
  const { count: qualityRemaining } = await supabase
    .from('analysis_quality')
    .select('*', { count: 'exact', head: true });

  console.log(`   Preuves restantes: ${chalk.green(evidenceRemaining || 0)}`);
  console.log(`   Scores restants: ${chalk.green(qualityRemaining || 0)}`);

  // Date de la plus ancienne donnée
  const { data: oldestEvidence } = await supabase
    .from('evidence_items')
    .select('created_at')
    .order('created_at')
    .limit(1);

  const { data: oldestQuality } = await supabase
    .from('analysis_quality')
    .select('calc_date')
    .order('calc_date')
    .limit(1);

  if (oldestEvidence?.[0]) {
    const date = new Date(oldestEvidence[0].created_at);
    console.log(`   Plus ancienne preuve: ${chalk.gray(date.toISOString().split('T')[0])}`);
  }

  if (oldestQuality?.[0]) {
    console.log(`   Plus ancien score: ${chalk.gray(oldestQuality[0].calc_date)}`);
  }
}

// Options de nettoyage avancées
if (process.argv.includes('--help-advanced')) {
  console.log(chalk.blue('\n🔧 Options avancées:\n'));
  console.log('  --vacuum         Exécuter VACUUM après suppression (admin only)');
  console.log('  --by-commune     Nettoyer par commune spécifique');
  console.log('  --low-quality    Supprimer uniquement les analyses < 50% de qualité');
  console.log('  --orphaned       Supprimer les preuves orphelines');
  process.exit(0);
}

// Exécution
cleanEvidence().catch(console.error);