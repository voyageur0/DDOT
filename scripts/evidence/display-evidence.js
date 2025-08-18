#!/usr/bin/env node

/**
 * Script pour afficher les preuves d'une parcelle
 * Usage: npm run evidence:display -- --parcel=12345
 */

const { createClient } = require('@supabase/supabase-js');
const { program } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
require('dotenv').config();

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration CLI
program
  .requiredOption('-p, --parcel <id>', 'ID de la parcelle')
  .option('-f, --field <name>', 'Filtrer par champ')
  .option('-t, --type <type>', 'Filtrer par type (regulation, context, calculation)')
  .option('--json', 'Sortie en JSON')
  .parse(process.argv);

const options = program.opts();

/**
 * Affiche les preuves pour une parcelle
 */
async function displayEvidence() {
  try {
    console.log(chalk.blue(`\n📊 Récupération des preuves pour la parcelle ${options.parcel}...\n`));

    // Construction de la requête
    let query = supabase
      .from('evidence_items')
      .select(`
        *,
        regulations!evidence_items_ref_id_fkey (
          commune,
          version
        ),
        context_layers!evidence_items_ref_id_fkey (
          layer_name
        )
      `)
      .eq('parcel_id', options.parcel)
      .order('reliability')
      .order('field');

    // Filtres optionnels
    if (options.field) {
      query = query.eq('field', options.field);
    }
    if (options.type) {
      query = query.eq('ref_type', options.type);
    }

    const { data: evidence, error } = await query;

    if (error) {
      console.error(chalk.red('❌ Erreur:'), error.message);
      process.exit(1);
    }

    if (!evidence || evidence.length === 0) {
      console.log(chalk.yellow('⚠️  Aucune preuve trouvée'));
      return;
    }

    // Récupérer aussi le score de qualité
    const { data: quality } = await supabase
      .from('analysis_quality')
      .select('score_global, calc_date, direct_count, derived_count, estimated_count, missing_count')
      .eq('parcel_id', options.parcel)
      .order('calc_date', { ascending: false })
      .limit(1);

    // Affichage JSON si demandé
    if (options.json) {
      console.log(JSON.stringify({ evidence, quality: quality?.[0] }, null, 2));
      return;
    }

    // Afficher le score de qualité
    if (quality && quality[0]) {
      const q = quality[0];
      console.log(chalk.green('✅ Score de qualité:'), chalk.bold(`${(q.score_global * 100).toFixed(1)}%`));
      console.log(chalk.gray(`   Dernière analyse: ${q.calc_date}`));
      console.log(chalk.gray(`   Distribution: Direct=${q.direct_count}, Dérivé=${q.derived_count}, Estimé=${q.estimated_count}, Manquant=${q.missing_count}\n`));
    }

    // Créer la table
    const table = new Table({
      head: ['Champ', 'Valeur', 'Fiabilité', 'Source', 'Commentaire'],
      colWidths: [20, 15, 12, 25, 40],
      wordWrap: true
    });

    // Grouper par type
    const byType = {
      regulation: [],
      context: [],
      calculation: []
    };

    evidence.forEach(item => {
      byType[item.ref_type].push(item);
    });

    // Afficher par type
    Object.entries(byType).forEach(([type, items]) => {
      if (items.length === 0) return;

      // En-tête de section
      table.push([{
        colSpan: 5,
        content: chalk.bold(getTypeLabel(type)),
        hAlign: 'center'
      }]);

      // Lignes de données
      items.forEach(item => {
        const value = formatValue(item);
        const reliability = formatReliability(item.reliability);
        const source = formatSource(item);
        const comment = item.comment || '-';

        table.push([
          chalk.cyan(item.field),
          value,
          reliability,
          chalk.gray(source),
          chalk.gray(comment)
        ]);
      });
    });

    console.log(table.toString());

    // Statistiques
    console.log(chalk.blue('\n📈 Statistiques:'));
    console.log(`   Total des preuves: ${evidence.length}`);
    console.log(`   Par type: Règlements=${byType.regulation.length}, Contexte=${byType.context.length}, Calculs=${byType.calculation.length}`);

  } catch (error) {
    console.error(chalk.red('❌ Erreur inattendue:'), error);
    process.exit(1);
  }
}

/**
 * Formatte la valeur selon son type
 */
function formatValue(item) {
  if (item.value_num !== null) {
    return chalk.yellow(item.value_num.toString());
  }
  if (item.value_text !== null) {
    return chalk.yellow(item.value_text);
  }
  if (item.value_json !== null) {
    return chalk.yellow('JSON');
  }
  return '-';
}

/**
 * Formatte le niveau de fiabilité avec couleur
 */
function formatReliability(reliability) {
  const colors = {
    direct: chalk.green,
    derived: chalk.blue,
    estimated: chalk.yellow,
    missing: chalk.red
  };
  
  const labels = {
    direct: '✓ Direct',
    derived: '↗ Dérivé',
    estimated: '≈ Estimé',
    missing: '✗ Manquant'
  };

  const color = colors[reliability] || chalk.gray;
  const label = labels[reliability] || reliability;
  
  return color(label);
}

/**
 * Formatte la source
 */
function formatSource(item) {
  if (item.source_path) {
    return item.source_path;
  }
  
  switch (item.ref_type) {
    case 'regulation':
      return item.regulations ? 
        `${item.regulations.commune} v${item.regulations.version}` : 
        'Règlement';
    
    case 'context':
      return item.context_layers ? 
        item.context_layers.layer_name : 
        'Contexte';
    
    case 'calculation':
      return 'Calcul interne';
    
    default:
      return item.ref_type;
  }
}

/**
 * Label pour chaque type
 */
function getTypeLabel(type) {
  const labels = {
    regulation: '📋 RÈGLEMENTS',
    context: '🌍 CONTEXTE ENVIRONNEMENTAL',
    calculation: '🧮 CALCULS'
  };
  
  return labels[type] || type.toUpperCase();
}

// Exécution
displayEvidence().catch(console.error);