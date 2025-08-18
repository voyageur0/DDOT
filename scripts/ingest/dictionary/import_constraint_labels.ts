#!/usr/bin/env ts-node

/**
 * Script d'import des labels de contraintes
 * Charge les libellés uniformisés pour toutes les contraintes environnementales
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ConstraintLabel {
  code: string;
  label_fr_short: string;
  label_fr_long?: string;
  label_de_short?: string;
  label_en_short?: string;
  severity: 1 | 2 | 3;
  category: string;
}

// Dictionnaire des contraintes avec messages courts (≤12 mots)
const CONSTRAINT_LABELS: ConstraintLabel[] = [
  // Bruit (OPB)
  {
    code: 'opb_noise_DS_I',
    label_fr_short: 'Bruit DS I',
    label_fr_long: 'Zone de bruit - Degré de sensibilité I',
    label_de_short: 'Lärm ES I',
    label_en_short: 'Noise zone DS I',
    severity: 1,
    category: 'noise'
  },
  {
    code: 'opb_noise_DS_II',
    label_fr_short: 'Bruit DS II',
    label_fr_long: 'Zone de bruit - Degré de sensibilité II',
    label_de_short: 'Lärm ES II',
    label_en_short: 'Noise zone DS II',
    severity: 1,
    category: 'noise'
  },
  {
    code: 'opb_noise_DS_III',
    label_fr_short: 'Bruit DS III - Isolation requise',
    label_fr_long: 'Zone de bruit DS III - Isolation acoustique obligatoire',
    label_de_short: 'Lärm ES III - Isolation nötig',
    label_en_short: 'Noise DS III - Insulation required',
    severity: 2,
    category: 'noise'
  },
  {
    code: 'opb_noise_DS_IV',
    label_fr_short: 'Bruit DS IV - Construction limitée',
    label_fr_long: 'Zone de bruit DS IV - Construction très limitée',
    label_de_short: 'Lärm ES IV - Bau eingeschränkt',
    label_en_short: 'Noise DS IV - Limited construction',
    severity: 3,
    category: 'noise'
  },

  // Aéroport (OFAC)
  {
    code: 'ofac_airport',
    label_fr_short: 'Zone aéroport - Restrictions OFAC',
    label_fr_long: 'Zone de sécurité aéroportuaire selon plan sectoriel OFAC',
    label_de_short: 'Flughafenzone - BAZL Auflagen',
    label_en_short: 'Airport zone - FOCA restrictions',
    severity: 2,
    category: 'airport'
  },
  {
    code: 'ofac_approach',
    label_fr_short: 'Couloir approche - Hauteur limitée',
    label_fr_long: 'Couloir d\'approche aérienne - Limitation de hauteur',
    label_de_short: 'Anflugschneise - Höhenbegrenzung',
    label_en_short: 'Approach corridor - Height limit',
    severity: 2,
    category: 'airport'
  },

  // Risques naturels
  {
    code: 'risk_nat_faible',
    label_fr_short: 'Danger naturel faible',
    label_fr_long: 'Zone de danger naturel faible - Mesures simples',
    label_de_short: 'Geringe Naturgefahr',
    label_en_short: 'Low natural hazard',
    severity: 1,
    category: 'natural_hazard'
  },
  {
    code: 'risk_nat_moyen',
    label_fr_short: 'Danger moyen - Mesures requises',
    label_fr_long: 'Zone de danger moyen - Mesures de protection obligatoires',
    label_de_short: 'Mittlere Gefahr - Massnahmen nötig',
    label_en_short: 'Medium hazard - Measures required',
    severity: 2,
    category: 'natural_hazard'
  },
  {
    code: 'risk_nat_fort',
    label_fr_short: 'Danger fort - Construction interdite',
    label_fr_long: 'Zone de danger fort - Construction interdite sauf exceptions',
    label_de_short: 'Hohe Gefahr - Bauverbot',
    label_en_short: 'High hazard - Building prohibited',
    severity: 3,
    category: 'natural_hazard'
  },

  // Types de dangers spécifiques
  {
    code: 'risk_inondation_moyen',
    label_fr_short: 'Risque inondation - Protection requise',
    label_fr_long: 'Zone inondable moyenne - Mesures de protection requises',
    label_de_short: 'Hochwasser - Schutz erforderlich',
    label_en_short: 'Flood risk - Protection required',
    severity: 2,
    category: 'natural_hazard'
  },
  {
    code: 'risk_glissement_fort',
    label_fr_short: 'Glissement terrain - Zone critique',
    label_fr_long: 'Zone de glissement de terrain élevé - Construction très limitée',
    label_de_short: 'Erdrutsch - Kritische Zone',
    label_en_short: 'Landslide - Critical zone',
    severity: 3,
    category: 'natural_hazard'
  },
  {
    code: 'risk_avalanche_fort',
    label_fr_short: 'Avalanche - Zone rouge',
    label_fr_long: 'Zone d\'avalanche rouge - Construction interdite',
    label_de_short: 'Lawine - Rote Zone',
    label_en_short: 'Avalanche - Red zone',
    severity: 3,
    category: 'natural_hazard'
  },

  // Pente
  {
    code: 'slope_0_15',
    label_fr_short: 'Terrain plat (0-15%)',
    label_fr_long: 'Terrain plat ou faible pente - Construction standard',
    label_de_short: 'Flaches Gelände (0-15%)',
    label_en_short: 'Flat terrain (0-15%)',
    severity: 1,
    category: 'topography'
  },
  {
    code: 'slope_15_30',
    label_fr_short: 'Pente modérée (15-30%)',
    label_fr_long: 'Pente modérée - Adaptations mineures',
    label_de_short: 'Mässige Neigung (15-30%)',
    label_en_short: 'Moderate slope (15-30%)',
    severity: 1,
    category: 'topography'
  },
  {
    code: 'slope_30_45',
    label_fr_short: 'Pente forte - Terrassements importants',
    label_fr_long: 'Pente forte (30-45%) - Terrassements et murs de soutènement',
    label_de_short: 'Starke Neigung - Terrassierung nötig',
    label_en_short: 'Steep slope - Major earthworks',
    severity: 2,
    category: 'topography'
  },
  {
    code: 'slope_45_plus',
    label_fr_short: 'Pente extrême - Construction complexe',
    label_fr_long: 'Pente très forte (>45%) - Construction très complexe et coûteuse',
    label_de_short: 'Extreme Neigung - Komplexer Bau',
    label_en_short: 'Extreme slope - Complex construction',
    severity: 3,
    category: 'topography'
  },

  // Routes
  {
    code: 'roads_0_25m',
    label_fr_short: 'Route <25m - Recul obligatoire',
    label_fr_long: 'Proximité immédiate route cantonale - Respect des distances légales',
    label_de_short: 'Strasse <25m - Abstand nötig',
    label_en_short: 'Road <25m - Setback required',
    severity: 2,
    category: 'infrastructure'
  },
  {
    code: 'roads_25_100m',
    label_fr_short: 'Route 25-100m - Bruit routier',
    label_fr_long: 'Route cantonale à proximité - Exposition au bruit',
    label_de_short: 'Strasse 25-100m - Verkehrslärm',
    label_en_short: 'Road 25-100m - Traffic noise',
    severity: 1,
    category: 'infrastructure'
  },

  // Protection des eaux
  {
    code: 'water_protection_S1',
    label_fr_short: 'Protection eaux S1 - Interdiction',
    label_fr_long: 'Zone S1 de protection des eaux - Construction interdite',
    label_de_short: 'Gewässerschutz S1 - Bauverbot',
    label_en_short: 'Water protection S1 - Prohibited',
    severity: 3,
    category: 'water'
  },
  {
    code: 'water_protection_S2',
    label_fr_short: 'Protection eaux S2 - Restrictions',
    label_fr_long: 'Zone S2 de protection des eaux - Fortes restrictions',
    label_de_short: 'Gewässerschutz S2 - Einschränkungen',
    label_en_short: 'Water protection S2 - Restrictions',
    severity: 2,
    category: 'water'
  },
  {
    code: 'water_protection_S3',
    label_fr_short: 'Protection eaux S3 - Précautions',
    label_fr_long: 'Zone S3 de protection des eaux - Précautions nécessaires',
    label_de_short: 'Gewässerschutz S3 - Vorsicht',
    label_en_short: 'Water protection S3 - Precautions',
    severity: 1,
    category: 'water'
  },

  // Patrimoine
  {
    code: 'heritage_protected',
    label_fr_short: 'Bâtiment protégé - Restrictions',
    label_fr_long: 'Bâtiment d\'importance patrimoniale - Modifications limitées',
    label_de_short: 'Denkmalschutz - Einschränkungen',
    label_en_short: 'Heritage building - Restrictions',
    severity: 2,
    category: 'heritage'
  },
  {
    code: 'heritage_perimeter',
    label_fr_short: 'Périmètre protégé - Avis requis',
    label_fr_long: 'Périmètre de protection du site - Avis commission requis',
    label_de_short: 'Schutzperimeter - Bewilligung nötig',
    label_en_short: 'Protected area - Approval needed',
    severity: 2,
    category: 'heritage'
  }
];

async function importConstraintLabels() {
  console.log(chalk.blue('\n📋 Import des labels de contraintes...\n'));

  try {
    const records = CONSTRAINT_LABELS.map(label => ({
      code: label.code,
      type: 'constraint',
      label_fr_short: label.label_fr_short,
      label_fr_long: label.label_fr_long || null,
      label_de_short: label.label_de_short || null,
      label_de_long: null,
      label_en_short: label.label_en_short || null,
      label_en_long: null,
      severity: label.severity,
      category: label.category,
      metadata: { 
        source: 'manual_definition',
        max_words: 12
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

    console.log(chalk.green(`✅ ${data?.length || 0} labels de contraintes importés avec succès`));

    // Afficher un résumé par catégorie et sévérité
    const byCat = CONSTRAINT_LABELS.reduce((acc, label) => {
      acc[label.category] = (acc[label.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySev = CONSTRAINT_LABELS.reduce((acc, label) => {
      acc[label.severity] = (acc[label.severity] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log(chalk.blue('\n📊 Résumé par catégorie:'));
    Object.entries(byCat).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${chalk.yellow(count)} contraintes`);
    });

    console.log(chalk.blue('\n⚠️  Résumé par sévérité:'));
    console.log(`   INFO (1): ${chalk.green(bySev[1] || 0)} contraintes`);
    console.log(`   WARNING (2): ${chalk.yellow(bySev[2] || 0)} contraintes`);
    console.log(`   CRITICAL (3): ${chalk.red(bySev[3] || 0)} contraintes`);

    // Vérifier la longueur des messages
    const tooLong = CONSTRAINT_LABELS.filter(l => 
      l.label_fr_short.split(/\s+/).length > 12
    );
    
    if (tooLong.length > 0) {
      console.log(chalk.yellow('\n⚠️  Labels trop longs (>12 mots):'));
      tooLong.forEach(l => {
        const words = l.label_fr_short.split(/\s+/).length;
        console.log(`   ${l.code}: ${words} mots`);
      });
    } else {
      console.log(chalk.green('\n✅ Tous les labels respectent la limite de 12 mots'));
    }

  } catch (error) {
    console.error(chalk.red('❌ Erreur lors de l\'import:'), error);
    process.exit(1);
  }
}

// Exécution
if (require.main === module) {
  importConstraintLabels()
    .then(() => {
      console.log(chalk.green('\n✨ Import terminé avec succès!'));
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red('❌ Erreur fatale:'), error);
      process.exit(1);
    });
}