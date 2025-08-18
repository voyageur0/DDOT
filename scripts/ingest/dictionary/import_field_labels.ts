#!/usr/bin/env ts-node

/**
 * Script d'import des labels de champs
 * Charge les libellés uniformisés pour tous les champs de règles
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface FieldLabel {
  code: string;
  label_fr_short: string;
  label_fr_long?: string;
  label_de_short?: string;
  label_en_short?: string;
  category: string;
  unit?: string;
}

// Dictionnaire des champs avec libellés courts et précis
const FIELD_LABELS: FieldLabel[] = [
  // Indices de construction
  {
    code: 'indice_u',
    label_fr_short: 'Indice U',
    label_fr_long: 'Indice d\'utilisation du sol',
    label_de_short: 'Nutzungsziffer',
    label_en_short: 'Land use index',
    category: 'density',
    unit: 'ratio'
  },
  {
    code: 'ibus',
    label_fr_short: 'IBUS',
    label_fr_long: 'Indice brut d\'utilisation du sol',
    label_de_short: 'Bruttonutzungsziffer',
    label_en_short: 'Gross floor area ratio',
    category: 'density',
    unit: 'ratio'
  },
  {
    code: 'emprise_max',
    label_fr_short: 'Emprise max',
    label_fr_long: 'Emprise au sol maximale',
    label_de_short: 'Max. Gebäudefläche',
    label_en_short: 'Max building coverage',
    category: 'density',
    unit: 'percent'
  },
  {
    code: 'cos',
    label_fr_short: 'COS',
    label_fr_long: 'Coefficient d\'occupation du sol',
    label_de_short: 'Überbauungsziffer',
    label_en_short: 'Site coverage ratio',
    category: 'density',
    unit: 'ratio'
  },

  // Dimensions et hauteurs
  {
    code: 'h_max_m',
    label_fr_short: 'Hauteur max',
    label_fr_long: 'Hauteur maximale à la corniche',
    label_de_short: 'Max. Höhe',
    label_en_short: 'Max height',
    category: 'dimensions',
    unit: 'm'
  },
  {
    code: 'h_facade_m',
    label_fr_short: 'Hauteur façade',
    label_fr_long: 'Hauteur de façade maximale',
    label_de_short: 'Fassadenhöhe',
    label_en_short: 'Facade height',
    category: 'dimensions',
    unit: 'm'
  },
  {
    code: 'h_totale_m',
    label_fr_short: 'Hauteur totale',
    label_fr_long: 'Hauteur totale au faîte',
    label_de_short: 'Gesamthöhe',
    label_en_short: 'Total height',
    category: 'dimensions',
    unit: 'm'
  },
  {
    code: 'niveaux_max',
    label_fr_short: 'Niveaux max',
    label_fr_long: 'Nombre maximum de niveaux',
    label_de_short: 'Max. Geschosse',
    label_en_short: 'Max floors',
    category: 'dimensions',
    unit: 'number'
  },

  // Distances et reculs
  {
    code: 'recul_min_m',
    label_fr_short: 'Recul min',
    label_fr_long: 'Distance minimale aux limites',
    label_de_short: 'Min. Abstand',
    label_en_short: 'Min setback',
    category: 'distances',
    unit: 'm'
  },
  {
    code: 'recul_route_m',
    label_fr_short: 'Recul route',
    label_fr_long: 'Distance minimale à la route',
    label_de_short: 'Strassenabstand',
    label_en_short: 'Road setback',
    category: 'distances',
    unit: 'm'
  },
  {
    code: 'distance_foret_m',
    label_fr_short: 'Distance forêt',
    label_fr_long: 'Distance minimale à la lisière',
    label_de_short: 'Waldabstand',
    label_en_short: 'Forest distance',
    category: 'distances',
    unit: 'm'
  },
  {
    code: 'distance_cours_eau_m',
    label_fr_short: 'Distance cours d\'eau',
    label_fr_long: 'Distance minimale aux cours d\'eau',
    label_de_short: 'Gewässerabstand',
    label_en_short: 'Watercourse distance',
    category: 'distances',
    unit: 'm'
  },

  // Toiture
  {
    code: 'toit_types',
    label_fr_short: 'Types toiture',
    label_fr_long: 'Types de toiture autorisés',
    label_de_short: 'Dachformen',
    label_en_short: 'Roof types',
    category: 'roof',
    unit: 'list'
  },
  {
    code: 'pente_toit_min',
    label_fr_short: 'Pente toit min',
    label_fr_long: 'Pente minimale de toiture',
    label_de_short: 'Min. Dachneigung',
    label_en_short: 'Min roof slope',
    category: 'roof',
    unit: 'percent'
  },
  {
    code: 'pente_toit_max',
    label_fr_short: 'Pente toit max',
    label_fr_long: 'Pente maximale de toiture',
    label_de_short: 'Max. Dachneigung',
    label_en_short: 'Max roof slope',
    category: 'roof',
    unit: 'percent'
  },

  // Surfaces calculées
  {
    code: 'su_m2',
    label_fr_short: 'Surface utile',
    label_fr_long: 'Surface utile maximale',
    label_de_short: 'Nutzfläche',
    label_en_short: 'Usable area',
    category: 'calculated',
    unit: 'm²'
  },
  {
    code: 'ibus_m2',
    label_fr_short: 'Surface brute',
    label_fr_long: 'Surface brute de plancher',
    label_de_short: 'Bruttogeschossfläche',
    label_en_short: 'Gross floor area',
    category: 'calculated',
    unit: 'm²'
  },
  {
    code: 'emprise_m2',
    label_fr_short: 'Emprise sol',
    label_fr_long: 'Emprise au sol maximale',
    label_de_short: 'Gebäudegrundfläche',
    label_en_short: 'Building footprint',
    category: 'calculated',
    unit: 'm²'
  },
  {
    code: 'niveaux_max_est',
    label_fr_short: 'Niveaux estimés',
    label_fr_long: 'Nombre de niveaux estimé',
    label_de_short: 'Geschätzte Geschosse',
    label_en_short: 'Estimated floors',
    category: 'calculated',
    unit: 'number'
  },

  // Autres paramètres
  {
    code: 'densite_min',
    label_fr_short: 'Densité min',
    label_fr_long: 'Densité minimale requise',
    label_de_short: 'Min. Dichte',
    label_en_short: 'Min density',
    category: 'density',
    unit: 'ratio'
  },
  {
    code: 'espaces_verts_min',
    label_fr_short: 'Espaces verts min',
    label_fr_long: 'Espaces verts minimum',
    label_de_short: 'Min. Grünfläche',
    label_en_short: 'Min green space',
    category: 'environment',
    unit: 'percent'
  },
  {
    code: 'places_parc_min',
    label_fr_short: 'Places parc min',
    label_fr_long: 'Places de stationnement minimum',
    label_de_short: 'Min. Parkplätze',
    label_en_short: 'Min parking spaces',
    category: 'parking',
    unit: 'number'
  },
  {
    code: 'affectation_principale',
    label_fr_short: 'Affectation',
    label_fr_long: 'Affectation principale',
    label_de_short: 'Hauptnutzung',
    label_en_short: 'Main use',
    category: 'usage',
    unit: 'text'
  },

  // Qualité et fiabilité
  {
    code: 'reliability_score',
    label_fr_short: 'Score fiabilité',
    label_fr_long: 'Score de fiabilité des données',
    label_de_short: 'Zuverlässigkeit',
    label_en_short: 'Reliability score',
    category: 'quality',
    unit: 'percent'
  },
  {
    code: 'completeness_score',
    label_fr_short: 'Complétude',
    label_fr_long: 'Score de complétude des données',
    label_de_short: 'Vollständigkeit',
    label_en_short: 'Completeness',
    category: 'quality',
    unit: 'percent'
  }
];

async function importFieldLabels() {
  console.log(chalk.blue('\n📋 Import des labels de champs...\n'));

  try {
    const records = FIELD_LABELS.map(label => ({
      code: label.code,
      type: 'field',
      label_fr_short: label.label_fr_short,
      label_fr_long: label.label_fr_long || null,
      label_de_short: label.label_de_short || null,
      label_de_long: null,
      label_en_short: label.label_en_short || null,
      label_en_long: null,
      severity: null, // Les champs n'ont pas de sévérité
      category: label.category,
      metadata: { 
        source: 'manual_definition',
        unit: label.unit || null
      }
    }));

    // Upsert en batch
    const { data, error } = await supabase
      .from('label_dictionary')
      .upsert(records, {
        onConflict: 'type,code',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      throw error;
    }

    console.log(chalk.green(`✅ ${data?.length || 0} labels de champs importés avec succès`));

    // Afficher un résumé par catégorie
    const byCategory = FIELD_LABELS.reduce((acc, label) => {
      acc[label.category] = (acc[label.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(chalk.blue('\n📊 Résumé par catégorie:'));
    Object.entries(byCategory).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${chalk.yellow(count)} champs`);
    });

    // Afficher les unités utilisées
    const units = new Set(FIELD_LABELS.map(l => l.unit).filter(Boolean));
    console.log(chalk.blue('\n📏 Unités utilisées:'));
    units.forEach(unit => {
      const count = FIELD_LABELS.filter(l => l.unit === unit).length;
      console.log(`   ${unit}: ${chalk.yellow(count)} champs`);
    });

    // Vérifier la cohérence des codes avec les autres tables
    console.log(chalk.blue('\n🔍 Vérification de cohérence...'));
    
    // Vérifier que les champs principaux sont définis
    const importantFields = ['indice_u', 'ibus', 'h_max_m', 'emprise_max', 'niveaux_max'];
    const defined = importantFields.filter(f => 
      FIELD_LABELS.some(l => l.code === f)
    );
    
    console.log(`   Champs critiques définis: ${chalk.green(defined.length)}/${importantFields.length}`);
    
    const missing = importantFields.filter(f => !defined.includes(f));
    if (missing.length > 0) {
      console.log(chalk.yellow(`   ⚠️  Champs manquants: ${missing.join(', ')}`));
    }

  } catch (error) {
    console.error(chalk.red('❌ Erreur lors de l\'import:'), error);
    process.exit(1);
  }
}

// Exécution
if (require.main === module) {
  importFieldLabels()
    .then(() => {
      console.log(chalk.green('\n✨ Import terminé avec succès!'));
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red('❌ Erreur fatale:'), error);
      process.exit(1);
    });
}