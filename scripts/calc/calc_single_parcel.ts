#!/usr/bin/env ts-node

/**
 * Script CLI pour calculer les indicateurs de constructibilité d'une parcelle
 * Usage: npm run calc:parcel -- <parcel_id> [--area <m2>] [--zone <zone_id>]
 */

import { createClient } from '@supabase/supabase-js';
import { RuleResolver } from '../../src/engine/ruleResolver';
import { computeBuildIndicators, CalcInput } from '../../src/engine/buildCalculator';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CliOptions {
  parcelId: string;
  area?: number;
  zoneId?: string;
  format?: 'json' | 'table';
  save?: boolean;
}

/**
 * Parse les arguments de la ligne de commande
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: npm run calc:parcel -- <parcel_id> [options]

Options:
  --area <m2>      Surface de la parcelle en m² (si non trouvée en DB)
  --zone <id>      ID de la zone (si non trouvée automatiquement)
  --format <type>  Format de sortie: json (défaut) ou table
  --save           Sauvegarder dans le cache
  --help           Afficher cette aide

Exemples:
  npm run calc:parcel -- 10135
  npm run calc:parcel -- 10135 --area 1500 --format table
  npm run calc:parcel -- CUSTOM_ID --zone "223e4567-e89b-12d3-a456-426614174000" --area 2000
    `);
    process.exit(0);
  }

  const options: CliOptions = {
    parcelId: args[0],
    format: 'json'
  };

  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--area':
        options.area = parseFloat(value);
        break;
      case '--zone':
        options.zoneId = value;
        break;
      case '--format':
        options.format = value as 'json' | 'table';
        break;
      case '--save':
        options.save = true;
        i--; // Pas de valeur pour ce flag
        break;
    }
  }

  return options;
}

/**
 * Récupère les informations de la parcelle
 */
async function getParcelInfo(parcelId: string): Promise<{
  area_m2?: number;
  zone_id?: string;
  commune?: string;
} | null> {
  try {
    // Essayer la table parcels
    const { data, error } = await supabase
      .from('parcels')
      .select('area_m2, zone_id, commune')
      .eq('id', parcelId)
      .single();

    if (!error && data) {
      return data;
    }

    // Parcelle non trouvée
    return null;
  } catch (error) {
    console.error('Erreur récupération parcelle:', error);
    return null;
  }
}

/**
 * Formate la sortie en tableau
 */
function formatAsTable(result: any): string {
  const { calculations, parcel_info, zone_info } = result;
  
  let output = '\n╔═══════════════════════════════════════════════════════╗\n';
  output += '║           CALCUL DES INDICATEURS DE CONSTRUCTIBILITÉ   ║\n';
  output += '╚═══════════════════════════════════════════════════════╝\n\n';

  // Informations parcelle
  output += '📍 PARCELLE\n';
  output += `   ID: ${parcel_info.id}\n`;
  output += `   Surface: ${parcel_info.area_m2} m²\n`;
  if (zone_info) {
    output += `   Zone: ${zone_info.code_norm} - ${zone_info.nom_zone}\n`;
  }
  output += '\n';

  // Résultats des calculs
  output += '📊 INDICATEURS CALCULÉS\n';
  output += `   Surface utile (SU):        ${calculations.suM2 ?? 'N/A'} m²\n`;
  output += `   Surface brute (IBUS):      ${calculations.ibusM2 ?? 'N/A'} m²\n`;
  output += `   Emprise au sol max:        ${calculations.empriseM2 ?? 'N/A'} m²\n`;
  output += `   Niveaux estimés:           ${calculations.niveauxMaxEst ?? 'N/A'}\n`;
  output += `   Score de fiabilité:        ${(calculations.reliability * 100).toFixed(0)}%\n`;
  output += '\n';

  // Détails
  if (calculations.details) {
    output += '🔍 DÉTAILS\n';
    if (calculations.details.indice_u !== undefined) {
      output += `   Indice U:                  ${calculations.details.indice_u}\n`;
    }
    if (calculations.details.ibus !== undefined) {
      output += `   IBUS:                      ${calculations.details.ibus}\n`;
    }
    if (calculations.details.conversion_applied) {
      output += `   ⚠️  IBUS calculé depuis indice U (table de conversion)\n`;
    }
    if (calculations.details.missing_values.length > 0) {
      output += `   Valeurs manquantes:        ${calculations.details.missing_values.join(', ')}\n`;
    }
    output += '\n';
  }

  // Contrôles
  if (calculations.controls && calculations.controls.length > 0) {
    output += '⚡ CONTRÔLES\n';
    for (const control of calculations.controls) {
      const icon = control.level === 'error' ? '❌' : 
                   control.level === 'warning' ? '⚠️' : 'ℹ️';
      output += `   ${icon} ${control.message}\n`;
    }
    output += '\n';
  }

  // Formules appliquées
  if (calculations.details?.formulas) {
    output += '📐 FORMULES APPLIQUÉES\n';
    const formulas = calculations.details.formulas;
    if (formulas.su) output += `   SU:      ${formulas.su}\n`;
    if (formulas.ibus) output += `   IBUS:    ${formulas.ibus}\n`;
    if (formulas.emprise) output += `   Emprise: ${formulas.emprise}\n`;
    if (formulas.niveaux) output += `   Niveaux: ${formulas.niveaux}\n`;
  }

  return output;
}

/**
 * Fonction principale
 */
async function main() {
  const options = parseArgs();
  const ruleResolver = new RuleResolver();

  try {
    console.log(`🔍 Recherche de la parcelle ${options.parcelId}...`);

    // 1. Récupérer les infos de la parcelle
    let area = options.area;
    let zoneId = options.zoneId;
    let parcelInfo = null;

    if (!area || !zoneId) {
      parcelInfo = await getParcelInfo(options.parcelId);
      if (parcelInfo) {
        area = area || parcelInfo.area_m2;
        zoneId = zoneId || parcelInfo.zone_id;
      }
    }

    if (!area) {
      console.error('❌ Surface de la parcelle non trouvée. Utilisez --area <m2>');
      process.exit(1);
    }

    if (!zoneId) {
      console.error('❌ Zone de la parcelle non trouvée. Utilisez --zone <id>');
      process.exit(1);
    }

    // 2. Récupérer les règles consolidées
    console.log(`📋 Récupération des règles pour la zone ${zoneId}...`);
    const consolidatedRules = await ruleResolver.resolveRulesByZone(zoneId);

    if (consolidatedRules.length === 0) {
      console.error('❌ Aucune règle trouvée pour cette zone');
      process.exit(1);
    }

    // 3. Effectuer les calculs
    console.log(`🧮 Calcul des indicateurs...`);
    const calcInput: CalcInput = {
      parcelAreaM2: area,
      rules: consolidatedRules
    };

    const calculations = computeBuildIndicators(calcInput);

    // 4. Récupérer info zone pour affichage
    const { data: zoneInfo } = await supabase
      .from('zones')
      .select('code_norm, nom_zone')
      .eq('id', zoneId)
      .single();

    // 5. Préparer le résultat
    const result = {
      parcel_info: {
        id: options.parcelId,
        area_m2: area
      },
      zone_info: zoneInfo,
      calculations,
      timestamp: new Date().toISOString()
    };

    // 6. Sauvegarder si demandé
    if (options.save) {
      console.log('💾 Sauvegarde dans le cache...');
      const { error } = await supabase
        .from('feasibility_cache')
        .upsert({
          parcel_id: options.parcelId,
          zone_id: zoneId,
          calc_date: new Date().toISOString().split('T')[0],
          su_m2: calculations.suM2,
          ibus_m2: calculations.ibusM2,
          emprise_m2: calculations.empriseM2,
          niveaux_max_est: calculations.niveauxMaxEst,
          reliability: calculations.reliability,
          controls: calculations.controls,
          consolidated_rules: consolidatedRules
        });

      if (error) {
        console.warn('⚠️ Erreur sauvegarde:', error.message);
      } else {
        console.log('✅ Sauvegardé dans le cache');
      }
    }

    // 7. Afficher le résultat
    if (options.format === 'table') {
      console.log(formatAsTable(result));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
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