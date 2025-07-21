/**
 * Module pour filtrer et prioriser les contraintes en fonction de leur pertinence
 */

import { O3Constraint } from './o3AnalysisEngine';
import { RegulationConstraint } from './regulationExtractor';
import { RdppfData } from './rdppfEnhancedExtractor';

export interface FilteredConstraints {
  critical: O3Constraint[];
  zoneSpecific: O3Constraint[];
  general: O3Constraint[];
  informational: O3Constraint[];
  excluded: string[]; // Raisons d'exclusion
}

/**
 * Filtre et priorise les contraintes basées sur la zone et la pertinence
 */
export function filterAndPrioritizeConstraints(
  constraints: O3Constraint[],
  rdppfData: RdppfData | undefined,
  includeEnvironmental: boolean = false
): FilteredConstraints {
  
  const result: FilteredConstraints = {
    critical: [],
    zoneSpecific: [],
    general: [],
    informational: [],
    excluded: []
  };

  const zoneDesignation = rdppfData?.zoneAffectation?.designation?.toLowerCase() || '';
  
  for (const constraint of constraints) {
    // Exclure les contraintes environnementales si pas demandées
    if (!includeEnvironmental && isEnvironmentalConstraint(constraint)) {
      result.excluded.push(`${constraint.title} - Contrainte environnementale non pertinente`);
      continue;
    }
    
    // Exclure les zones de dangers si non mentionnées dans RDPPF
    if (isDangerZoneConstraint(constraint) && !rdppfDataMentionsDanger(rdppfData)) {
      result.excluded.push(`${constraint.title} - Zone de danger non présente dans RDPPF`);
      continue;
    }
    
    // Prioriser les contraintes
    if (isZoneSpecific(constraint, zoneDesignation)) {
      // Contraintes spécifiques à la zone trouvée
      constraint.severity = constraint.severity === 'low' ? 'medium' : constraint.severity;
      constraint.confidence = Math.max(constraint.confidence || 80, 90);
      
      if (constraint.severity === 'critical' || constraint.impact === 'blocking') {
        result.critical.push(constraint);
      } else {
        result.zoneSpecific.push(constraint);
      }
    } else if (constraint.severity === 'critical' || constraint.impact === 'blocking') {
      // Contraintes critiques générales
      result.critical.push(constraint);
    } else if (constraint.category === 'general' || !constraint.zone || constraint.zone === 'Toutes zones') {
      // Contraintes générales applicables
      result.general.push(constraint);
    } else {
      // Contraintes informatives
      result.informational.push(constraint);
    }
  }
  
  // Trier par sévérité et confiance
  const sortBySeverityAndConfidence = (a: O3Constraint, b: O3Constraint) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return (b.confidence || 0) - (a.confidence || 0);
  };
  
  result.critical.sort(sortBySeverityAndConfidence);
  result.zoneSpecific.sort(sortBySeverityAndConfidence);
  result.general.sort(sortBySeverityAndConfidence);
  
  return result;
}

/**
 * Vérifie si une contrainte est environnementale
 */
function isEnvironmentalConstraint(constraint: O3Constraint): boolean {
  const envKeywords = [
    'protection des eaux',
    'biotope',
    'nature',
    'faune',
    'flore',
    'biodiversité',
    'écologique',
    'environnement',
    'pollution',
    'émissions'
  ];
  
  const text = (constraint.title + ' ' + constraint.description).toLowerCase();
  return envKeywords.some(keyword => text.includes(keyword));
}

/**
 * Vérifie si une contrainte concerne les zones de dangers
 */
function isDangerZoneConstraint(constraint: O3Constraint): boolean {
  const dangerKeywords = [
    'avalanche',
    'inondation',
    'glissement',
    'éboulement',
    'danger naturel',
    'zone de danger',
    'risque naturel'
  ];
  
  const text = (constraint.title + ' ' + constraint.description).toLowerCase();
  return dangerKeywords.some(keyword => text.includes(keyword));
}

/**
 * Vérifie si le RDPPF mentionne des dangers
 */
function rdppfDataMentionsDanger(rdppfData: RdppfData | undefined): boolean {
  if (!rdppfData) return false;
  
  return rdppfData.autresRestrictions.some(restriction => 
    restriction.type.toLowerCase().includes('danger') ||
    restriction.description.toLowerCase().includes('danger')
  );
}

/**
 * Vérifie si une contrainte est spécifique à la zone
 */
function isZoneSpecific(constraint: O3Constraint, zoneDesignation: string): boolean {
  if (!zoneDesignation) return false;
  
  // Vérifier si la contrainte mentionne explicitement la zone
  const constraintText = (
    constraint.zone + ' ' + 
    constraint.title + ' ' + 
    constraint.description + ' ' +
    constraint.source
  ).toLowerCase();
  
  // Extraire les éléments clés de la zone
  const zoneElements = extractZoneElements(zoneDesignation);
  
  // Vérifier si au moins un élément correspond
  return zoneElements.some(element => constraintText.includes(element));
}

/**
 * Extrait les éléments clés d'une désignation de zone
 */
function extractZoneElements(zoneDesignation: string): string[] {
  const elements: string[] = [];
  
  // Ajouter la désignation complète
  elements.push(zoneDesignation);
  
  // Extraire l'indice (ex: 0.5, 0.3)
  const indiceMatch = zoneDesignation.match(/\d+\.\d+/);
  if (indiceMatch) {
    elements.push(indiceMatch[0]);
  }
  
  // Extraire le type de zone
  if (zoneDesignation.includes('résidentielle')) {
    elements.push('résidentielle', 'résidentiel');
  }
  if (zoneDesignation.includes('habitat')) {
    elements.push('habitat', 'habitation');
  }
  if (zoneDesignation.includes('faible densité')) {
    elements.push('faible densité');
  }
  if (zoneDesignation.includes('mixte')) {
    elements.push('mixte');
  }
  if (zoneDesignation.includes('centre')) {
    elements.push('centre');
  }
  
  return elements.filter(e => e.length > 2);
}

/**
 * Génère un résumé des contraintes filtrées
 */
export function generateConstraintSummary(filtered: FilteredConstraints): string {
  const parts: string[] = [];
  
  if (filtered.critical.length > 0) {
    parts.push(`${filtered.critical.length} contraintes critiques`);
  }
  
  if (filtered.zoneSpecific.length > 0) {
    parts.push(`${filtered.zoneSpecific.length} contraintes spécifiques à la zone`);
  }
  
  if (filtered.general.length > 0) {
    parts.push(`${filtered.general.length} contraintes générales`);
  }
  
  if (filtered.excluded.length > 0) {
    parts.push(`${filtered.excluded.length} contraintes exclues (non pertinentes)`);
  }
  
  return parts.join(', ');
}