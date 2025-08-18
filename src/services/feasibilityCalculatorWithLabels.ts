/**
 * Calculateur de faisabilité avec labels normalisés
 * Version enrichie avec dictionnaire multilingue
 */

import { RuleResolver, ConsolidatedRule, RuleHelper } from '../engine/ruleResolver';
import { computeBuildIndicators, CalcOutput, CalcInput } from '../engine/buildCalculator';
import { getContextForParcel, ContextFlag } from '../engine/contextResolver';
import { summarizeContext } from '../engine/contextFormatterWithLabels';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../db/types/supabase';
import { getLabel, getLabels, Lang } from '../i18n/labelServiceLocal';
import { truncateSentence } from '../i18n/summarizer';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Re-export des types depuis feasibilityCalculator original
export { ProjectData, FeasibilityResult } from './feasibilityCalculator';
import { ProjectData, FeasibilityResult, FeasibilityCriterion, OverrideInfo } from './feasibilityCalculator';

/**
 * Service de calcul de faisabilité avec labels normalisés
 */
export class FeasibilityCalculatorWithLabels {
  private ruleResolver: RuleResolver;

  constructor() {
    this.ruleResolver = new RuleResolver();
  }

  /**
   * Génère un tableau de faisabilité avec labels normalisés
   */
  async generateFeasibilityTable(
    zoneId: string, 
    projectData?: ProjectData,
    parcelId?: string,
    lang: Lang = 'fr'
  ): Promise<FeasibilityResult> {
    try {
      // Résoudre les règles consolidées
      const consolidatedRules = await this.ruleResolver.resolveRulesByZone(zoneId);
      
      // Récupérer les informations de la parcelle
      let parcelInfo: { id: string; area_m2: number } | undefined;
      let calculations: CalcOutput | undefined;
      
      if (parcelId) {
        const parcel = await this.getParcelInfo(parcelId);
        if (parcel) {
          parcelInfo = {
            id: parcel.id,
            area_m2: parcel.area_m2
          };
          
          // Effectuer les calculs d'indices
          const calcInput: CalcInput = {
            parcelAreaM2: parcel.area_m2,
            rules: consolidatedRules
          };
          calculations = computeBuildIndicators(calcInput);
        }
      }

      // Préparer la liste des champs à récupérer
      const fieldsToLabel = this.extractFieldsFromRules(consolidatedRules);
      
      // Récupérer tous les labels en une seule requête
      const fieldLabels = await getLabels(
        fieldsToLabel.map(field => ({ code: field, type: 'field' })),
        lang,
        false
      );

      // Générer les critères de faisabilité avec labels normalisés
      const criteria = await this.generateCriteriaWithLabels(
        consolidatedRules,
        projectData,
        fieldLabels,
        calculations
      );

      // Récupérer les overrides avec labels
      const overrides = await this.extractOverridesWithLabels(
        consolidatedRules,
        fieldLabels
      );

      // Récupérer le contexte environnemental si parcelle fournie
      let contextNotes: string[] = [];
      let contextFlags: ContextFlag[] | undefined;
      
      if (parcelId && parcel) {
        const { data: parcelGeom } = await supabase
          .from('parcels')
          .select('geom')
          .eq('id', parcelId)
          .single();
          
        if (parcelGeom?.geom) {
          contextFlags = await getContextForParcel(parcelId, parcelGeom.geom as string);
          contextNotes = await summarizeContext(contextFlags, lang, 5);
        }
      }

      // Calculer le résumé
      const summary = this.calculateSummary(criteria);

      // Ajouter les labels de zone
      const zoneLabel = await this.getZoneLabel(zoneId, lang);

      return {
        criteria,
        summary,
        overrides: overrides.length > 0 ? overrides : undefined,
        calculations,
        parcel_info: parcelInfo,
        context_notes: contextNotes.length > 0 ? contextNotes : undefined,
        context_flags: contextFlags,
        // Nouveau : labels normalisés
        labels: {
          zone: zoneLabel,
          fields: fieldLabels
        }
      } as FeasibilityResult & { labels: any };

    } catch (error) {
      console.error('Erreur generateFeasibilityTable:', error);
      throw error;
    }
  }

  /**
   * Génère les critères avec labels normalisés
   */
  private async generateCriteriaWithLabels(
    rules: ConsolidatedRule[],
    projectData: ProjectData | undefined,
    fieldLabels: Record<string, string>,
    calculations?: CalcOutput
  ): Promise<FeasibilityCriterion[]> {
    const criteria: FeasibilityCriterion[] = [];

    // Règles principales
    const mainFields = [
      'h_max_m',
      'niveaux_max',
      'indice_u',
      'ibus',
      'emprise_max',
      'recul_min_m',
      'toit_types',
      'pente_toit_min_max'
    ];

    for (const field of mainFields) {
      const rule = rules.find(r => r.field === field);
      if (!rule) continue;

      // Utiliser le label normalisé
      const label = fieldLabels[field] || field;
      
      // Formater la valeur requise
      const requirement = this.formatRequirement(rule.value, field);
      
      // Obtenir la valeur du projet
      const projectValue = this.getProjectValue(field, projectData, calculations);
      
      // Vérifier la conformité
      const isCompliant = this.checkCompliance(field, rule.value, projectValue);
      
      // Construire les remarques
      const remarks = this.buildRemarks(field, rule, projectValue, isCompliant);

      criteria.push({
        field,
        label,
        requirement,
        project_value: projectValue,
        is_compliant: isCompliant,
        remarks: truncateSentence(remarks, 12),
        priority_level: rule.level
      });
    }

    // Ajouter les surfaces calculées si disponibles
    if (calculations) {
      // Surface utile
      if (calculations.suM2 !== null) {
        criteria.push({
          field: 'su_m2',
          label: fieldLabels['su_m2'] || 'Surface utile',
          requirement: `${calculations.suM2} m²`,
          project_value: calculations.suM2,
          is_compliant: true,
          remarks: 'Calculé automatiquement',
          priority_level: 'CALCULATED'
        });
      }

      // Surface brute
      if (calculations.ibusM2 !== null) {
        criteria.push({
          field: 'ibus_m2',
          label: fieldLabels['ibus_m2'] || 'Surface brute',
          requirement: `${calculations.ibusM2} m²`,
          project_value: calculations.ibusM2,
          is_compliant: true,
          remarks: calculations.details.conversion_applied ? 
            'Converti depuis indice U' : 
            'Calculé depuis IBUS',
          priority_level: 'CALCULATED'
        });
      }
    }

    return criteria;
  }

  /**
   * Extrait les overrides avec labels
   */
  private async extractOverridesWithLabels(
    rules: ConsolidatedRule[],
    fieldLabels: Record<string, string>
  ): Promise<OverrideInfo[]> {
    const overrides: OverrideInfo[] = [];

    for (const rule of rules) {
      if (RuleHelper.hasOverrides(rule)) {
        overrides.push({
          field: rule.field,
          applied_value: rule.value,
          applied_level: rule.level,
          overridden_values: rule.overridden.map(o => ({
            level: o.level,
            value: o.value,
            description: truncateSentence(o.description || '', 12)
          }))
        });
      }
    }

    return overrides;
  }

  /**
   * Récupère le label de la zone
   */
  private async getZoneLabel(zoneId: string, lang: Lang): Promise<string> {
    // Récupérer le code de zone depuis la DB
    const { data: zone } = await supabase
      .from('zones')
      .select('code_norm')
      .eq('id', zoneId)
      .single();

    if (!zone) return 'Zone inconnue';

    // Récupérer le label depuis le dictionnaire
    const label = await getLabel(zone.code_norm, 'zone', lang, true);
    return label !== zone.code_norm ? label : `Zone ${zone.code_norm}`;
  }

  /**
   * Extrait la liste des champs depuis les règles
   */
  private extractFieldsFromRules(rules: ConsolidatedRule[]): string[] {
    const fields = new Set<string>();
    
    // Champs des règles
    rules.forEach(rule => fields.add(rule.field));
    
    // Ajouter les champs calculés standards
    ['su_m2', 'ibus_m2', 'emprise_m2', 'niveaux_max_est'].forEach(f => fields.add(f));
    
    return Array.from(fields);
  }

  /**
   * Formate la valeur requise selon le type
   */
  private formatRequirement(value: any, field: string): string | number {
    if (value === null || value === undefined) return 'Non défini';

    // Formatage spécifique par champ
    switch (field) {
      case 'h_max_m':
      case 'recul_min_m':
        return `${value} m`;
      
      case 'indice_u':
      case 'ibus':
        return value.toString();
      
      case 'emprise_max':
        return `${(value * 100).toFixed(0)}%`;
      
      case 'niveaux_max':
        return value.toString();
      
      case 'toit_types':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return value.toString();
      
      default:
        return value.toString();
    }
  }

  /**
   * Récupère la valeur du projet
   */
  private getProjectValue(
    field: string, 
    projectData?: ProjectData,
    calculations?: CalcOutput
  ): string | number | undefined {
    if (!projectData) return undefined;

    switch (field) {
      case 'h_max_m':
        return projectData.hauteur;
      case 'niveaux_max':
        return projectData.niveaux;
      case 'indice_u':
        return calculations?.details.indice_u;
      case 'ibus':
        return calculations?.details.ibus || calculations?.details.ibus_calculated;
      case 'emprise_max':
        return projectData.emprise_sol ? projectData.emprise_sol / 100 : undefined;
      case 'recul_min_m':
        return projectData.distance_limite;
      case 'toit_types':
        return projectData.type_toiture;
      default:
        return undefined;
    }
  }

  /**
   * Vérifie la conformité d'une valeur
   */
  private checkCompliance(
    field: string,
    requirement: any,
    projectValue: any
  ): boolean | undefined {
    if (projectValue === undefined) return undefined;

    switch (field) {
      case 'h_max_m':
      case 'niveaux_max':
        return Number(projectValue) <= Number(requirement);
      
      case 'indice_u':
      case 'ibus':
      case 'emprise_max':
        return Number(projectValue) <= Number(requirement);
      
      case 'recul_min_m':
        return Number(projectValue) >= Number(requirement);
      
      case 'toit_types':
        if (Array.isArray(requirement)) {
          return requirement.includes(projectValue);
        }
        return true;
      
      default:
        return undefined;
    }
  }

  /**
   * Construit les remarques
   */
  private buildRemarks(
    field: string,
    rule: ConsolidatedRule,
    projectValue: any,
    isCompliant?: boolean
  ): string {
    if (projectValue === undefined) {
      return 'Valeur projet non fournie';
    }

    if (isCompliant === false) {
      switch (field) {
        case 'h_max_m':
          return `Dépasse de ${(Number(projectValue) - Number(rule.value)).toFixed(1)}m`;
        case 'niveaux_max':
          return `${Number(projectValue) - Number(rule.value)} niveau(x) de trop`;
        case 'recul_min_m':
          return `Manque ${(Number(rule.value) - Number(projectValue)).toFixed(1)}m`;
        default:
          return 'Non conforme';
      }
    }

    if (RuleHelper.hasOverrides(rule)) {
      return `Priorité ${rule.level}`;
    }

    return 'Conforme';
  }

  /**
   * Calcule le résumé
   */
  private calculateSummary(criteria: FeasibilityCriterion[]) {
    const issues = criteria.filter(c => c.is_compliant === false).length;
    const warnings = criteria.filter(c => c.is_compliant === undefined).length;
    const total = criteria.filter(c => c.is_compliant !== undefined).length;
    
    const conformityScore = total > 0 ? 
      ((total - issues) / total) * 100 : 
      100;

    return {
      conformity_score: Math.round(conformityScore),
      issues_count: issues,
      warnings_count: warnings
    };
  }

  /**
   * Récupère les informations de la parcelle
   */
  private async getParcelInfo(parcelId: string) {
    const { data, error } = await supabase
      .from('parcels')
      .select('id, area_m2')
      .eq('id', parcelId)
      .single();

    if (error) {
      console.error('Erreur récupération parcelle:', error);
      return null;
    }

    return data;
  }
}

// Export de l'instance singleton
export const feasibilityCalculatorWithLabels = new FeasibilityCalculatorWithLabels();