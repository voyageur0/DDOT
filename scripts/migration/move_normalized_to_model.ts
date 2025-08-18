/**
 * Script de migration des données de regulations_normalized vers le nouveau modèle unifié
 * Idempotent : peut être exécuté plusieurs fois sans créer de doublons
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Charger les variables d'environnement
config();

// Types pour les données source
interface RegulationNormalized {
  id: number;
  commune_id: string;
  zone_code_source: string;
  zone_code_norm: string;
  indice_u: number | null;
  ibus: number | null;
  emprise_max: number | null;
  h_max_m: number | null;
  niveaux_max: number | null;
  toit_types: any | null;
  pente_toit_min_max: any | null;
  recul_min_m: number | null;
  remarques: string | null;
  source_pdf_path: string;
  source_page: number | null;
  migrated: boolean;
}

// Types pour le nouveau modèle
interface Commune {
  id: string;
  name: string;
  bfs_code: number | null;
}

interface Zone {
  id: string;
  commune_id: string;
  code_norm: string;
  label: string | null;
}

interface RegulationSource {
  id: string;
  pdf_path: string;
  pdf_page: number | null;
  article_ref: string | null;
  ocr_confidence: number | null;
}

interface Regulation {
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
  source_id: string;
  is_active: boolean;
}

// Initialiser le client Supabase avec service role key
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Logger avec timestamp
function log(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Cache pour éviter les requêtes répétées
const communeCache = new Map<string, string>();
const zoneCache = new Map<string, string>();
const sourceCache = new Map<string, string>();

/**
 * Récupère ou crée une commune
 */
async function upsertCommune(name: string): Promise<string> {
  // Vérifier le cache
  if (communeCache.has(name)) {
    return communeCache.get(name)!;
  }

  // Normaliser le nom
  const normalizedName = name.toLowerCase().trim();

  // Chercher la commune existante
  const { data: existing, error: selectError } = await supabase
    .from('communes')
    .select('id')
    .eq('name', normalizedName)
    .single();

  if (existing && !selectError) {
    communeCache.set(name, existing.id);
    return existing.id;
  }

  // Créer la commune si elle n'existe pas
  const { data: newCommune, error: insertError } = await supabase
    .from('communes')
    .insert({ name: normalizedName })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Erreur création commune ${name}: ${insertError.message}`);
  }

  communeCache.set(name, newCommune.id);
  return newCommune.id;
}

/**
 * Récupère ou crée une zone
 */
async function upsertZone(communeId: string, codeNorm: string, label?: string): Promise<string> {
  const cacheKey = `${communeId}:${codeNorm}`;
  
  // Vérifier le cache
  if (zoneCache.has(cacheKey)) {
    return zoneCache.get(cacheKey)!;
  }

  // Chercher la zone existante
  const { data: existing, error: selectError } = await supabase
    .from('zones')
    .select('id')
    .eq('commune_id', communeId)
    .eq('code_norm', codeNorm)
    .single();

  if (existing && !selectError) {
    zoneCache.set(cacheKey, existing.id);
    return existing.id;
  }

  // Créer la zone si elle n'existe pas
  const { data: newZone, error: insertError } = await supabase
    .from('zones')
    .insert({
      commune_id: communeId,
      code_norm: codeNorm,
      label: label || codeNorm
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Erreur création zone ${codeNorm}: ${insertError.message}`);
  }

  zoneCache.set(cacheKey, newZone.id);
  return newZone.id;
}

/**
 * Crée une source de règlement
 */
async function createRegulationSource(
  pdfPath: string,
  pdfPage: number | null
): Promise<string> {
  const cacheKey = `${pdfPath}:${pdfPage || 0}`;
  
  // Vérifier le cache
  if (sourceCache.has(cacheKey)) {
    return sourceCache.get(cacheKey)!;
  }

  // Créer la source
  const { data: newSource, error } = await supabase
    .from('regulation_sources')
    .insert({
      pdf_path: pdfPath,
      pdf_page: pdfPage
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Erreur création source: ${error.message}`);
  }

  sourceCache.set(cacheKey, newSource.id);
  return newSource.id;
}

/**
 * Désactive les anciennes versions d'une zone
 */
async function deactivateOldRegulations(zoneId: string, version: string): Promise<void> {
  const { error } = await supabase.rpc('deactivate_old_regulations', {
    p_zone_id: zoneId,
    p_version: version
  });

  if (error) {
    log(`Avertissement: Impossible de désactiver les anciennes versions pour zone ${zoneId}`, error);
  }
}

/**
 * Migre une ligne de regulations_normalized
 */
async function migrateRow(row: RegulationNormalized): Promise<void> {
  try {
    // 1. Créer/récupérer la commune
    const communeId = await upsertCommune(row.commune_id);

    // 2. Créer/récupérer la zone
    const zoneId = await upsertZone(
      communeId,
      row.zone_code_norm,
      `Zone ${row.zone_code_source}`
    );

    // 3. Créer la source
    const sourceId = await createRegulationSource(
      row.source_pdf_path,
      row.source_page
    );

    // 4. Créer le règlement avec la date du jour comme version
    const version = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { error: insertError } = await supabase
      .from('regulations')
      .insert({
        zone_id: zoneId,
        version: version,
        indice_u: row.indice_u,
        ibus: row.ibus,
        emprise_max: row.emprise_max,
        h_max_m: row.h_max_m,
        niveaux_max: row.niveaux_max,
        toit_types: row.toit_types,
        pente_toit_min_max: row.pente_toit_min_max,
        recul_min_m: row.recul_min_m,
        remarques: row.remarques,
        source_id: sourceId,
        is_active: true
      });

    if (insertError) {
      // Si contrainte d'unicité, c'est OK (idempotence)
      if (insertError.code === '23505') {
        log(`Zone ${row.zone_code_norm} déjà migrée pour ${row.commune_id}`);
      } else {
        throw insertError;
      }
    } else {
      // 5. Désactiver les anciennes versions
      await deactivateOldRegulations(zoneId, version);
    }

    // 6. Marquer comme migré
    const { error: updateError } = await supabase
      .from('regulations_normalized')
      .update({ migrated: true })
      .eq('id', row.id);

    if (updateError) {
      log(`Avertissement: Impossible de marquer ligne ${row.id} comme migrée`, updateError);
    }

  } catch (error: any) {
    log(`Erreur migration ligne ${row.id}`, error);
    throw error;
  }
}

/**
 * Fonction principale de migration
 */
async function main() {
  log('Début de la migration des données normalisées vers le modèle unifié');

  try {
    // Compter les lignes à migrer
    const { count: totalCount } = await supabase
      .from('regulations_normalized')
      .select('*', { count: 'exact', head: true })
      .eq('migrated', false);

    log(`Nombre de lignes à migrer: ${totalCount || 0}`);

    if (!totalCount || totalCount === 0) {
      log('Aucune ligne à migrer');
      return;
    }

    // Migrer par batch pour éviter les timeouts
    const batchSize = 100;
    let offset = 0;
    let migratedCount = 0;
    let errorCount = 0;

    while (offset < totalCount) {
      // Récupérer un batch
      const { data: batch, error: fetchError } = await supabase
        .from('regulations_normalized')
        .select('*')
        .eq('migrated', false)
        .range(offset, offset + batchSize - 1);

      if (fetchError) {
        throw new Error(`Erreur récupération batch: ${fetchError.message}`);
      }

      if (!batch || batch.length === 0) {
        break;
      }

      log(`Traitement du batch ${offset / batchSize + 1} (${batch.length} lignes)`);

      // Migrer chaque ligne du batch
      for (const row of batch) {
        try {
          await migrateRow(row);
          migratedCount++;
          
          if (migratedCount % 10 === 0) {
            log(`Progression: ${migratedCount}/${totalCount} lignes migrées`);
          }
        } catch (error) {
          errorCount++;
          log(`Erreur migration ligne ${row.id} (commune: ${row.commune_id}, zone: ${row.zone_code_norm})`, error);
          // Continuer avec la ligne suivante
        }
      }

      offset += batchSize;
    }

    // Rafraîchir la vue matérialisée
    log('Rafraîchissement de la vue matérialisée...');
    await supabase.rpc('refresh_materialized_view', {
      view_name: 'v_regulations_latest'
    }).catch(err => log('Avertissement: Impossible de rafraîchir la vue', err));

    // Statistiques finales
    const stats = await supabase.rpc('get_regulation_stats').single();
    
    log('Migration terminée!', {
      lignesMigrées: migratedCount,
      erreurs: errorCount,
      statistiques: stats.data
    });

  } catch (error: any) {
    log('Erreur fatale durant la migration', error);
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

// Lancer la migration
main().catch(console.error);