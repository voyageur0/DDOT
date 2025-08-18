/**
 * Formateur de contexte avec labels normalisés
 * Utilise le dictionnaire multilingue pour des messages uniformes
 */

import { ContextFlag } from './contextResolver';
import { getLabel, getSeverity, Lang } from '../i18n/labelServiceLocal';
import { truncateSentence, formatConstraintMessage } from '../i18n/summarizer';

/**
 * Formate les flags de contexte avec labels normalisés
 */
export async function summarizeContext(
  flags: ContextFlag[],
  lang: Lang = 'fr',
  limit: number = 5
): Promise<string[]> {
  if (!flags || flags.length === 0) return [];

  try {
    // Enrichir chaque flag avec son label et sa sévérité normalisés
    const enrichedFlags = await Promise.all(
      flags.map(async (flag) => {
        // Construire le code pour le dictionnaire
        const constraintCode = buildConstraintCode(flag);
        
        // Récupérer le label et la sévérité depuis le dictionnaire
        const [label, severity] = await Promise.all([
          getLabel(constraintCode, 'constraint', lang, false),
          getSeverity(constraintCode, 'constraint')
        ]);

        // Si le label n'est pas trouvé, utiliser le message original
        const message = label !== constraintCode ? 
          label : 
          flag.message;

        return {
          ...flag,
          severity: flag.severity || severity,
          normalizedMessage: message,
          originalMessage: flag.message
        };
      })
    );

    // Trier par sévérité décroissante, puis par layer alphabétique
    const sorted = enrichedFlags.sort((a, b) => {
      if (b.severity !== a.severity) {
        return b.severity - a.severity;
      }
      return a.layer.localeCompare(b.layer);
    });

    // Prendre les N plus importants
    const selected = sorted.slice(0, limit);

    // Formater les messages finaux
    const messages = selected.map(flag => {
      // Utiliser le message normalisé
      let message = flag.normalizedMessage;

      // Ajouter des détails contextuels si pertinents
      if (flag.valueNum !== undefined) {
        message = addNumericDetail(message, flag);
      }

      // S'assurer que le message reste court (≤12 mots)
      return truncateSentence(message, 12);
    });

    return messages;

  } catch (error) {
    console.error('Erreur dans summarizeContext:', error);
    // Fallback vers les messages originaux
    return flags
      .slice(0, limit)
      .map(f => truncateSentence(f.message, 12));
  }
}

/**
 * Construit le code de contrainte pour le dictionnaire
 */
function buildConstraintCode(flag: ContextFlag): string {
  switch (flag.layer) {
    case 'opb_noise':
      // Format: opb_noise_DS_III
      if (flag.valueText) {
        return `opb_noise_${flag.valueText.replace(/\s+/g, '_')}`;
      }
      return 'opb_noise';

    case 'ofac_airport':
      return 'ofac_airport';

    case 'risk_nat':
      // Déterminer le niveau basé sur les métadonnées
      if (flag.metadata?.danger_level) {
        return `risk_nat_${flag.metadata.danger_level}`;
      }
      if (flag.metadata?.hazard_type) {
        const level = determineDangerLevel(flag.severity);
        return `risk_${flag.metadata.hazard_type}_${level}`;
      }
      return 'risk_nat_moyen';

    case 'slope_pct':
      // Catégoriser la pente
      if (flag.valueNum) {
        if (flag.valueNum > 45) return 'slope_45_plus';
        if (flag.valueNum > 30) return 'slope_30_45';
        if (flag.valueNum > 15) return 'slope_15_30';
        return 'slope_0_15';
      }
      return 'slope_pct';

    case 'roads_cantonal':
      // Basé sur la distance
      if (flag.distance !== undefined) {
        if (flag.distance < 25) return 'roads_0_25m';
        if (flag.distance < 100) return 'roads_25_100m';
      }
      return 'roads_cantonal';

    default:
      return flag.layer;
  }
}

/**
 * Détermine le niveau de danger basé sur la sévérité
 */
function determineDangerLevel(severity: number): string {
  switch (severity) {
    case 3: return 'fort';
    case 2: return 'moyen';
    default: return 'faible';
  }
}

/**
 * Ajoute des détails numériques au message si pertinent
 */
function addNumericDetail(message: string, flag: ContextFlag): string {
  // Pour la pente, le pourcentage est déjà dans le label
  if (flag.layer === 'slope_pct') {
    return message;
  }

  // Pour les distances, ajouter la valeur exacte si proche
  if (flag.layer === 'roads_cantonal' && flag.distance !== undefined && flag.distance < 50) {
    // Le label contient déjà une plage, on peut le préciser
    return message.replace(/\d+-\d+m/, `${Math.round(flag.distance)}m`);
  }

  return message;
}

/**
 * Formate un ensemble de flags pour l'affichage détaillé
 */
export async function formatDetailedContext(
  flags: ContextFlag[],
  lang: Lang = 'fr'
): Promise<Array<{
  layer: string;
  label: string;
  severity: number;
  severityLabel: string;
  value: string | number | null;
  message: string;
}>> {
  const results = [];

  for (const flag of flags) {
    const constraintCode = buildConstraintCode(flag);
    
    // Récupérer les labels
    const [layerLabel, constraintLabel, severity] = await Promise.all([
      getLabel(flag.layer, 'field', lang, false).catch(() => flag.layer),
      getLabel(constraintCode, 'constraint', lang, true), // Version longue
      getSeverity(constraintCode, 'constraint')
    ]);

    // Label de sévérité
    const severityLabel = getSeverityLabel(flag.severity || severity, lang);

    // Valeur formatée
    const value = flag.valueNum || flag.valueText || null;

    results.push({
      layer: flag.layer,
      label: layerLabel,
      severity: flag.severity || severity,
      severityLabel,
      value,
      message: constraintLabel !== constraintCode ? constraintLabel : flag.message
    });
  }

  return results;
}

/**
 * Retourne le label de sévérité dans la langue demandée
 */
function getSeverityLabel(severity: number, lang: Lang): string {
  const labels = {
    fr: ['', 'Information', 'Attention', 'Critique'],
    de: ['', 'Information', 'Achtung', 'Kritisch'],
    en: ['', 'Information', 'Warning', 'Critical']
  };

  return labels[lang][severity] || labels.fr[severity] || 'Inconnu';
}

/**
 * Analyse et groupe les contraintes par catégorie
 */
export async function groupConstraintsByCategory(
  flags: ContextFlag[],
  lang: Lang = 'fr'
): Promise<Record<string, Array<{
  message: string;
  severity: number;
}>>> {
  const groups: Record<string, Array<{ message: string; severity: number }>> = {};

  for (const flag of flags) {
    // Déterminer la catégorie
    const category = getConstraintCategory(flag.layer);
    
    // Récupérer le message normalisé
    const constraintCode = buildConstraintCode(flag);
    const message = await getLabel(constraintCode, 'constraint', lang, false);
    const severity = flag.severity || await getSeverity(constraintCode, 'constraint');

    if (!groups[category]) {
      groups[category] = [];
    }

    groups[category].push({
      message: truncateSentence(message !== constraintCode ? message : flag.message, 12),
      severity
    });
  }

  // Trier chaque groupe par sévérité
  Object.values(groups).forEach(group => {
    group.sort((a, b) => b.severity - a.severity);
  });

  return groups;
}

/**
 * Détermine la catégorie d'une contrainte
 */
function getConstraintCategory(layer: string): string {
  const categories: Record<string, string> = {
    'opb_noise': 'Bruit',
    'ofac_airport': 'Aéroport',
    'risk_nat': 'Dangers naturels',
    'slope_pct': 'Topographie',
    'roads_cantonal': 'Infrastructure',
    'water_protection': 'Protection eaux',
    'heritage': 'Patrimoine'
  };

  // Chercher une correspondance partielle
  for (const [prefix, category] of Object.entries(categories)) {
    if (layer.startsWith(prefix)) {
      return category;
    }
  }

  return 'Autres';
}

// Export de la fonction principale avec compatibilité
export { summarizeContext as default };