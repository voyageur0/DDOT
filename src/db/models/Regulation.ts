/**
 * Modèle Regulation
 * Représente les règlements d'urbanisme versionnés par zone
 */

import { Database } from '../types/supabase';

export type Regulation = Database['public']['Tables']['regulations']['Row'];
export type RegulationInsert = Database['public']['Tables']['regulations']['Insert'];
export type RegulationUpdate = Database['public']['Tables']['regulations']['Update'];
export type RegulationSource = Database['public']['Tables']['regulation_sources']['Row'];
export type RegulationLatest = Database['public']['Views']['v_regulations_latest']['Row'];

/**
 * Types de toiture
 */
export interface ToitType {
  type: 'plate' | 'pente' | 'shed' | 'papillon' | 'autre';
  autorise: boolean;
  conditions?: string;
}

/**
 * Pente de toit min/max
 */
export interface PenteToitRange {
  min: number; // en degrés
  max: number; // en degrés
}

/**
 * Interface étendue avec types spécifiques
 */
export interface RegulationWithTypes extends Regulation {
  toit_types: ToitType[] | null;
  pente_toit_min_max: PenteToitRange | null;
}

/**
 * Helpers pour les règlements
 */
export class RegulationHelper {
  /**
   * Vérifie si une valeur d'indice est valide
   */
  static isValidIndice(value: number): boolean {
    return value >= 0 && value <= 10;
  }

  /**
   * Vérifie si une valeur d'emprise est valide (ratio 0-1)
   */
  static isValidEmprise(value: number): boolean {
    return value >= 0 && value <= 1;
  }

  /**
   * Convertit un pourcentage en ratio
   */
  static percentToRatio(percent: number): number {
    return percent / 100;
  }

  /**
   * Convertit un ratio en pourcentage
   */
  static ratioToPercent(ratio: number): number {
    return Math.round(ratio * 100);
  }

  /**
   * Parse les types de toiture depuis une string
   */
  static parseToitTypes(input: string): ToitType[] {
    const types: ToitType[] = [];
    const normalized = input.toLowerCase();
    
    if (normalized.includes('plate')) {
      types.push({ type: 'plate', autorise: true });
    }
    if (normalized.includes('pente') || normalized.includes('inclinée')) {
      types.push({ type: 'pente', autorise: true });
    }
    if (normalized.includes('shed') || normalized.includes('monopente')) {
      types.push({ type: 'shed', autorise: true });
    }
    if (normalized.includes('papillon')) {
      types.push({ type: 'papillon', autorise: true });
    }
    
    return types;
  }

  /**
   * Parse une plage de pente
   */
  static parsePenteRange(min: number, max?: number): PenteToitRange {
    return {
      min: Math.max(0, min),
      max: max !== undefined ? Math.min(90, max) : 90
    };
  }

  /**
   * Crée un objet d'insertion avec validation
   */
  static createInsert(data: {
    zone_id: string;
    version?: string;
    indice_u?: number;
    ibus?: number;
    emprise_max?: number;
    h_max_m?: number;
    niveaux_max?: number;
    toit_types?: ToitType[];
    pente_toit_min_max?: PenteToitRange;
    recul_min_m?: number;
    remarques?: string;
    source_id?: string;
  }): RegulationInsert {
    const insert: RegulationInsert = {
      zone_id: data.zone_id,
      version: data.version || new Date().toISOString().split('T')[0],
      is_active: true
    };

    // Valider et ajouter les indices
    if (data.indice_u !== undefined && this.isValidIndice(data.indice_u)) {
      insert.indice_u = data.indice_u;
    }
    if (data.ibus !== undefined && this.isValidIndice(data.ibus)) {
      insert.ibus = data.ibus;
    }
    if (data.emprise_max !== undefined && this.isValidEmprise(data.emprise_max)) {
      insert.emprise_max = data.emprise_max;
    }

    // Ajouter les autres champs
    if (data.h_max_m !== undefined && data.h_max_m > 0) {
      insert.h_max_m = data.h_max_m;
    }
    if (data.niveaux_max !== undefined && data.niveaux_max > 0) {
      insert.niveaux_max = data.niveaux_max;
    }
    if (data.recul_min_m !== undefined && data.recul_min_m >= 0) {
      insert.recul_min_m = data.recul_min_m;
    }

    // JSON fields
    if (data.toit_types) {
      insert.toit_types = data.toit_types as any;
    }
    if (data.pente_toit_min_max) {
      insert.pente_toit_min_max = data.pente_toit_min_max as any;
    }

    // Texte et référence
    if (data.remarques) {
      insert.remarques = data.remarques;
    }
    if (data.source_id) {
      insert.source_id = data.source_id;
    }

    return insert;
  }

  /**
   * Compare deux versions pour déterminer la plus récente
   */
  static compareVersions(v1: string, v2: string): number {
    const date1 = new Date(v1);
    const date2 = new Date(v2);
    return date1.getTime() - date2.getTime();
  }

  /**
   * Formatte une version pour l'affichage
   */
  static formatVersion(version: string): string {
    const date = new Date(version);
    return date.toLocaleDateString('fr-CH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Calcule un score de complétude
   */
  static calculateCompleteness(regulation: Regulation): number {
    const fields = [
      'indice_u',
      'ibus',
      'emprise_max',
      'h_max_m',
      'niveaux_max',
      'toit_types',
      'recul_min_m'
    ];
    
    const filledFields = fields.filter(field => 
      regulation[field as keyof Regulation] !== null
    ).length;
    
    return Math.round((filledFields / fields.length) * 100);
  }
}