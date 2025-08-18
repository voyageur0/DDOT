/**
 * Rule Resolver - Moteur de règles hiérarchique
 * Résout les conflits entre différentes sources de règles selon leur priorité
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../db/types/supabase';

/**
 * Niveaux de priorité des règles
 */
export enum RuleLevel {
  LEVEL1 = 'LEVEL1', // Servitudes / PSQ (priorité maximale)
  LEVEL2 = 'LEVEL2', // Compléments d'aménagement communal
  LEVEL3 = 'LEVEL3', // RCCZ (Règlement communal)
  LEVEL4 = 'LEVEL4'  // Droit cantonal / fédéral (priorité minimale)
}

/**
 * Interface pour une règle consolidée
 */
export interface ConsolidatedRule<T = number | string | any> {
  field: string;
  value: T;
  level: RuleLevel;
  description?: string;
  overridden: Array<{
    level: string;
    value: T;
    description?: string;
  }>;
}

/**
 * Type pour les définitions de règles depuis la DB
 */
interface RuleDefinition {
  field: string;
  value_num: number | null;
  value_text: string | null;
  value_json: any | null;
  level: RuleLevel;
  description: string | null;
  overridden: any[];
}

/**
 * Type pour les zones avec règles
 */
interface ZoneWithRules {
  zone_id: string;
  zone_code: string;
  field: string;
  value_num: number | null;
  value_text: string | null;
  value_json: any | null;
  level: RuleLevel;
  description: string | null;
  overridden: any[];
}

/**
 * Service de résolution des règles
 */
export class RuleResolver {
  private supabase: SupabaseClient<Database>;

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
   * Résout les règles pour une zone donnée
   */
  async resolveRulesByZone(zoneId: string): Promise<ConsolidatedRule[]> {
    try {
      // Appeler la fonction SQL qui fait la résolution
      const { data, error } = await this.supabase
        .rpc('resolve_rules_by_zone', { p_zone_id: zoneId });

      if (error) {
        throw new Error(`Erreur résolution règles: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Convertir les résultats en ConsolidatedRule
      return (data as RuleDefinition[]).map(rule => this.mapToConsolidatedRule(rule));
    } catch (error: any) {
      console.error('Erreur dans resolveRulesByZone:', error);
      throw error;
    }
  }

  /**
   * Résout les règles pour une géométrie de parcelle (WKT)
   */
  async resolveRulesByParcelGeom(geomWKT: string): Promise<ConsolidatedRule[]> {
    try {
      // Valider le WKT basiquement
      if (!geomWKT || !geomWKT.includes('POLYGON')) {
        throw new Error('Géométrie WKT invalide');
      }

      // Appeler la fonction SQL qui fait la résolution spatiale
      const { data, error } = await this.supabase
        .rpc('resolve_rules_by_geom', { p_geom_wkt: geomWKT });

      if (error) {
        throw new Error(`Erreur résolution règles par géométrie: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Grouper par zone et consolider
      const rulesByZone = new Map<string, ConsolidatedRule[]>();
      
      for (const row of data as ZoneWithRules[]) {
        if (!rulesByZone.has(row.zone_id)) {
          rulesByZone.set(row.zone_id, []);
        }
        
        const rule = this.mapToConsolidatedRule({
          field: row.field,
          value_num: row.value_num,
          value_text: row.value_text,
          value_json: row.value_json,
          level: row.level,
          description: row.description,
          overridden: row.overridden
        });
        
        rulesByZone.get(row.zone_id)!.push(rule);
      }

      // Si plusieurs zones, prendre celle avec le plus de règles
      // ou implémenter une logique de fusion plus sophistiquée
      let bestZoneRules: ConsolidatedRule[] = [];
      let maxRuleCount = 0;

      for (const [, rules] of rulesByZone) {
        if (rules.length > maxRuleCount) {
          maxRuleCount = rules.length;
          bestZoneRules = rules;
        }
      }

      return bestZoneRules;
    } catch (error: any) {
      console.error('Erreur dans resolveRulesByParcelGeom:', error);
      throw error;
    }
  }

  /**
   * Récupère une règle spécifique pour un champ
   */
  async getRule(zoneId: string, field: string): Promise<ConsolidatedRule | null> {
    const rules = await this.resolveRulesByZone(zoneId);
    return rules.find(r => r.field === field) || null;
  }

  /**
   * Récupère la valeur numérique d'une règle
   */
  async getNumericRule(zoneId: string, field: string): Promise<number | null> {
    const rule = await this.getRule(zoneId, field);
    if (!rule) return null;
    
    // Essayer de convertir en nombre
    if (typeof rule.value === 'number') {
      return rule.value;
    }
    
    if (typeof rule.value === 'string') {
      const num = parseFloat(rule.value);
      return isNaN(num) ? null : num;
    }
    
    return null;
  }

  /**
   * Récupère toutes les règles d'un niveau spécifique
   */
  async getRulesByLevel(zoneId: string, level: RuleLevel): Promise<ConsolidatedRule[]> {
    const rules = await this.resolveRulesByZone(zoneId);
    return rules.filter(r => r.level === level);
  }

  /**
   * Mappe une définition de règle DB vers ConsolidatedRule
   */
  private mapToConsolidatedRule(rule: RuleDefinition): ConsolidatedRule {
    // Déterminer la valeur effective
    let value: any = null;
    if (rule.value_num !== null) {
      value = rule.value_num;
    } else if (rule.value_text !== null) {
      value = rule.value_text;
    } else if (rule.value_json !== null) {
      value = rule.value_json;
    }

    // Mapper les règles écrasées
    const overridden = (rule.overridden || []).map((o: any) => ({
      level: o.level,
      value: o.value_num ?? o.value_text ?? o.value_json,
      description: o.description
    }));

    return {
      field: rule.field,
      value,
      level: rule.level,
      description: rule.description || undefined,
      overridden
    };
  }

  /**
   * Insère une nouvelle règle
   */
  async insertRule(params: {
    zone_id: string;
    level: RuleLevel;
    field: string;
    value: number | string | any;
    description?: string;
    source_id?: string;
    validity_from?: Date;
    validity_to?: Date;
  }): Promise<void> {
    const insert: any = {
      zone_id: params.zone_id,
      level: params.level,
      field: params.field,
      description: params.description,
      source_id: params.source_id,
      validity_from: params.validity_from?.toISOString().split('T')[0],
      validity_to: params.validity_to?.toISOString().split('T')[0]
    };

    // Déterminer le type de valeur
    if (typeof params.value === 'number') {
      insert.value_num = params.value;
    } else if (typeof params.value === 'string') {
      insert.value_text = params.value;
    } else if (params.value !== null && params.value !== undefined) {
      insert.value_json = params.value;
    }

    const { error } = await this.supabase
      .from('rule_definitions')
      .insert(insert);

    if (error) {
      throw new Error(`Erreur insertion règle: ${error.message}`);
    }
  }

  /**
   * Insère plusieurs règles en batch
   */
  async insertRulesBatch(rules: Array<Parameters<typeof this.insertRule>[0]>): Promise<void> {
    const inserts = rules.map(params => {
      const insert: any = {
        zone_id: params.zone_id,
        level: params.level,
        field: params.field,
        description: params.description,
        source_id: params.source_id,
        validity_from: params.validity_from?.toISOString().split('T')[0],
        validity_to: params.validity_to?.toISOString().split('T')[0]
      };

      if (typeof params.value === 'number') {
        insert.value_num = params.value;
      } else if (typeof params.value === 'string') {
        insert.value_text = params.value;
      } else if (params.value !== null && params.value !== undefined) {
        insert.value_json = params.value;
      }

      return insert;
    });

    const { error } = await this.supabase
      .from('rule_definitions')
      .insert(inserts);

    if (error) {
      throw new Error(`Erreur insertion batch: ${error.message}`);
    }
  }

  /**
   * Met à jour la validité d'une règle
   */
  async updateRuleValidity(
    ruleId: string, 
    validityTo: Date
  ): Promise<void> {
    const { error } = await this.supabase
      .from('rule_definitions')
      .update({ validity_to: validityTo.toISOString().split('T')[0] })
      .eq('id', ruleId);

    if (error) {
      throw new Error(`Erreur mise à jour validité: ${error.message}`);
    }
  }
}

/**
 * Instance singleton par défaut
 */
export const ruleResolver = new RuleResolver();

/**
 * Helper pour extraire les valeurs de règles communes
 */
export class RuleHelper {
  /**
   * Extrait les règles de construction depuis un ensemble consolidé
   */
  static extractBuildingRules(rules: ConsolidatedRule[]): {
    h_max_m?: number;
    niveaux_max?: number;
    indice_u?: number;
    ibus?: number;
    emprise_max?: number;
    recul_min_m?: number;
    toit_types?: any;
    pente_toit_min_max?: any;
  } {
    const result: any = {};

    for (const rule of rules) {
      switch (rule.field) {
        case 'h_max_m':
        case 'niveaux_max':
        case 'indice_u':
        case 'ibus':
        case 'emprise_max':
        case 'recul_min_m':
          if (typeof rule.value === 'number') {
            result[rule.field] = rule.value;
          }
          break;
        case 'toit_types':
        case 'pente_toit_min_max':
          result[rule.field] = rule.value;
          break;
      }
    }

    return result;
  }

  /**
   * Vérifie si une règle a été écrasée
   */
  static hasOverrides(rule: ConsolidatedRule): boolean {
    return rule.overridden.length > 0;
  }

  /**
   * Obtient le niveau de priorité le plus élevé parmi les règles
   */
  static getHighestPriorityLevel(rules: ConsolidatedRule[]): RuleLevel | null {
    if (rules.length === 0) return null;

    const priority = {
      [RuleLevel.LEVEL1]: 1,
      [RuleLevel.LEVEL2]: 2,
      [RuleLevel.LEVEL3]: 3,
      [RuleLevel.LEVEL4]: 4
    };

    return rules.reduce((highest, rule) => {
      return priority[rule.level] < priority[highest] ? rule.level : highest;
    }, rules[0].level);
  }
}