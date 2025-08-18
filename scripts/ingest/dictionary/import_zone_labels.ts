#!/usr/bin/env ts-node

/**
 * Script d'import des labels de zones
 * Charge les libellés uniformisés pour toutes les zones d'affectation
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ZoneLabel {
  code: string;
  label_fr_short: string;
  label_fr_long?: string;
  label_de_short?: string;
  label_de_long?: string;
  label_en_short?: string;
  label_en_long?: string;
  category?: string;
}

// Dictionnaire complet des zones
const ZONE_LABELS: ZoneLabel[] = [
  // Zones résidentielles
  {
    code: 'R1',
    label_fr_short: 'Hab. collectives',
    label_fr_long: 'Zone d\'habitations collectives (R1)',
    label_de_short: 'Mehrfamilienhäuser',
    label_de_long: 'Zone für Mehrfamilienhäuser (R1)',
    label_en_short: 'Multi-family housing',
    label_en_long: 'Multi-family housing zone (R1)',
    category: 'residential'
  },
  {
    code: 'R2',
    label_fr_short: 'Hab. individuelles',
    label_fr_long: 'Zone d\'habitations individuelles (R2)',
    label_de_short: 'Einfamilienhäuser',
    label_de_long: 'Zone für Einfamilienhäuser (R2)',
    label_en_short: 'Single-family housing',
    label_en_long: 'Single-family housing zone (R2)',
    category: 'residential'
  },
  {
    code: 'R3',
    label_fr_short: 'Hab. faible densité',
    label_fr_long: 'Zone d\'habitations de faible densité (R3)',
    label_de_short: 'Geringe Dichte',
    label_de_long: 'Wohnzone mit geringer Dichte (R3)',
    label_en_short: 'Low density housing',
    label_en_long: 'Low density housing zone (R3)',
    category: 'residential'
  },
  {
    code: 'R4',
    label_fr_short: 'Hab. très faible densité',
    label_fr_long: 'Zone d\'habitations de très faible densité (R4)',
    label_de_short: 'Sehr geringe Dichte',
    label_de_long: 'Wohnzone mit sehr geringer Dichte (R4)',
    label_en_short: 'Very low density',
    label_en_long: 'Very low density housing zone (R4)',
    category: 'residential'
  },

  // Zones mixtes
  {
    code: 'M1',
    label_fr_short: 'Mixte centre',
    label_fr_long: 'Zone mixte centre-ville (M1)',
    label_de_short: 'Mischzone Zentrum',
    label_de_long: 'Mischzone Stadtzentrum (M1)',
    label_en_short: 'Mixed city center',
    label_en_long: 'Mixed use city center zone (M1)',
    category: 'mixed'
  },
  {
    code: 'M2',
    label_fr_short: 'Mixte périphérie',
    label_fr_long: 'Zone mixte périphérique (M2)',
    label_de_short: 'Mischzone Peripherie',
    label_de_long: 'Periphere Mischzone (M2)',
    label_en_short: 'Mixed peripheral',
    label_en_long: 'Mixed use peripheral zone (M2)',
    category: 'mixed'
  },
  {
    code: 'CV',
    label_fr_short: 'Centre-ville',
    label_fr_long: 'Zone centre-ville',
    label_de_short: 'Stadtzentrum',
    label_de_long: 'Stadtzentrumzone',
    label_en_short: 'City center',
    label_en_long: 'City center zone',
    category: 'mixed'
  },

  // Zones commerciales et artisanales
  {
    code: 'CA',
    label_fr_short: 'Commerce/artisanat',
    label_fr_long: 'Zone commerciale et artisanale (CA)',
    label_de_short: 'Gewerbe/Handwerk',
    label_de_long: 'Gewerbe- und Handwerkszone (CA)',
    label_en_short: 'Commercial/craft',
    label_en_long: 'Commercial and craft zone (CA)',
    category: 'commercial'
  },
  {
    code: 'I',
    label_fr_short: 'Industrielle',
    label_fr_long: 'Zone industrielle (I)',
    label_de_short: 'Industrie',
    label_de_long: 'Industriezone (I)',
    label_en_short: 'Industrial',
    label_en_long: 'Industrial zone (I)',
    category: 'industrial'
  },
  {
    code: 'A',
    label_fr_short: 'Artisanale',
    label_fr_long: 'Zone artisanale (A)',
    label_de_short: 'Handwerk',
    label_de_long: 'Handwerkszone (A)',
    label_en_short: 'Craft',
    label_en_long: 'Craft zone (A)',
    category: 'commercial'
  },

  // Zones spéciales
  {
    code: 'ZP',
    label_fr_short: 'Zone protégée',
    label_fr_long: 'Zone de protection du paysage',
    label_de_short: 'Schutzzone',
    label_de_long: 'Landschaftsschutzzone',
    label_en_short: 'Protected area',
    label_en_long: 'Landscape protection zone',
    category: 'protection'
  },
  {
    code: 'ZV',
    label_fr_short: 'Zone verte',
    label_fr_long: 'Zone verte et espaces libres',
    label_de_short: 'Grünzone',
    label_de_long: 'Grünzone und Freiflächen',
    label_en_short: 'Green zone',
    label_en_long: 'Green zone and open spaces',
    category: 'green'
  },
  {
    code: 'ZIG',
    label_fr_short: 'Intérêt général',
    label_fr_long: 'Zone d\'intérêt général',
    label_de_short: 'Öffentliches Interesse',
    label_de_long: 'Zone von öffentlichem Interesse',
    label_en_short: 'Public interest',
    label_en_long: 'Public interest zone',
    category: 'public'
  },
  {
    code: 'ZT',
    label_fr_short: 'Touristique',
    label_fr_long: 'Zone touristique',
    label_de_short: 'Tourismus',
    label_de_long: 'Tourismuszone',
    label_en_short: 'Tourism',
    label_en_long: 'Tourism zone',
    category: 'tourism'
  },

  // Zones agricoles
  {
    code: 'ZA',
    label_fr_short: 'Agricole',
    label_fr_long: 'Zone agricole',
    label_de_short: 'Landwirtschaft',
    label_de_long: 'Landwirtschaftszone',
    label_en_short: 'Agricultural',
    label_en_long: 'Agricultural zone',
    category: 'agricultural'
  },
  {
    code: 'ZAP',
    label_fr_short: 'Agricole protégée',
    label_fr_long: 'Zone agricole protégée',
    label_de_short: 'Geschützte Landwirtschaft',
    label_de_long: 'Geschützte Landwirtschaftszone',
    label_en_short: 'Protected agricultural',
    label_en_long: 'Protected agricultural zone',
    category: 'agricultural'
  },

  // Zones de hameau
  {
    code: 'H',
    label_fr_short: 'Hameau',
    label_fr_long: 'Zone de hameau',
    label_de_short: 'Weiler',
    label_de_long: 'Weilerzone',
    label_en_short: 'Hamlet',
    label_en_long: 'Hamlet zone',
    category: 'residential'
  },
  {
    code: 'HC',
    label_fr_short: 'Hameau conservé',
    label_fr_long: 'Zone de hameau à conserver',
    label_de_short: 'Erhaltenswerter Weiler',
    label_de_long: 'Zu erhaltende Weilerzone',
    label_en_short: 'Preserved hamlet',
    label_en_long: 'Preserved hamlet zone',
    category: 'residential'
  },

  // Zones à aménager
  {
    code: 'ZAM',
    label_fr_short: 'À aménager',
    label_fr_long: 'Zone à aménager',
    label_de_short: 'Zu entwickeln',
    label_de_long: 'Zu entwickelnde Zone',
    label_en_short: 'To be developed',
    label_en_long: 'Zone to be developed',
    category: 'future'
  },
  {
    code: 'ZR',
    label_fr_short: 'Réserve',
    label_fr_long: 'Zone de réserve',
    label_de_short: 'Reserve',
    label_de_long: 'Reservezone',
    label_en_short: 'Reserve',
    label_en_long: 'Reserve zone',
    category: 'future'
  }
];

async function importZoneLabels() {
  console.log(chalk.blue('\n📋 Import des labels de zones...\n'));

  try {
    const records = ZONE_LABELS.map(label => ({
      code: label.code,
      type: 'zone',
      label_fr_short: label.label_fr_short,
      label_fr_long: label.label_fr_long || null,
      label_de_short: label.label_de_short || null,
      label_de_long: label.label_de_long || null,
      label_en_short: label.label_en_short || null,
      label_en_long: label.label_en_long || null,
      severity: null, // Les zones n'ont pas de sévérité
      category: label.category || null,
      metadata: { source: 'manual_definition' }
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

    console.log(chalk.green(`✅ ${data?.length || 0} labels de zones importés avec succès`));

    // Afficher un résumé
    const summary = ZONE_LABELS.reduce((acc, label) => {
      const cat = label.category || 'autres';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(chalk.blue('\n📊 Résumé par catégorie:'));
    Object.entries(summary).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${chalk.yellow(count)} zones`);
    });

    // Vérifier la couverture des traductions
    const { data: coverage } = await supabase
      .from('v_translation_coverage')
      .select('*')
      .eq('type', 'zone')
      .single();

    if (coverage) {
      console.log(chalk.blue('\n🌐 Couverture des traductions:'));
      console.log(`   Allemand: ${chalk.yellow(coverage.de_coverage_pct)}%`);
      console.log(`   Anglais: ${chalk.yellow(coverage.en_coverage_pct)}%`);
    }

  } catch (error) {
    console.error(chalk.red('❌ Erreur lors de l\'import:'), error);
    process.exit(1);
  }
}

// Exécution
if (require.main === module) {
  importZoneLabels()
    .then(() => {
      console.log(chalk.green('\n✨ Import terminé avec succès!'));
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red('❌ Erreur fatale:'), error);
      process.exit(1);
    });
}