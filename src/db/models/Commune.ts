/**
 * Modèle Commune
 * Représente une commune du Valais avec ses métadonnées
 */

import { Database } from '../types/supabase';

export type Commune = Database['public']['Tables']['communes']['Row'];
export type CommuneInsert = Database['public']['Tables']['communes']['Insert'];
export type CommuneUpdate = Database['public']['Tables']['communes']['Update'];

/**
 * Interface étendue avec méthodes utilitaires
 */
export interface CommuneModel extends Commune {
  // Méthodes utilitaires peuvent être ajoutées ici
}

/**
 * Helpers pour les communes
 */
export class CommuneHelper {
  /**
   * Normalise le nom d'une commune
   */
  static normalizeName(name: string): string {
    return name.toLowerCase().trim();
  }

  /**
   * Vérifie si un code BFS est valide pour le Valais
   */
  static isValidBfsCode(code: number): boolean {
    // Les codes BFS du Valais sont généralement entre 6000 et 6300
    return code >= 6000 && code <= 6300;
  }

  /**
   * Formatte le nom d'affichage
   */
  static getDisplayName(commune: Commune): string {
    return commune.name.charAt(0).toUpperCase() + commune.name.slice(1);
  }

  /**
   * Crée un objet d'insertion avec valeurs par défaut
   */
  static createInsert(name: string, bfsCode?: number): CommuneInsert {
    return {
      name: this.normalizeName(name),
      bfs_code: bfsCode && this.isValidBfsCode(bfsCode) ? bfsCode : null
    };
  }
}

/**
 * Communes connues du Valais
 */
export const KNOWN_COMMUNES = [
  { name: 'riddes', bfs_code: 6033 },
  { name: 'sion', bfs_code: 6266 },
  { name: 'martigny', bfs_code: 6136 },
  { name: 'monthey', bfs_code: 6153 },
  { name: 'sierre', bfs_code: 6248 },
  { name: 'brig-glis', bfs_code: 6002 },
  { name: 'visp', bfs_code: 6297 },
  { name: 'naters', bfs_code: 6213 },
  { name: 'collombey-muraz', bfs_code: 6152 },
  { name: 'bagnes', bfs_code: 6031 },
  { name: 'conthey', bfs_code: 6023 },
  { name: 'fully', bfs_code: 6017 },
  { name: 'saxon', bfs_code: 6021 },
  { name: 'saviese', bfs_code: 6265 },
  { name: 'ayent', bfs_code: 6256 },
  { name: 'crans-montana', bfs_code: 6242 },
  { name: 'lens', bfs_code: 6240 },
  { name: 'leuk', bfs_code: 6111 },
  { name: 'raron', bfs_code: 6198 },
  { name: 'zermatt', bfs_code: 6300 }
] as const;