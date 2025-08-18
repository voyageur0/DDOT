/**
 * Rule Resolver avec traçabilité des preuves
 * Version enrichie qui enregistre l'origine et la fiabilité de chaque règle retenue
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../db/types/supabase';

// Re-export des types depuis ruleResolver original
export { RuleLevel, ConsolidatedRule, RuleHelper } from './ruleResolver';
import { RuleLevel, ConsolidatedRule } from './ruleResolver';

type ReliabilityLevel = 'direct' | 'derived' | 'estimated' | 'missing';

/**
 * Service de résolution des règles avec traçabilité
 */
export class RuleResolverWithEvidence {
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
   * Résout les règles pour une zone et trace les preuves
   */
  async resolveRulesByZone(
    zoneId: string, 
    parcelId?: string
  ): Promise<ConsolidatedRule[]> {
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

      // Tracer les preuves si parcelId fourni
      if (parcelId) {
        await this.trackRuleEvidence(data, parcelId);
      }

      // Convertir les résultats
      return (data as any[]).map(rule => this.mapToConsolidatedRule(rule));
    } catch (error: any) {
      console.error('Erreur dans resolveRulesByZone:', error);
      throw error;
    }
  }

  /**
   * Résout les règles pour une géométrie et trace les preuves
   */
  async resolveRulesByParcelGeom(
    geomWKT: string,
    parcelId: string
  ): Promise<ConsolidatedRule[]> {
    try {
      if (!geomWKT || !geomWKT.includes('POLYGON')) {
        throw new Error('Géométrie WKT invalide');
      }

      const { data, error } = await this.supabase
        .rpc('resolve_rules_by_geom', { p_geom_wkt: geomWKT });

      if (error) {
        throw new Error(`Erreur résolution règles par géométrie: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Tracer les preuves
      await this.trackRuleEvidence(data, parcelId);

      // Grouper par zone et consolider
      const rulesByZone = new Map<string, ConsolidatedRule[]>();
      
      for (const row of data as any[]) {
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

      // Prendre la zone avec le plus de règles
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
   * Enregistre les preuves pour les règles résolues
   */
  private async trackRuleEvidence(
    rules: any[],
    parcelId: string
  ): Promise<void> {
    try {
      const evidenceItems = [];

      for (const rule of rules) {
        // Déterminer la fiabilité selon le niveau de la règle
        const reliability = this.getReliabilityFromLevel(rule.level);
        
        // Récupérer l'ID de regulation associé
        const regulationId = await this.getRegulationId(rule.source_id);

        // Déterminer la valeur effective
        let valueText = null;
        let valueNum = null;
        let valueJson = null;

        if (rule.value_num !== null) {
          valueNum = rule.value_num;
        } else if (rule.value_text !== null) {
          valueText = rule.value_text;
        } else if (rule.value_json !== null) {
          valueJson = rule.value_json;
        }

        // Construire le chemin source
        const sourcePath = this.buildSourcePath(rule);

        evidenceItems.push({
          ref_type: 'regulation',
          ref_id: regulationId,
          parcel_id: parcelId,
          field: rule.field,
          value_text: valueText,
          value_num: valueNum,
          value_json: valueJson,
          reliability: reliability,
          source_path: sourcePath,
          comment: rule.description || `${rule.level}: ${rule.field}`,
          inserted_by: 'ruleResolver'
        });

        // Tracer aussi les règles écrasées
        if (rule.overridden && rule.overridden.length > 0) {
          for (const overridden of rule.overridden) {
            evidenceItems.push({
              ref_type: 'regulation',
              ref_id: regulationId,
              parcel_id: parcelId,
              field: rule.field,
              value_text: overridden.value_text,
              value_num: overridden.value_num,
              value_json: overridden.value_json,
              reliability: 'derived', // Les règles écrasées sont "derived"
              source_path: `${overridden.level}/${rule.field}`,
              comment: `Écrasé par ${rule.level}`,
              metadata: { overridden_by: rule.level },
              inserted_by: 'ruleResolver'
            });
          }
        }
      }

      // Insérer les preuves en batch
      if (evidenceItems.length > 0) {
        const { error } = await this.supabase
          .from('evidence_items')
          .upsert(evidenceItems, {
            onConflict: 'ref_type,ref_id,field,parcel_id'
          });

        if (error) {
          console.error('Erreur insertion evidence:', error);
          // Ne pas faire échouer la résolution si l'evidence échoue
        }
      }
    } catch (error) {
      console.error('Erreur dans trackRuleEvidence:', error);
      // Ne pas propager l'erreur pour ne pas bloquer la résolution
    }
  }

  /**
   * Détermine la fiabilité selon le niveau de règle
   */
  private getReliabilityFromLevel(level: RuleLevel): ReliabilityLevel {
    switch (level) {
      case RuleLevel.LEVEL1: // Servitudes
      case RuleLevel.LEVEL2: // Compléments communaux
        return 'direct';
      case RuleLevel.LEVEL3: // RCCZ
        return 'direct';
      case RuleLevel.LEVEL4: // Droit cantonal/fédéral
        return 'derived';
      default:
        return 'estimated';
    }
  }

  /**
   * Construit le chemin source pour une règle
   */
  private buildSourcePath(rule: any): string {
    const parts = [rule.level];
    
    if (rule.zone_code) {
      parts.push(rule.zone_code);
    }
    
    parts.push(rule.field);

    if (rule.article_ref) {
      parts.push(rule.article_ref);
    }

    return parts.join('/');
  }

  /**
   * Récupère l'ID de regulation depuis source_id
   */
  private async getRegulationId(sourceId?: string): Promise<string | null> {
    if (!sourceId) return null;

    try {
      const { data } = await this.supabase
        .from('regulations')
        .select('id')
        .eq('id', sourceId)
        .single();

      return data?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Mappe une définition de règle DB vers ConsolidatedRule
   */
  private mapToConsolidatedRule(rule: any): ConsolidatedRule {
    let value: any = null;
    if (rule.value_num !== null) {
      value = rule.value_num;
    } else if (rule.value_text !== null) {
      value = rule.value_text;
    } else if (rule.value_json !== null) {
      value = rule.value_json;
    }

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
   * Récupère une règle spécifique avec traçabilité
   */
  async getRule(
    zoneId: string, 
    field: string,
    parcelId?: string
  ): Promise<ConsolidatedRule | null> {
    const rules = await this.resolveRulesByZone(zoneId, parcelId);
    return rules.find(r => r.field === field) || null;
  }

  /**
   * Récupère la valeur numérique d'une règle avec traçabilité
   */
  async getNumericRule(
    zoneId: string, 
    field: string,
    parcelId?: string
  ): Promise<number | null> {
    const rule = await this.getRule(zoneId, field, parcelId);
    if (!rule) return null;
    
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
   * Insère une règle et trace la source
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

    if (typeof params.value === 'number') {
      insert.value_num = params.value;
    } else if (typeof params.value === 'string') {
      insert.value_text = params.value;
    } else if (params.value !== null && params.value !== undefined) {
      insert.value_json = params.value;
    }

    const { data, error } = await this.supabase
      .from('rule_definitions')
      .insert(insert)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur insertion règle: ${error.message}`);
    }

    // Tracer l'insertion comme evidence
    if (data && params.source_id) {
      await this.supabase
        .from('evidence_items')
        .insert({
          ref_type: 'regulation',
          ref_id: params.source_id,
          field: params.field,
          value_text: typeof params.value === 'string' ? params.value : null,
          value_num: typeof params.value === 'number' ? params.value : null,
          value_json: typeof params.value === 'object' ? params.value : null,
          reliability: 'direct',
          source_path: `${params.level}/${params.field}`,
          comment: params.description || `Nouvelle règle ${params.field}`,
          inserted_by: 'ruleResolver:insertRule'
        });
    }
  }
}

/**
 * Instance singleton avec traçabilité
 */
export const ruleResolverWithEvidence = new RuleResolverWithEvidence();