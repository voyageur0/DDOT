/**
 * Script d'ingestion des règles cantonales et fédérales (LEVEL4)
 * OPB, LAT, OFAC, règlements cantonaux du Valais
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
 * Structure des règles cantonales/fédérales
 */
interface CantonalRule {
  zone_type: string; // Type de zone (pattern matching)
  field: string;
  value: number | string | any;
  description: string;
  source: 'OPB' | 'LAT' | 'OFAC' | 'LC' | 'RCCZ_VS'; // Sources légales
  article: string;
  applicable_zones?: string[]; // Zones spécifiques ou patterns
}

/**
 * Règles cantonales et fédérales du Valais
 */
const CANTONAL_FEDERAL_RULES: CantonalRule[] = [
  // OPB - Ordonnance sur la protection contre le bruit
  {
    zone_type: 'HAB_*',
    field: 'niveau_bruit_max_db',
    value: 60, // 60 dB jour en zone d'habitation
    description: 'Valeur limite d\'immission pour le bruit (jour) en zone d\'habitation',
    source: 'OPB',
    article: 'Art. 43 OPB'
  },
  {
    zone_type: 'ZONE_MIXTE',
    field: 'niveau_bruit_max_db',
    value: 65, // 65 dB jour en zone mixte
    description: 'Valeur limite d\'immission pour le bruit (jour) en zone mixte',
    source: 'OPB',
    article: 'Art. 43 OPB'
  },
  
  // LAT - Loi sur l'aménagement du territoire
  {
    zone_type: 'ZONE_AGRICOLE',
    field: 'construction_autorisee',
    value: 'conforme_zone_agricole',
    description: 'Constructions conformes à la zone agricole uniquement',
    source: 'LAT',
    article: 'Art. 16a LAT'
  },
  
  // OFAC - Protection des sites construits
  {
    zone_type: 'CENTRE_*',
    field: 'demolition_reconstruction',
    value: 'autorisation_speciale',
    description: 'Démolition-reconstruction soumise à autorisation spéciale en zone centre',
    source: 'OFAC',
    article: 'Art. 4 OFAC'
  },
  
  // Loi cantonale sur les constructions (LC VS)
  {
    zone_type: '*',
    field: 'h_max_etage_m',
    value: 3.0, // Hauteur d'étage standard
    description: 'Hauteur maximale d\'étage standard selon LC',
    source: 'LC',
    article: 'Art. 68 LC'
  },
  {
    zone_type: '*',
    field: 'surface_min_logement_m2',
    value: 25, // Surface minimale d'un logement
    description: 'Surface minimale pour un logement',
    source: 'LC',
    article: 'Art. 71 LC'
  },
  
  // Règlement cantonal des constructions en zone à bâtir (RCCZ VS)
  {
    zone_type: 'HAB_IND_*',
    field: 'pente_terrain_max_pct',
    value: 35, // Pente max 35% pour construction
    description: 'Pente maximale du terrain pour construction individuelle',
    source: 'RCCZ_VS',
    article: 'Art. 24 RCCZ'
  },
  {
    zone_type: '*',
    field: 'distance_foret_min_m',
    value: 10, // Distance minimale à la forêt
    description: 'Distance minimale de construction par rapport à la lisière forestière',
    source: 'RCCZ_VS',
    article: 'Art. 36 RCCZ'
  },
  {
    zone_type: '*',
    field: 'distance_cours_eau_min_m',
    value: 15, // Distance minimale aux cours d'eau
    description: 'Distance minimale de construction par rapport aux cours d\'eau',
    source: 'RCCZ_VS',
    article: 'Art. 37 RCCZ'
  },
  
  // Normes énergétiques cantonales
  {
    zone_type: '*',
    field: 'norme_energetique',
    value: 'Minergie-P_ECO',
    description: 'Standard énergétique recommandé pour nouvelles constructions',
    source: 'LC',
    article: 'Art. 45a LC'
  },
  {
    zone_type: '*',
    field: 'part_energie_renouvelable_min_pct',
    value: 30, // 30% minimum d'énergie renouvelable
    description: 'Part minimale d\'énergie renouvelable pour le chauffage',
    source: 'LC',
    article: 'Art. 45b LC'
  }
];

/**
 * Trouve toutes les zones correspondant à un pattern
 */
async function findMatchingZones(pattern: string): Promise<string[]> {
  // Si pattern contient *, c'est un wildcard
  if (pattern.includes('*')) {
    const searchPattern = pattern.replace('*', '%');
    const { data, error } = await supabase
      .from('zones')
      .select('id')
      .ilike('code_norm', searchPattern);
    
    if (error) {
      console.error(`Erreur recherche zones: ${error.message}`);
      return [];
    }
    
    return (data || []).map(z => z.id);
  }
  
  // Sinon, recherche exacte
  const { data, error } = await supabase
    .from('zones')
    .select('id')
    .eq('code_norm', pattern);
  
  if (error) {
    console.error(`Erreur recherche zone: ${error.message}`);
    return [];
  }
  
  return (data || []).map(z => z.id);
}

/**
 * Crée une source pour les règles légales
 */
async function getOrCreateLegalSource(source: string, article: string): Promise<string> {
  const path = `legal/${source}/${article.replace(/\s+/g, '_')}`;
  
  const { data: existing } = await supabase
    .from('regulation_sources')
    .select('id')
    .eq('pdf_path', path)
    .single();

  if (existing) {
    return existing.id;
  }

  const { data: newSource, error } = await supabase
    .from('regulation_sources')
    .insert({
      pdf_path: path,
      article_ref: article,
      ocr_confidence: 1.0 // Sources légales officielles
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Erreur création source légale: ${error.message}`);
  }

  return newSource.id;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Début de l\'ingestion des règles cantonales/fédérales (LEVEL4)');

  try {
    let totalRules = 0;
    let successCount = 0;
    let errorCount = 0;

    // Grouper par source pour optimiser
    const rulesBySource = new Map<string, CantonalRule[]>();
    for (const rule of CANTONAL_FEDERAL_RULES) {
      const key = `${rule.source}_${rule.article}`;
      if (!rulesBySource.has(key)) {
        rulesBySource.set(key, []);
      }
      rulesBySource.get(key)!.push(rule);
    }

    // Traiter par source
    for (const [sourceKey, rules] of rulesBySource) {
      const [source, article] = sourceKey.split('_', 2);
      console.log(`\n📜 Traitement ${source} - ${article}`);
      
      // Créer la source
      const sourceId = await getOrCreateLegalSource(source, article);
      
      // Traiter chaque règle
      for (const rule of rules) {
        // Trouver toutes les zones concernées
        const zoneIds = rule.applicable_zones 
          ? await Promise.all(rule.applicable_zones.map(z => findMatchingZones(z))).then(r => r.flat())
          : await findMatchingZones(rule.zone_type);
        
        if (zoneIds.length === 0) {
          console.warn(`⚠️  Aucune zone trouvée pour pattern: ${rule.zone_type}`);
          continue;
        }
        
        console.log(`📍 Application à ${zoneIds.length} zones`);
        
        // Préparer le batch de règles
        const batch = zoneIds.map(zoneId => ({
          zone_id: zoneId,
          level: RuleLevel.LEVEL4,
          field: rule.field,
          value: rule.value,
          description: `${rule.description} (${rule.source} ${rule.article})`,
          source_id: sourceId
        }));
        
        try {
          await ruleResolver.insertRulesBatch(batch);
          totalRules += batch.length;
          successCount++;
          console.log(`✅ ${batch.length} règles insérées pour ${rule.field}`);
        } catch (error: any) {
          if (error.message?.includes('duplicate')) {
            console.log(`⏭️  Règles déjà existantes pour ${rule.field}`);
          } else {
            errorCount++;
            console.error(`❌ Erreur: ${error.message}`);
          }
        }
      }
    }

    // Résumé
    console.log('\n📊 Résumé de l\'ingestion cantonale/fédérale:');
    console.log(`✅ Types de règles traités: ${successCount}`);
    console.log(`📝 Total règles créées: ${totalRules}`);
    console.log(`❌ Erreurs: ${errorCount}`);

    // Exemple de validation
    const { data: sampleZone } = await supabase
      .from('zones')
      .select('id, code_norm')
      .limit(1)
      .single();
    
    if (sampleZone) {
      const consolidated = await ruleResolver.resolveRulesByZone(sampleZone.id);
      const level4Rules = consolidated.filter(r => r.level === RuleLevel.LEVEL4);
      
      console.log(`\n🔍 Exemple de règles LEVEL4 pour ${sampleZone.code_norm}:`);
      for (const rule of level4Rules.slice(0, 5)) {
        console.log(`- ${rule.field}: ${rule.value} (${rule.description})`);
      }
    }

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