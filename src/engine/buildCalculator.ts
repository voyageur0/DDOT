/**
 * Module de calcul des indicateurs de constructibilité
 * Produit des métriques reproductibles à partir des règles consolidées
 */

import { ConsolidatedRule, RuleHelper } from './ruleResolver';

/**
 * Données d'entrée pour le calcul
 */
export interface CalcInput {
  parcelAreaM2: number;
  rules: ConsolidatedRule[];
}

/**
 * Résultat des calculs
 */
export interface CalcOutput {
  suM2: number | null;          // Surface utile (indice_u × surface)
  ibusM2: number | null;        // Surface brute (IBUS × surface)
  empriseM2: number | null;     // Emprise au sol maximale
  niveauxMaxEst: number | null; // Estimation nombre niveaux réalisables
  reliability: number;          // Score de fiabilité 0-1
  controls: ControlMessage[];   // Messages de contrôle
  details: CalcDetails;         // Détails des calculs
}

/**
 * Message de contrôle
 */
export interface ControlMessage {
  code: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

/**
 * Détails des calculs pour traçabilité
 */
export interface CalcDetails {
  indice_u?: number;
  ibus?: number;
  ibus_calculated?: number;     // IBUS calculé depuis indice_u si manquant
  emprise_max?: number;
  h_max_m?: number;
  niveaux_max?: number;
  formulas: {
    su?: string;
    ibus?: string;
    emprise?: string;
    niveaux?: string;
  };
  missing_values: string[];
  conversion_applied?: boolean;  // Si conversion indice_u -> IBUS appliquée
}

/**
 * Table de conversion indice U vers IBUS pour le Valais
 * Source: Annexe 1 - Tableau de conversion
 */
const INDICE_U_TO_IBUS: Array<[number, number]> = [
  [0.35, 0.50],
  [0.40, 0.53],
  [0.45, 0.60],
  [0.50, 0.67],
  [0.55, 0.73],
  [0.60, 0.80],
  [0.65, 0.87],
  [0.70, 0.93],
  [0.75, 1.00],
  [0.80, 1.07],
  [0.85, 1.13]
];

/**
 * Convertit l'indice d'utilisation en IBUS selon la table du Valais
 */
function convertIndiceUToIBUS(indiceU: number): number {
  // Formule générale: IBUS = indice_u × 1.333 (min 0.5)
  const calculated = indiceU * 1.333;
  
  // Vérifier dans la table pour une correspondance exacte
  for (const [u, ibus] of INDICE_U_TO_IBUS) {
    if (Math.abs(u - indiceU) < 0.001) {
      return ibus;
    }
  }
  
  // Interpolation linéaire entre deux valeurs de la table
  for (let i = 0; i < INDICE_U_TO_IBUS.length - 1; i++) {
    const [u1, ibus1] = INDICE_U_TO_IBUS[i];
    const [u2, ibus2] = INDICE_U_TO_IBUS[i + 1];
    
    if (indiceU >= u1 && indiceU <= u2) {
      const ratio = (indiceU - u1) / (u2 - u1);
      return ibus1 + ratio * (ibus2 - ibus1);
    }
  }
  
  // Si hors table, utiliser la formule avec minimum
  return Math.max(calculated, 0.5);
}

/**
 * Calcule les indicateurs de constructibilité
 */
export function computeBuildIndicators(input: CalcInput): CalcOutput {
  const { parcelAreaM2, rules } = input;
  const controls: ControlMessage[] = [];
  const missingValues: string[] = [];
  const details: CalcDetails = {
    formulas: {},
    missing_values: missingValues
  };

  // Vérification de la surface
  if (parcelAreaM2 <= 0) {
    controls.push({
      code: 'INVALID_AREA',
      level: 'error',
      message: 'Surface de parcelle invalide ou nulle'
    });
    
    return {
      suM2: null,
      ibusM2: null,
      empriseM2: null,
      niveauxMaxEst: null,
      reliability: 0,
      controls,
      details
    };
  }

  // Extraction des règles de construction
  const buildingRules = RuleHelper.extractBuildingRules(rules);
  
  // 1. Extraction des indices
  const indiceU = buildingRules.indice_u;
  let ibus = buildingRules.ibus;
  const empriseMax = buildingRules.emprise_max;
  const hMaxM = buildingRules.h_max_m;
  const niveauxMax = buildingRules.niveaux_max;

  details.indice_u = indiceU;
  details.ibus = ibus;
  details.emprise_max = empriseMax;
  details.h_max_m = hMaxM;
  details.niveaux_max = niveauxMax;

  // Vérification des valeurs manquantes
  if (indiceU === undefined) missingValues.push('indice_u');
  if (ibus === undefined) missingValues.push('ibus');
  if (empriseMax === undefined) missingValues.push('emprise_max');

  // 2. Calculs principaux
  let suM2: number | null = null;
  let ibusM2: number | null = null;
  let empriseM2: number | null = null;

  // Calcul de la surface utile (SU)
  if (indiceU !== undefined) {
    suM2 = Math.round(indiceU * parcelAreaM2 * 10) / 10;
    details.formulas.su = `${indiceU} × ${parcelAreaM2} = ${suM2} m²`;
  } else {
    controls.push({
      code: 'MISSING_INDICE_U',
      level: 'warning',
      message: 'Indice d\'utilisation (U) non défini'
    });
  }

  // Calcul de l'IBUS (avec conversion si nécessaire)
  if (ibus === undefined && indiceU !== undefined) {
    // Conversion indice U -> IBUS selon table Valais
    ibus = convertIndiceUToIBUS(indiceU);
    details.ibus_calculated = ibus;
    details.conversion_applied = true;
    controls.push({
      code: 'IBUS_CONVERTED',
      level: 'info',
      message: `IBUS calculé depuis indice U (${indiceU}) selon table de conversion: ${ibus}`
    });
  }

  if (ibus !== undefined) {
    ibusM2 = Math.round(ibus * parcelAreaM2 * 10) / 10;
    details.formulas.ibus = `${ibus} × ${parcelAreaM2} = ${ibusM2} m²`;
  } else {
    controls.push({
      code: 'MISSING_IBUS',
      level: 'warning',
      message: 'IBUS non défini et impossible à calculer'
    });
  }

  // Calcul de l'emprise au sol
  if (empriseMax !== undefined) {
    empriseM2 = Math.round(empriseMax * parcelAreaM2 * 10) / 10;
    details.formulas.emprise = `${empriseMax} × ${parcelAreaM2} = ${empriseM2} m²`;
  } else {
    controls.push({
      code: 'MISSING_EMPRISE',
      level: 'info',
      message: 'Emprise au sol maximale non définie'
    });
  }

  // 3. Estimation du nombre de niveaux
  let niveauxMaxEst: number | null = null;
  
  if (ibusM2 !== null && empriseM2 !== null && empriseM2 > 0) {
    niveauxMaxEst = Math.floor(ibusM2 / empriseM2);
    details.formulas.niveaux = `floor(${ibusM2} / ${empriseM2}) = ${niveauxMaxEst}`;
    
    // Vérification de cohérence avec niveaux_max règlementaire
    if (niveauxMax !== undefined && niveauxMaxEst > niveauxMax) {
      niveauxMaxEst = niveauxMax;
      controls.push({
        code: 'NIVEAUX_LIMITED',
        level: 'info',
        message: `Nombre de niveaux limité par le règlement à ${niveauxMax}`
      });
    }
  }

  // 4. Contrôles de cohérence
  
  // Vérification IBUS >= SU
  if (ibusM2 !== null && suM2 !== null && ibusM2 < suM2) {
    controls.push({
      code: 'IBUS_INCOHERENT',
      level: 'error',
      message: `IBUS (${ibusM2} m²) inférieur à SU (${suM2} m²) - incohérence`
    });
  }

  // Vérification indice_u dans plage raisonnable
  if (indiceU !== undefined && (indiceU <= 0 || indiceU > 2)) {
    controls.push({
      code: 'INDICE_U_RANGE',
      level: 'warning',
      message: `Indice U (${indiceU}) hors plage habituelle (0-2)`
    });
  }

  // Vérification emprise_max dans plage raisonnable
  if (empriseMax !== undefined && (empriseMax <= 0 || empriseMax > 1)) {
    controls.push({
      code: 'EMPRISE_RANGE',
      level: 'warning',
      message: `Emprise max (${empriseMax}) hors plage habituelle (0-1)`
    });
  }

  // 5. Calcul du score de fiabilité
  const baseReliability = 1.0;
  const penaltyPerMissing = 0.25;
  const reliability = Math.max(
    0.25,
    baseReliability - (missingValues.length * penaltyPerMissing)
  );

  // 6. Retour des résultats
  return {
    suM2,
    ibusM2,
    empriseM2,
    niveauxMaxEst,
    reliability,
    controls,
    details
  };
}

/**
 * Vérifie si des calculs sont possibles avec les règles données
 */
export function canCalculate(rules: ConsolidatedRule[]): boolean {
  const buildingRules = RuleHelper.extractBuildingRules(rules);
  return buildingRules.indice_u !== undefined || buildingRules.ibus !== undefined;
}

/**
 * Résume les contrôles par niveau de sévérité
 */
export function summarizeControls(controls: ControlMessage[]): {
  errors: number;
  warnings: number;
  infos: number;
} {
  return {
    errors: controls.filter(c => c.level === 'error').length,
    warnings: controls.filter(c => c.level === 'warning').length,
    infos: controls.filter(c => c.level === 'info').length
  };
}