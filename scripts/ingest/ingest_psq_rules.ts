/**
 * Script d'ingestion des règles PSQ / Servitudes (LEVEL1)
 * Plus haute priorité dans la hiérarchie
 */

import { createClient } from '@supabase/supabase-js';
import { RuleLevel, RuleResolver } from '../../src/engine/ruleResolver';
import { config } from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

config();

const ruleResolver = new RuleResolver();

// Client Supabase avec service role
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Structure des données PSQ
 */
interface PSQRule {
  zone_id: string;
  field: string;
  value: number | string | any;
  description: string;
  source_ref?: string;
  validity_from?: string;
  validity_to?: string;
}

/**
 * Données PSQ de test
 * En production, ces données viendraient d'un fichier CSV/JSON ou d'une API
 */
const PSQ_TEST_DATA: PSQRule[] = [
  {
    zone_id: '223e4567-e89b-12d3-a456-426614174000', // Riddes HAB_RES_20
    field: 'h_max_m',
    value: 10, // Servitude limite la hauteur à 10m (plus restrictif que RCCZ)
    description: 'Servitude de vue - Limitation hauteur pour préserver la vue sur les Alpes',
    source_ref: 'PSQ-2023-001'
  },
  {
    zone_id: '223e4567-e89b-12d3-a456-426614174000',
    field: 'recul_min_m',
    value: 8, // Plus restrictif que les 5m du RCCZ
    description: 'Servitude de passage - Recul obligatoire pour maintenir accès',
    source_ref: 'PSQ-2023-002'
  },
  {
    zone_id: '223e4567-e89b-12d3-a456-426614174001', // Riddes HAB_COLL_3
    field: 'emprise_max',
    value: 0.3, // Limite l'emprise à 30% (servitude environnementale)
    description: 'Protection zone humide - Limitation de l\'emprise au sol',
    source_ref: 'PSQ-2022-015'
  },
  {
    zone_id: '223e4567-e89b-12d3-a456-426614174002', // Sion CENTRE_1
    field: 'h_max_m',
    value: 22, // Monument historique à proximité
    description: 'Protection patrimoniale - Hauteur limitée près du monument',
    source_ref: 'PSQ-2021-008'
  },
  {
    zone_id: '223e4567-e89b-12d3-a456-426614174002',
    field: 'toit_types',
    value: [
      { type: 'pente', autorise: true, conditions: 'Tuiles traditionnelles uniquement' },
      { type: 'plate', autorise: false }
    ],
    description: 'Zone historique - Types de toiture réglementés',
    source_ref: 'PSQ-2021-009'
  }
];

/**
 * Charge les règles PSQ depuis un fichier
 */
async function loadPSQRulesFromFile(filePath: string): Promise<PSQRule[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    } else if (filePath.endsWith('.csv')) {
      // Parser CSV si nécessaire
      console.warn('Parser CSV non implémenté, utiliser JSON');
      return [];
    }
    
    return [];
  } catch (error) {
    console.warn(`Impossible de charger ${filePath}, utilisation des données de test`);
    return PSQ_TEST_DATA;
  }
}

/**
 * Crée ou récupère une source de règlement
 */
async function getOrCreateSource(sourceRef: string): Promise<string> {
  // Vérifier si la source existe
  const { data: existing } = await supabase
    .from('regulation_sources')
    .select('id')
    .eq('pdf_path', `psq/${sourceRef}`)
    .single();

  if (existing) {
    return existing.id;
  }

  // Créer la source
  const { data: newSource, error } = await supabase
    .from('regulation_sources')
    .insert({
      pdf_path: `psq/${sourceRef}`,
      article_ref: sourceRef,
      ocr_confidence: 1.0 // PSQ sont des données structurées
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Erreur création source: ${error.message}`);
  }

  return newSource.id;
}

/**
 * Fonction principale d'ingestion
 */
async function main() {
  console.log('🚀 Début de l\'ingestion des règles PSQ (LEVEL1)');

  try {
    // Charger les règles (depuis fichier ou données de test)
    const psqFilePath = path.join(process.cwd(), 'data', 'psq', 'rules.json');
    const rules = await loadPSQRulesFromFile(psqFilePath);
    
    console.log(`📋 ${rules.length} règles PSQ à traiter`);

    let successCount = 0;
    let errorCount = 0;

    // Traiter chaque règle
    for (const rule of rules) {
      try {
        // Créer/récupérer la source si référencée
        let sourceId: string | undefined;
        if (rule.source_ref) {
          sourceId = await getOrCreateSource(rule.source_ref);
        }

        // Insérer la règle
        await ruleResolver.insertRule({
          zone_id: rule.zone_id,
          level: RuleLevel.LEVEL1,
          field: rule.field,
          value: rule.value,
          description: rule.description,
          source_id: sourceId,
          validity_from: rule.validity_from ? new Date(rule.validity_from) : undefined,
          validity_to: rule.validity_to ? new Date(rule.validity_to) : undefined
        });

        successCount++;
        console.log(`✅ Règle PSQ insérée: ${rule.field} pour zone ${rule.zone_id}`);
      } catch (error: any) {
        errorCount++;
        // Ignorer les erreurs de duplication (idempotence)
        if (error.message?.includes('duplicate key')) {
          console.log(`⏭️  Règle déjà existante: ${rule.field} pour zone ${rule.zone_id}`);
        } else {
          console.error(`❌ Erreur insertion: ${error.message}`);
        }
      }
    }

    // Statistiques finales
    console.log('\n📊 Résumé de l\'ingestion PSQ:');
    console.log(`✅ Succès: ${successCount}`);
    console.log(`❌ Erreurs: ${errorCount}`);
    console.log(`⏭️  Ignorées: ${rules.length - successCount - errorCount}`);

    // Vérifier une règle pour validation
    if (rules.length > 0) {
      const testZoneId = rules[0].zone_id;
      const consolidated = await ruleResolver.resolveRulesByZone(testZoneId);
      console.log(`\n🔍 Exemple de règles consolidées pour zone ${testZoneId}:`);
      
      for (const rule of consolidated.filter(r => r.level === RuleLevel.LEVEL1)) {
        console.log(`- ${rule.field}: ${rule.value} (${rule.description})`);
        if (rule.overridden.length > 0) {
          console.log(`  Écrase: ${rule.overridden.map(o => `${o.level}=${o.value}`).join(', ')}`);
        }
      }
    }

  } catch (error: any) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  }
}

// Vérifier les variables d'environnement
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Variables d\'environnement manquantes:');
  console.error('- SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Lancer l'ingestion
main().catch(console.error);