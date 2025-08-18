/**
 * Script de migration des règlements RCCZ existants vers le moteur de règles (LEVEL3)
 * Convertit les données de la table regulations vers rule_definitions
 */

import { createClient } from '@supabase/supabase-js';
import { RuleLevel, RuleResolver } from '../../src/engine/ruleResolver';
import { config } from 'dotenv';

config();

const ruleResolver = new RuleResolver();

// Client Supabase avec service role
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Structure d'un règlement existant
 */
interface ExistingRegulation {
  id: string;
  zone_id: string;
  version: string;
  indice_u: number | null;
  ibus: number | null;
  emprise_max: number | null;
  h_max_m: number | null;
  niveaux_max: number | null;
  toit_types: any | null;
  pente_toit_min_max: any | null;
  recul_min_m: number | null;
  remarques: string | null;
  source_id: string | null;
  is_active: boolean;
}

/**
 * Mappage des champs regulations vers rule_definitions
 */
const FIELD_MAPPING: Record<string, { field: string; description: string }> = {
  indice_u: {
    field: 'indice_u',
    description: 'Indice d\'utilisation du sol (parties chauffées)'
  },
  ibus: {
    field: 'ibus',
    description: 'Indice brut d\'utilisation du sol (toutes surfaces)'
  },
  emprise_max: {
    field: 'emprise_max',
    description: 'Emprise au sol maximale'
  },
  h_max_m: {
    field: 'h_max_m',
    description: 'Hauteur maximale en mètres'
  },
  niveaux_max: {
    field: 'niveaux_max',
    description: 'Nombre maximum de niveaux'
  },
  toit_types: {
    field: 'toit_types',
    description: 'Types de toiture autorisés'
  },
  pente_toit_min_max: {
    field: 'pente_toit_min_max',
    description: 'Pente de toit minimale et maximale'
  },
  recul_min_m: {
    field: 'recul_min_m',
    description: 'Recul minimal à la limite en mètres'
  }
};

/**
 * Récupère les règlements actifs à migrer
 */
async function fetchActiveRegulations(): Promise<ExistingRegulation[]> {
  const { data, error } = await supabase
    .from('regulations')
    .select('*')
    .eq('is_active', true)
    .order('zone_id', { ascending: true });

  if (error) {
    throw new Error(`Erreur récupération règlements: ${error.message}`);
  }

  return data || [];
}

/**
 * Vérifie si une règle existe déjà
 */
async function ruleExists(
  zoneId: string, 
  field: string, 
  level: RuleLevel,
  validityFrom: string
): Promise<boolean> {
  const { data } = await supabase
    .from('rule_definitions')
    .select('id')
    .eq('zone_id', zoneId)
    .eq('field', field)
    .eq('level', level)
    .eq('validity_from', validityFrom)
    .single();

  return !!data;
}

/**
 * Migre un règlement vers plusieurs règles
 */
async function migrateRegulation(regulation: ExistingRegulation): Promise<number> {
  const rules = [];
  const validityFrom = new Date(regulation.version);

  // Parcourir tous les champs mappés
  for (const [sourceField, mapping] of Object.entries(FIELD_MAPPING)) {
    const value = regulation[sourceField as keyof ExistingRegulation];
    
    // Ignorer les valeurs nulles
    if (value === null || value === undefined) {
      continue;
    }

    // Vérifier si la règle existe déjà
    const exists = await ruleExists(
      regulation.zone_id,
      mapping.field,
      RuleLevel.LEVEL3,
      validityFrom.toISOString().split('T')[0]
    );

    if (exists) {
      console.log(`⏭️  Règle déjà migrée: ${mapping.field} pour zone ${regulation.zone_id}`);
      continue;
    }

    // Préparer la règle
    rules.push({
      zone_id: regulation.zone_id,
      level: RuleLevel.LEVEL3,
      field: mapping.field,
      value: value,
      description: mapping.description + (regulation.remarques ? ` - ${regulation.remarques}` : ''),
      source_id: regulation.source_id,
      validity_from: validityFrom
    });
  }

  // Insérer les règles en batch
  if (rules.length > 0) {
    try {
      await ruleResolver.insertRulesBatch(rules);
      console.log(`✅ ${rules.length} règles migrées pour zone ${regulation.zone_id}`);
      return rules.length;
    } catch (error: any) {
      console.error(`❌ Erreur migration zone ${regulation.zone_id}: ${error.message}`);
      return 0;
    }
  }

  return 0;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Début de la migration RCCZ vers moteur de règles (LEVEL3)');

  try {
    // Récupérer tous les règlements actifs
    const regulations = await fetchActiveRegulations();
    console.log(`📋 ${regulations.length} règlements RCCZ à migrer`);

    let totalRules = 0;
    let successCount = 0;
    let errorCount = 0;

    // Traiter chaque règlement
    for (const regulation of regulations) {
      const rulesCreated = await migrateRegulation(regulation);
      if (rulesCreated > 0) {
        totalRules += rulesCreated;
        successCount++;
      } else {
        errorCount++;
      }
    }

    // Résumé
    console.log('\n📊 Résumé de la migration RCCZ:');
    console.log(`✅ Règlements migrés: ${successCount}`);
    console.log(`📝 Total règles créées: ${totalRules}`);
    console.log(`❌ Erreurs: ${errorCount}`);

    // Validation avec exemple
    if (regulations.length > 0) {
      const testZoneId = regulations[0].zone_id;
      const consolidated = await ruleResolver.resolveRulesByZone(testZoneId);
      const level3Rules = consolidated.filter(r => r.level === RuleLevel.LEVEL3);
      
      console.log(`\n🔍 Exemple de règles RCCZ migrées pour zone ${testZoneId}:`);
      for (const rule of level3Rules.slice(0, 5)) {
        console.log(`- ${rule.field}: ${rule.value}`);
        if (rule.overridden.length > 0) {
          console.log(`  ⚠️  Écrasée par: ${rule.overridden.map(o => o.level).join(', ')}`);
        }
      }
    }

    // Optionnel: marquer les règlements comme migrés
    // Cela nécessiterait d'ajouter une colonne 'migrated_to_rules' dans regulations

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