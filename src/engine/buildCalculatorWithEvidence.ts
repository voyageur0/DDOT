/**
 * Module de calcul des indicateurs avec traçabilité des preuves
 * Version enrichie qui enregistre l'origine et la fiabilité de chaque calcul
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../db/types/supabase';
import { ConsolidatedRule, RuleHelper } from './ruleResolver';

// Re-export des types depuis buildCalculator original
export { CalcInput, CalcOutput, ControlMessage, CalcDetails } from './buildCalculator';
export { canCalculate, summarizeControls } from './buildCalculator';

import { CalcInput, CalcOutput, ControlMessage, CalcDetails } from './buildCalculator';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ReliabilityLevel = 'direct' | 'derived' | 'estimated' | 'missing';

/**
 * Table de conversion indice U vers IBUS pour le Valais
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
 * Convertit l'indice d'utilisation en IBUS
 */
function convertIndiceUToIBUS(indiceU: number): number {
  const calculated = indiceU * 1.333;
  
  for (const [u, ibus] of INDICE_U_TO_IBUS) {
    if (Math.abs(u - indiceU) < 0.001) {
      return ibus;
    }
  }
  
  for (let i = 0; i < INDICE_U_TO_IBUS.length - 1; i++) {
    const [u1, ibus1] = INDICE_U_TO_IBUS[i];
    const [u2, ibus2] = INDICE_U_TO_IBUS[i + 1];
    
    if (indiceU >= u1 && indiceU <= u2) {
      const ratio = (indiceU - u1) / (u2 - u1);
      return ibus1 + ratio * (ibus2 - ibus1);
    }
  }
  
  return Math.max(calculated, 0.5);
}

/**
 * Calcule les indicateurs avec traçabilité des preuves
 */
export async function computeBuildIndicatorsWithEvidence(
  input: CalcInput,
  parcelId: string,
  zoneId?: string
): Promise<CalcOutput> {
  const { parcelAreaM2, rules } = input;
  const controls: ControlMessage[] = [];
  const missingValues: string[] = [];
  const details: CalcDetails = {
    formulas: {},
    missing_values: missingValues
  };

  // Map pour stocker les preuves à enregistrer
  const evidenceItems: any[] = [];
  const fieldReliability = new Map<string, ReliabilityLevel>();

  // Vérification de la surface
  if (parcelAreaM2 <= 0) {
    controls.push({
      code: 'INVALID_AREA',
      level: 'error',
      message: 'Surface de parcelle invalide ou nulle'
    });
    
    await trackQualityScore(parcelId, zoneId, fieldReliability, 0);
    
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
  
  // 1. Extraction et traçabilité des indices
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

  // Tracer l'origine des valeurs extraites
  if (indiceU !== undefined) {
    fieldReliability.set('indice_u', 'direct');
    evidenceItems.push({
      ref_type: 'calculation',
      parcel_id: parcelId,
      field: 'indice_u',
      value_num: indiceU,
      reliability: 'direct',
      source_path: 'rules/indice_u',
      comment: 'Indice U extrait des règles consolidées',
      inserted_by: 'buildCalculator'
    });
  } else {
    missingValues.push('indice_u');
    fieldReliability.set('indice_u', 'missing');
  }

  if (ibus !== undefined) {
    fieldReliability.set('ibus', 'direct');
    evidenceItems.push({
      ref_type: 'calculation',
      parcel_id: parcelId,
      field: 'ibus_original',
      value_num: ibus,
      reliability: 'direct',
      source_path: 'rules/ibus',
      comment: 'IBUS extrait des règles consolidées',
      inserted_by: 'buildCalculator'
    });
  } else {
    missingValues.push('ibus');
  }

  if (empriseMax !== undefined) {
    fieldReliability.set('emprise_max', 'direct');
    evidenceItems.push({
      ref_type: 'calculation',
      parcel_id: parcelId,
      field: 'emprise_max',
      value_num: empriseMax,
      reliability: 'direct',
      source_path: 'rules/emprise_max',
      comment: 'Emprise maximale extraite des règles',
      inserted_by: 'buildCalculator'
    });
  } else {
    missingValues.push('emprise_max');
    fieldReliability.set('emprise_max', 'missing');
  }

  // 2. Calculs principaux avec traçabilité
  let suM2: number | null = null;
  let ibusM2: number | null = null;
  let empriseM2: number | null = null;

  // Calcul de la surface utile (SU)
  if (indiceU !== undefined) {
    suM2 = Math.round(indiceU * parcelAreaM2 * 10) / 10;
    details.formulas.su = `${indiceU} × ${parcelAreaM2} = ${suM2} m²`;
    
    fieldReliability.set('su_m2', 'derived');
    evidenceItems.push({
      ref_type: 'calculation',
      parcel_id: parcelId,
      field: 'su_m2',
      value_num: suM2,
      reliability: 'derived',
      source_path: 'calc/su',
      comment: `Surface utile calculée: ${details.formulas.su}`,
      metadata: { formula: details.formulas.su, indice_u: indiceU },
      inserted_by: 'buildCalculator'
    });
  } else {
    controls.push({
      code: 'MISSING_INDICE_U',
      level: 'warning',
      message: 'Indice d\'utilisation (U) non défini'
    });
    fieldReliability.set('su_m2', 'missing');
  }

  // Calcul de l'IBUS (avec conversion si nécessaire)
  if (ibus === undefined && indiceU !== undefined) {
    ibus = convertIndiceUToIBUS(indiceU);
    details.ibus_calculated = ibus;
    details.conversion_applied = true;
    
    fieldReliability.set('ibus', 'derived');
    evidenceItems.push({
      ref_type: 'calculation',
      parcel_id: parcelId,
      field: 'ibus_converted',
      value_num: ibus,
      reliability: 'derived',
      source_path: 'calc/ibus_conversion',
      comment: `IBUS converti depuis indice U selon table Valais`,
      metadata: { 
        indice_u: indiceU, 
        conversion_table: 'VS_2024',
        formula: `${indiceU} × 1.333 = ${ibus}`
      },
      inserted_by: 'buildCalculator'
    });
    
    controls.push({
      code: 'IBUS_CONVERTED',
      level: 'info',
      message: `IBUS calculé depuis indice U (${indiceU}) selon table de conversion: ${ibus}`
    });
  }

  if (ibus !== undefined) {
    ibusM2 = Math.round(ibus * parcelAreaM2 * 10) / 10;
    details.formulas.ibus = `${ibus} × ${parcelAreaM2} = ${ibusM2} m²`;
    
    const reliability = details.conversion_applied ? 'derived' : 'direct';
    fieldReliability.set('ibus_m2', reliability);
    
    evidenceItems.push({
      ref_type: 'calculation',
      parcel_id: parcelId,
      field: 'ibus_m2',
      value_num: ibusM2,
      reliability: reliability,
      source_path: 'calc/ibus_m2',
      comment: `Surface brute calculée: ${details.formulas.ibus}`,
      metadata: { 
        formula: details.formulas.ibus, 
        ibus: ibus,
        converted: details.conversion_applied || false
      },
      inserted_by: 'buildCalculator'
    });
  } else {
    controls.push({
      code: 'MISSING_IBUS',
      level: 'warning',
      message: 'IBUS non défini et impossible à calculer'
    });
    fieldReliability.set('ibus_m2', 'missing');
  }

  // Calcul de l'emprise au sol
  if (empriseMax !== undefined) {
    empriseM2 = Math.round(empriseMax * parcelAreaM2 * 10) / 10;
    details.formulas.emprise = `${empriseMax} × ${parcelAreaM2} = ${empriseM2} m²`;
    
    fieldReliability.set('emprise_m2', 'derived');
    evidenceItems.push({
      ref_type: 'calculation',
      parcel_id: parcelId,
      field: 'emprise_m2',
      value_num: empriseM2,
      reliability: 'derived',
      source_path: 'calc/emprise',
      comment: `Emprise au sol calculée: ${details.formulas.emprise}`,
      metadata: { formula: details.formulas.emprise, emprise_max: empriseMax },
      inserted_by: 'buildCalculator'
    });
  } else {
    controls.push({
      code: 'MISSING_EMPRISE',
      level: 'info',
      message: 'Emprise au sol maximale non définie'
    });
    fieldReliability.set('emprise_m2', 'missing');
  }

  // 3. Estimation du nombre de niveaux
  let niveauxMaxEst: number | null = null;
  
  if (ibusM2 !== null && empriseM2 !== null && empriseM2 > 0) {
    niveauxMaxEst = Math.floor(ibusM2 / empriseM2);
    details.formulas.niveaux = `floor(${ibusM2} / ${empriseM2}) = ${niveauxMaxEst}`;
    
    if (niveauxMax !== undefined && niveauxMaxEst > niveauxMax) {
      niveauxMaxEst = niveauxMax;
      controls.push({
        code: 'NIVEAUX_LIMITED',
        level: 'info',
        message: `Nombre de niveaux limité par le règlement à ${niveauxMax}`
      });
    }
    
    fieldReliability.set('niveaux_max_est', 'estimated');
    evidenceItems.push({
      ref_type: 'calculation',
      parcel_id: parcelId,
      field: 'niveaux_max_est',
      value_num: niveauxMaxEst,
      reliability: 'estimated',
      source_path: 'calc/niveaux_estimation',
      comment: `Estimation niveaux: ${details.formulas.niveaux}`,
      metadata: { 
        formula: details.formulas.niveaux,
        limited_by_rule: niveauxMax !== undefined && niveauxMaxEst === niveauxMax
      },
      inserted_by: 'buildCalculator'
    });
  } else {
    fieldReliability.set('niveaux_max_est', 'missing');
  }

  // 4. Contrôles de cohérence (comme avant)
  if (ibusM2 !== null && suM2 !== null && ibusM2 < suM2) {
    controls.push({
      code: 'IBUS_INCOHERENT',
      level: 'error',
      message: `IBUS (${ibusM2} m²) inférieur à SU (${suM2} m²) - incohérence`
    });
  }

  if (indiceU !== undefined && (indiceU <= 0 || indiceU > 2)) {
    controls.push({
      code: 'INDICE_U_RANGE',
      level: 'warning',
      message: `Indice U (${indiceU}) hors plage habituelle (0-2)`
    });
  }

  if (empriseMax !== undefined && (empriseMax <= 0 || empriseMax > 1)) {
    controls.push({
      code: 'EMPRISE_RANGE',
      level: 'warning',
      message: `Emprise max (${empriseMax}) hors plage habituelle (0-1)`
    });
  }

  // 5. Calcul du score de fiabilité
  const reliability = calculateReliabilityScore(fieldReliability);

  // 6. Enregistrer les preuves
  if (evidenceItems.length > 0) {
    try {
      const { error } = await supabase
        .from('evidence_items')
        .upsert(evidenceItems, {
          onConflict: 'ref_type,field,parcel_id'
        });
      
      if (error) {
        console.error('Erreur insertion evidence:', error);
      }
    } catch (error) {
      console.error('Erreur dans trackCalculationEvidence:', error);
    }
  }

  // 7. Enregistrer le score de qualité
  await trackQualityScore(parcelId, zoneId, fieldReliability, reliability);

  // 8. Retour des résultats
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
 * Calcule le score de fiabilité global
 */
function calculateReliabilityScore(fieldReliability: Map<string, ReliabilityLevel>): number {
  const weights = {
    'direct': 1.0,
    'derived': 0.8,
    'estimated': 0.5,
    'missing': 0.0
  };

  let totalWeight = 0;
  let totalScore = 0;

  for (const [field, reliability] of fieldReliability) {
    // Pondération selon l'importance du champ
    const fieldWeight = getFieldImportance(field);
    totalWeight += fieldWeight;
    totalScore += weights[reliability] * fieldWeight;
  }

  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) / 100 : 0;
}

/**
 * Retourne l'importance relative d'un champ
 */
function getFieldImportance(field: string): number {
  const importance: Record<string, number> = {
    'indice_u': 1.0,
    'ibus': 1.0,
    'ibus_m2': 0.9,
    'su_m2': 0.9,
    'emprise_max': 0.7,
    'emprise_m2': 0.7,
    'niveaux_max_est': 0.5
  };
  
  return importance[field] || 0.5;
}

/**
 * Enregistre le score de qualité dans analysis_quality
 */
async function trackQualityScore(
  parcelId: string,
  zoneId: string | undefined,
  fieldReliability: Map<string, ReliabilityLevel>,
  globalScore: number
): Promise<void> {
  try {
    // Compter les fiabilités
    let directCount = 0;
    let derivedCount = 0;
    let estimatedCount = 0;
    let missingCount = 0;

    for (const reliability of fieldReliability.values()) {
      switch (reliability) {
        case 'direct': directCount++; break;
        case 'derived': derivedCount++; break;
        case 'estimated': estimatedCount++; break;
        case 'missing': missingCount++; break;
      }
    }

    // Construire le détail par champ
    const details: Record<string, number> = {};
    const weights = {
      'direct': 1.0,
      'derived': 0.8,
      'estimated': 0.5,
      'missing': 0.0
    };

    for (const [field, reliability] of fieldReliability) {
      details[field] = weights[reliability];
    }

    // Insérer ou mettre à jour
    const { error } = await supabase
      .from('analysis_quality')
      .upsert({
        parcel_id: parcelId,
        zone_id: zoneId,
        calc_date: new Date().toISOString().split('T')[0],
        score_global: globalScore,
        score_calculations: globalScore, // Score spécifique aux calculs
        details: details,
        total_fields: fieldReliability.size,
        direct_count: directCount,
        derived_count: derivedCount,
        estimated_count: estimatedCount,
        missing_count: missingCount,
        analysis_version: '1.0'
      }, {
        onConflict: 'parcel_id,calc_date'
      });

    if (error) {
      console.error('Erreur insertion quality score:', error);
    }
  } catch (error) {
    console.error('Erreur dans trackQualityScore:', error);
  }
}

/**
 * Export de la fonction principale avec le nom original pour compatibilité
 */
export const computeBuildIndicators = computeBuildIndicatorsWithEvidence;