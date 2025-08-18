/**
 * Service pour gérer les règlements d'urbanisme
 * Interface avec Supabase pour les opérations CRUD
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import { 
  Regulation, 
  RegulationInsert, 
  RegulationUpdate,
  RegulationLatest,
  RegulationHelper 
} from '../models/Regulation';
import { Zone, ZoneInsert, ZoneHelper } from '../models/Zone';
import { Commune, CommuneInsert, CommuneHelper } from '../models/Commune';

/**
 * Client Supabase typé
 */
type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Service principal pour les règlements
 */
export class RegulationService {
  private supabase: TypedSupabaseClient;

  constructor(url?: string, key?: string) {
    this.supabase = createClient<Database>(
      url || process.env.SUPABASE_URL!,
      key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  /**
   * Récupère la dernière version active d'un règlement par zone
   */
  async getLatestByZone(zoneId: string): Promise<RegulationLatest | null> {
    const { data, error } = await this.supabase
      .from('v_regulations_latest')
      .select('*')
      .eq('zone_id', zoneId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Pas de résultat
        return null;
      }
      throw new Error(`Erreur récupération règlement: ${error.message}`);
    }

    return data;
  }

  /**
   * Récupère tous les règlements actifs d'une commune
   */
  async getByCommune(communeId: string): Promise<RegulationLatest[]> {
    const { data, error } = await this.supabase
      .from('v_regulations_latest')
      .select('*')
      .eq('commune_id', communeId)
      .order('code_norm');

    if (error) {
      throw new Error(`Erreur récupération règlements commune: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Recherche un règlement par coordonnées géographiques
   */
  async getByCoordinates(lat: number, lng: number): Promise<RegulationLatest | null> {
    // Convertir les coordonnées WGS84 en CH1903+ LV95
    const { x, y } = this.wgs84ToCH1903Plus(lat, lng);

    const { data, error } = await this.supabase
      .rpc('get_regulation_at_point', {
        x_coord: x,
        y_coord: y
      })
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Erreur recherche par coordonnées: ${error.message}`);
    }

    return data;
  }

  /**
   * Récupère l'historique des versions d'une zone
   */
  async getHistory(zoneId: string): Promise<Regulation[]> {
    const { data, error } = await this.supabase
      .from('regulations')
      .select('*')
      .eq('zone_id', zoneId)
      .order('version', { ascending: false });

    if (error) {
      throw new Error(`Erreur récupération historique: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Crée ou met à jour un règlement (upsert)
   */
  async upsertRegulation(
    zoneId: string,
    regulation: Omit<RegulationInsert, 'zone_id'>
  ): Promise<Regulation> {
    // Désactiver les anciennes versions si nécessaire
    if (regulation.is_active !== false) {
      await this.deactivateOldVersions(zoneId, regulation.version || new Date().toISOString());
    }

    // Créer le règlement avec validation
    const insert = RegulationHelper.createInsert({
      zone_id: zoneId,
      ...regulation
    });

    const { data, error } = await this.supabase
      .from('regulations')
      .upsert(insert)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur création règlement: ${error.message}`);
    }

    // Rafraîchir la vue matérialisée
    await this.refreshMaterializedView();

    return data;
  }

  /**
   * Désactive les anciennes versions d'une zone
   */
  private async deactivateOldVersions(zoneId: string, newVersion: string): Promise<void> {
    const { error } = await this.supabase
      .rpc('deactivate_old_regulations', {
        p_zone_id: zoneId,
        p_version: newVersion
      });

    if (error) {
      console.warn(`Impossible de désactiver anciennes versions: ${error.message}`);
    }
  }

  /**
   * Rafraîchit la vue matérialisée
   */
  private async refreshMaterializedView(): Promise<void> {
    try {
      await this.supabase.rpc('refresh_materialized_view', {
        view_name: 'v_regulations_latest'
      });
    } catch (error) {
      console.warn('Impossible de rafraîchir la vue matérialisée');
    }
  }

  /**
   * Recherche des zones par code normalisé
   */
  async searchZonesByCode(codePattern: string): Promise<Zone[]> {
    const { data, error } = await this.supabase
      .from('zones')
      .select('*')
      .ilike('code_norm', `%${codePattern}%`)
      .limit(20);

    if (error) {
      throw new Error(`Erreur recherche zones: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Crée une nouvelle zone
   */
  async createZone(zone: ZoneInsert): Promise<Zone> {
    const { data, error } = await this.supabase
      .from('zones')
      .insert(zone)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur création zone: ${error.message}`);
    }

    return data;
  }

  /**
   * Met à jour la géométrie d'une zone
   */
  async updateZoneGeometry(zoneId: string, geom: any): Promise<void> {
    const { error } = await this.supabase
      .from('zones')
      .update({ geom })
      .eq('id', zoneId);

    if (error) {
      throw new Error(`Erreur mise à jour géométrie: ${error.message}`);
    }
  }

  /**
   * Récupère ou crée une commune
   */
  async upsertCommune(name: string, bfsCode?: number): Promise<Commune> {
    const insert = CommuneHelper.createInsert(name, bfsCode);

    const { data, error } = await this.supabase
      .from('communes')
      .upsert(insert, {
        onConflict: 'name',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur upsert commune: ${error.message}`);
    }

    return data;
  }

  /**
   * Récupère les statistiques globales
   */
  async getStats(): Promise<{
    total_communes: number;
    total_zones: number;
    total_regulations: number;
    active_regulations: number;
    zones_with_geom: number;
  }> {
    const { data, error } = await this.supabase
      .rpc('get_regulation_stats')
      .single();

    if (error) {
      throw new Error(`Erreur récupération stats: ${error.message}`);
    }

    return data;
  }

  /**
   * Convertit les coordonnées WGS84 en CH1903+ LV95
   */
  private wgs84ToCH1903Plus(lat: number, lng: number): { x: number; y: number } {
    // Formules de conversion approximatives
    // Pour une conversion précise, utiliser une bibliothèque dédiée
    const lat_aux = (lat * 3600 - 169028.66) / 10000;
    const lng_aux = (lng * 3600 - 26782.5) / 10000;
    
    const x = 2600072.37 +
      211455.93 * lng_aux -
      10938.51 * lng_aux * lat_aux -
      0.36 * lng_aux * lat_aux * lat_aux -
      44.54 * lng_aux * lng_aux * lng_aux;
      
    const y = 1200147.07 +
      308807.95 * lat_aux +
      3745.25 * lng_aux * lng_aux +
      76.63 * lat_aux * lat_aux -
      194.56 * lng_aux * lng_aux * lat_aux +
      119.79 * lat_aux * lat_aux * lat_aux;
    
    return { x: Math.round(x), y: Math.round(y) };
  }
}

/**
 * Instance singleton par défaut
 */
export const regulationService = new RegulationService();

/**
 * Export des types utiles
 */
export type { 
  Regulation, 
  RegulationInsert, 
  RegulationUpdate,
  RegulationLatest,
  Zone,
  Commune
};