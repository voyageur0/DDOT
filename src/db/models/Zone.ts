/**
 * Modèle Zone
 * Représente une zone d'affectation avec sa géométrie
 */

import { Database } from '../types/supabase';

export type Zone = Database['public']['Tables']['zones']['Row'];
export type ZoneInsert = Database['public']['Tables']['zones']['Insert'];
export type ZoneUpdate = Database['public']['Tables']['zones']['Update'];

/**
 * Types de zones normalisées
 */
export enum ZoneType {
  // Habitation collective
  HAB_COLL_1 = 'HAB_COLL_1',
  HAB_COLL_2 = 'HAB_COLL_2',
  HAB_COLL_3 = 'HAB_COLL_3',
  HAB_COLL_4 = 'HAB_COLL_4',
  HAB_COLL_5 = 'HAB_COLL_5',
  
  // Habitation résidentielle
  HAB_RES_10 = 'HAB_RES_10',
  HAB_RES_15 = 'HAB_RES_15',
  HAB_RES_20 = 'HAB_RES_20',
  HAB_RES_30 = 'HAB_RES_30',
  HAB_RES_40 = 'HAB_RES_40',
  HAB_RES_50 = 'HAB_RES_50',
  HAB_RES_60 = 'HAB_RES_60',
  
  // Habitation individuelle
  HAB_IND_10 = 'HAB_IND_10',
  HAB_IND_15 = 'HAB_IND_15',
  HAB_IND_20 = 'HAB_IND_20',
  HAB_IND_30 = 'HAB_IND_30',
  
  // Tours
  TOUR_0_3 = 'TOUR_0_3',
  TOUR_0_4 = 'TOUR_0_4',
  TOUR_0_5 = 'TOUR_0_5',
  TOUR_0_6 = 'TOUR_0_6',
  TOUR_1 = 'TOUR_1',
  
  // Centre
  CENTRE_1 = 'CENTRE_1',
  CENTRE_2 = 'CENTRE_2',
  CENTRE_3 = 'CENTRE_3',
  
  // Zones spéciales
  ZONE_VILLAGE = 'ZONE_VILLAGE',
  ZONE_ARTISANALE = 'ZONE_ARTISANALE',
  ZONE_INDUSTRIELLE = 'ZONE_INDUSTRIELLE',
  ZONE_COMMERCIALE = 'ZONE_COMMERCIALE',
  ZONE_MIXTE = 'ZONE_MIXTE',
  ZONE_TOURISTIQUE = 'ZONE_TOURISTIQUE',
  ZONE_PUBLIQUE = 'ZONE_PUBLIQUE',
  ZONE_SPORT = 'ZONE_SPORT',
  ZONE_VERTE = 'ZONE_VERTE',
  ZONE_AGRICOLE = 'ZONE_AGRICOLE',
  ZONE_FORET = 'ZONE_FORET',
  ZONE_PROTECTION = 'ZONE_PROTECTION',
  ZONE_DANGER = 'ZONE_DANGER',
  
  // Custom
  CUSTOM = 'CUSTOM'
}

/**
 * Interface pour les géométries GeoJSON
 */
export interface GeoJsonGeometry {
  type: 'MultiPolygon' | 'Polygon';
  coordinates: number[][][] | number[][][][];
}

/**
 * Interface étendue avec géométrie typée
 */
export interface ZoneWithGeometry extends Zone {
  geom: GeoJsonGeometry | null;
}

/**
 * Helpers pour les zones
 */
export class ZoneHelper {
  /**
   * Vérifie si un code de zone est valide
   */
  static isValidZoneCode(code: string): boolean {
    return Object.values(ZoneType).includes(code as ZoneType);
  }

  /**
   * Extrait le type de base d'un code de zone
   */
  static getBaseType(code: string): string {
    if (code.startsWith('HAB_COLL')) return 'Habitation collective';
    if (code.startsWith('HAB_RES')) return 'Habitation résidentielle';
    if (code.startsWith('HAB_IND')) return 'Habitation individuelle';
    if (code.startsWith('TOUR')) return 'Tour';
    if (code.startsWith('CENTRE')) return 'Centre';
    if (code.startsWith('ZONE_')) {
      const type = code.replace('ZONE_', '').toLowerCase();
      return type.charAt(0).toUpperCase() + type.slice(1);
    }
    return 'Zone spéciale';
  }

  /**
   * Extrait la densité d'un code de zone
   */
  static getDensity(code: string): number | null {
    const match = code.match(/_(\d+(?:_\d+)?)$/);
    if (match) {
      const density = match[1].replace('_', '.');
      return parseFloat(density);
    }
    return null;
  }

  /**
   * Génère un label descriptif
   */
  static generateLabel(code: string): string {
    const baseType = this.getBaseType(code);
    const density = this.getDensity(code);
    
    if (density !== null) {
      return `${baseType} - Densité ${density}`;
    }
    
    return baseType;
  }

  /**
   * Crée un objet d'insertion
   */
  static createInsert(
    communeId: string,
    codeNorm: string,
    label?: string,
    geom?: GeoJsonGeometry
  ): ZoneInsert {
    return {
      commune_id: communeId,
      code_norm: codeNorm,
      label: label || this.generateLabel(codeNorm),
      geom: geom as any // Supabase accepte le GeoJSON directement
    };
  }

  /**
   * Calcule la surface d'une zone (approximation)
   */
  static calculateArea(geom: GeoJsonGeometry): number {
    // Cette fonction nécessiterait une vraie implémentation
    // avec des calculs géodésiques pour être précise
    // Ici on retourne 0 comme placeholder
    return 0;
  }
}