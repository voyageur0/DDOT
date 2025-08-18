#!/usr/bin/env node

/**
 * Script pour générer un rapport de qualité des données
 * Usage: npm run evidence:report -- --commune=Sion --days=30
 */

const { createClient } = require('@supabase/supabase-js');
const { program } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration CLI
program
  .option('-c, --commune <name>', 'Filtrer par commune')
  .option('-d, --days <number>', 'Nombre de jours à analyser', '30')
  .option('-o, --output <file>', 'Fichier de sortie (optionnel)')
  .option('--min-score <number>', 'Score minimum à afficher', '0')
  .option('--format <type>', 'Format de sortie (table, csv, json)', 'table')
  .parse(process.argv);

const options = program.opts();

/**
 * Génère un rapport de qualité
 */
async function generateQualityReport() {
  try {
    console.log(chalk.blue('\n📊 Génération du rapport de qualité...\n'));

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - parseInt(options.days));

    // 1. Statistiques globales via la vue
    const { data: globalStats, error: statsError } = await supabase
      .from('v_quality_summary')
      .select('*')
      .gte('calc_date', dateFrom.toISOString().split('T')[0])
      .order('calc_date', { ascending: false });

    if (statsError) {
      console.error(chalk.red('❌ Erreur stats:'), statsError.message);
      process.exit(1);
    }

    // 2. Détails par parcelle
    let qualityQuery = supabase
      .from('analysis_quality')
      .select('*')
      .gte('calc_date', dateFrom.toISOString().split('T')[0])
      .gte('score_global', parseFloat(options.minScore))
      .order('score_global', { ascending: true })
      .limit(100);

    const { data: parcels, error: parcelsError } = await qualityQuery;

    if (parcelsError) {
      console.error(chalk.red('❌ Erreur parcelles:'), parcelsError.message);
      process.exit(1);
    }

    // 3. Champs les plus problématiques
    const { data: missingFields, error: missingError } = await supabase
      .from('evidence_items')
      .select('field')
      .eq('reliability', 'missing')
      .gte('created_at', dateFrom.toISOString());

    if (missingError) {
      console.error(chalk.red('❌ Erreur missing:'), missingError.message);
    }

    // Analyser les résultats
    const report = analyzeData(globalStats, parcels, missingFields);

    // Afficher selon le format
    switch (options.format) {
      case 'json':
        await outputJSON(report);
        break;
      case 'csv':
        await outputCSV(report);
        break;
      default:
        outputTable(report);
    }

  } catch (error) {
    console.error(chalk.red('❌ Erreur inattendue:'), error);
    process.exit(1);
  }
}

/**
 * Analyse les données pour le rapport
 */
function analyzeData(globalStats, parcels, missingFields) {
  // Calculer les moyennes
  const avgScore = globalStats.reduce((sum, s) => sum + s.avg_global_score, 0) / globalStats.length;
  const totalParcels = globalStats.reduce((sum, s) => sum + s.parcels_analyzed, 0);

  // Compter les champs manquants
  const missingCount = {};
  if (missingFields) {
    missingFields.forEach(item => {
      missingCount[item.field] = (missingCount[item.field] || 0) + 1;
    });
  }

  // Top 5 des champs manquants
  const topMissing = Object.entries(missingCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  // Distribution des scores
  const scoreDistribution = {
    excellent: parcels.filter(p => p.score_global >= 0.9).length,
    good: parcels.filter(p => p.score_global >= 0.7 && p.score_global < 0.9).length,
    average: parcels.filter(p => p.score_global >= 0.5 && p.score_global < 0.7).length,
    poor: parcels.filter(p => p.score_global < 0.5).length
  };

  return {
    period: {
      from: new Date(Date.now() - options.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0],
      days: options.days
    },
    summary: {
      totalParcels,
      avgScore: (avgScore * 100).toFixed(1),
      scoreDistribution
    },
    topMissingFields: topMissing,
    dailyTrend: globalStats.map(s => ({
      date: s.calc_date,
      parcels: s.parcels_analyzed,
      score: (s.avg_global_score * 100).toFixed(1)
    })),
    worstParcels: parcels.slice(0, 10).map(p => ({
      id: p.parcel_id,
      score: (p.score_global * 100).toFixed(1),
      missing: p.missing_count,
      date: p.calc_date
    }))
  };
}

/**
 * Affiche le rapport en table
 */
function outputTable(report) {
  // En-tête
  console.log(chalk.bold.green('\n📈 RAPPORT DE QUALITÉ DES DONNÉES'));
  console.log(chalk.gray(`Période: ${report.period.from} au ${report.period.to} (${report.period.days} jours)\n`));

  // Résumé
  console.log(chalk.blue('📊 Résumé Global'));
  const summaryTable = new Table();
  summaryTable.push(
    ['Parcelles analysées', chalk.yellow(report.summary.totalParcels)],
    ['Score moyen', chalk.yellow(`${report.summary.avgScore}%`)],
    ['Distribution', `Excellent: ${report.summary.scoreDistribution.excellent}, ` +
                    `Bon: ${report.summary.scoreDistribution.good}, ` +
                    `Moyen: ${report.summary.scoreDistribution.average}, ` +
                    `Faible: ${report.summary.scoreDistribution.poor}`]
  );
  console.log(summaryTable.toString());

  // Champs manquants
  if (report.topMissingFields.length > 0) {
    console.log(chalk.blue('\n🔍 Top 5 Champs Manquants'));
    const missingTable = new Table({
      head: ['Champ', 'Occurrences'],
      colWidths: [30, 15]
    });
    
    report.topMissingFields.forEach(([field, count]) => {
      missingTable.push([chalk.red(field), count]);
    });
    
    console.log(missingTable.toString());
  }

  // Tendance quotidienne (derniers 7 jours)
  console.log(chalk.blue('\n📅 Tendance (7 derniers jours)'));
  const trendTable = new Table({
    head: ['Date', 'Parcelles', 'Score Moyen'],
    colWidths: [15, 12, 15]
  });
  
  report.dailyTrend.slice(0, 7).forEach(day => {
    trendTable.push([
      day.date,
      day.parcels,
      formatScoreWithColor(parseFloat(day.score))
    ]);
  });
  
  console.log(trendTable.toString());

  // Parcelles problématiques
  if (report.worstParcels.length > 0) {
    console.log(chalk.blue('\n⚠️  Parcelles à Améliorer'));
    const worstTable = new Table({
      head: ['Parcelle ID', 'Score', 'Champs Manquants', 'Date'],
      colWidths: [20, 10, 18, 15]
    });
    
    report.worstParcels.forEach(parcel => {
      worstTable.push([
        chalk.red(parcel.id),
        formatScoreWithColor(parseFloat(parcel.score)),
        parcel.missing,
        parcel.date
      ]);
    });
    
    console.log(worstTable.toString());
  }

  // Recommandations
  console.log(chalk.blue('\n💡 Recommandations'));
  generateRecommendations(report);
}

/**
 * Génère des recommandations basées sur l'analyse
 */
function generateRecommendations(report) {
  const recommendations = [];

  // Score moyen
  if (parseFloat(report.summary.avgScore) < 70) {
    recommendations.push('⚠️  Le score moyen est inférieur à 70%. Prioriser la collecte de données directes.');
  }

  // Champs manquants
  if (report.topMissingFields.length > 0) {
    const topField = report.topMissingFields[0][0];
    recommendations.push(`📋 Le champ "${topField}" est le plus souvent manquant. Vérifier les sources de données.`);
  }

  // Distribution
  if (report.summary.scoreDistribution.poor > report.summary.scoreDistribution.excellent) {
    recommendations.push('📊 Plus de parcelles ont un score faible qu\'excellent. Réviser le processus de collecte.');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ La qualité des données est globalement bonne !');
  }

  recommendations.forEach(rec => console.log(`   ${rec}`));
}

/**
 * Formatte un score avec couleur
 */
function formatScoreWithColor(score) {
  if (score >= 90) return chalk.green(`${score}%`);
  if (score >= 70) return chalk.yellow(`${score}%`);
  if (score >= 50) return chalk.magenta(`${score}%`);
  return chalk.red(`${score}%`);
}

/**
 * Sortie JSON
 */
async function outputJSON(report) {
  const json = JSON.stringify(report, null, 2);
  
  if (options.output) {
    await fs.writeFile(options.output, json);
    console.log(chalk.green(`✅ Rapport sauvegardé dans ${options.output}`));
  } else {
    console.log(json);
  }
}

/**
 * Sortie CSV
 */
async function outputCSV(report) {
  const headers = ['Date', 'Parcelles', 'Score_Moyen'];
  const rows = report.dailyTrend.map(day => 
    `${day.date},${day.parcels},${day.score}`
  );
  
  const csv = [headers.join(','), ...rows].join('\n');
  
  if (options.output) {
    await fs.writeFile(options.output, csv);
    console.log(chalk.green(`✅ Rapport CSV sauvegardé dans ${options.output}`));
  } else {
    console.log(csv);
  }
}

// Exécution
generateQualityReport().catch(console.error);