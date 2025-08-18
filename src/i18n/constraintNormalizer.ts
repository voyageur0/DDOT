/**
 * Normalisation des contraintes pour utiliser les labels du dictionnaire
 */

import { getLabel, getSeverity } from './labelServiceLocal';
import { truncateSentence } from './summarizer';

interface RawConstraint {
  title: string;
  description: string;
  severity?: string;
  category?: string;
  theme?: string;
  zone?: string;
  source?: string;
  values?: any;
}

interface NormalizedConstraint {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  category: string;
  source: string;
  [key: string]: any;
}

/**
 * Détecte le code de contrainte approprié basé sur le contenu
 */
function detectConstraintCode(constraint: RawConstraint): string | null {
  const title = constraint.title?.toLowerCase() || '';
  const desc = constraint.description?.toLowerCase() || '';
  const combined = `${title} ${desc}`;
  
  // Bruit
  if (combined.includes('bruit') || combined.includes('noise') || combined.includes('ds')) {
    if (combined.includes('ds iv') || combined.includes('ds 4')) return 'opb_noise_DS_IV';
    if (combined.includes('ds iii') || combined.includes('ds 3')) return 'opb_noise_DS_III';
    if (combined.includes('ds ii') || combined.includes('ds 2')) return 'opb_noise_DS_II';
    if (combined.includes('ds i') || combined.includes('ds 1')) return 'opb_noise_DS_I';
  }
  
  // Pente
  if (combined.includes('pente') || combined.includes('slope') || combined.includes('déclivité')) {
    const percentMatch = combined.match(/(\d+)\s*%/);
    if (percentMatch) {
      const percent = parseInt(percentMatch[1]);
      if (percent >= 45) return 'slope_45_plus';
      if (percent >= 30) return 'slope_30_45';
      return 'slope_0_30';
    }
    if (combined.includes('forte') || combined.includes('steep')) return 'slope_30_45';
    if (combined.includes('très forte') || combined.includes('very steep')) return 'slope_45_plus';
  }
  
  // Dangers naturels
  if (combined.includes('danger') || combined.includes('risque') || combined.includes('hazard')) {
    if (combined.includes('fort') || combined.includes('élevé') || combined.includes('high')) return 'risk_nat_fort';
    if (combined.includes('moyen') || combined.includes('modéré') || combined.includes('medium')) return 'risk_nat_moyen';
    if (combined.includes('faible') || combined.includes('low')) return 'risk_nat_faible';
  }
  
  // Routes
  if (combined.includes('route') || combined.includes('road') || combined.includes('cantonal')) {
    const distMatch = combined.match(/(\d+)\s*m/);
    if (distMatch) {
      const dist = parseInt(distMatch[1]);
      if (dist <= 25) return 'roads_0_25m';
      if (dist <= 100) return 'roads_25_100m';
    }
  }
  
  // Patrimoine
  if (combined.includes('monument') || combined.includes('protégé') || combined.includes('patrimoine')) {
    if (combined.includes('monument')) return 'monument_protected';
    return 'site_protected';
  }
  
  // Environnement
  if (combined.includes('forêt') || combined.includes('lisière') || combined.includes('forest')) {
    return 'forest_edge';
  }
  if (combined.includes('eau') || combined.includes('water') || combined.includes('protection')) {
    return 'water_protection';
  }
  
  return null;
}

/**
 * Détermine la catégorie basée sur le contenu
 */
function detectCategory(constraint: RawConstraint): string {
  if (constraint.category) return constraint.category;
  if (constraint.theme) return constraint.theme;
  
  const combined = `${constraint.title} ${constraint.description}`.toLowerCase();
  
  if (combined.includes('bruit') || combined.includes('noise')) return 'Bruit';
  if (combined.includes('pente') || combined.includes('slope') || combined.includes('topograph')) return 'Topographie';
  if (combined.includes('danger') || combined.includes('risque') || combined.includes('naturel')) return 'Dangers naturels';
  if (combined.includes('route') || combined.includes('road') || combined.includes('infrastructure')) return 'Infrastructure';
  if (combined.includes('monument') || combined.includes('patrimoine') || combined.includes('protégé')) return 'Patrimoine';
  if (combined.includes('forêt') || combined.includes('eau') || combined.includes('environnement')) return 'Environnement';
  if (combined.includes('hauteur') || combined.includes('gabarit') || combined.includes('recul')) return 'Gabarits & reculs';
  if (combined.includes('parking') || combined.includes('stationnement')) return 'Stationnement';
  if (combined.includes('densité') || combined.includes('ibus') || combined.includes('indice')) return 'Densité constructible';
  if (combined.includes('toiture') || combined.includes('architecture') || combined.includes('façade')) return 'Prescriptions architecturales';
  if (combined.includes('vert') || combined.includes('jeux') || combined.includes('détente')) return 'Espaces de jeux / détente';
  
  return 'Autres contraintes';
}

/**
 * Convertit la sévérité en format standardisé
 */
function normalizeSeverity(severity?: string | number): 'low' | 'medium' | 'high' {
  if (typeof severity === 'number') {
    if (severity >= 3) return 'high';
    if (severity >= 2) return 'medium';
    return 'low';
  }
  
  const sev = (severity || 'medium').toLowerCase();
  if (sev.includes('high') || sev.includes('élevé') || sev.includes('critique')) return 'high';
  if (sev.includes('low') || sev.includes('faible') || sev.includes('info')) return 'low';
  return 'medium';
}

/**
 * Normalise une contrainte en utilisant le dictionnaire de labels
 */
export async function normalizeConstraint(constraint: RawConstraint): Promise<NormalizedConstraint> {
  // Détecter le code de contrainte
  const constraintCode = detectConstraintCode(constraint);
  
  let normalizedTitle = constraint.title;
  let normalizedDescription = constraint.description;
  let severity = normalizeSeverity(constraint.severity);
  
  // Si on a trouvé un code correspondant, utiliser le label
  if (constraintCode) {
    try {
      // Récupérer le label normalisé
      const label = await getLabel(constraintCode, 'constraint', 'fr', false);
      if (label && label !== constraintCode) {
        normalizedTitle = label;
      }
      
      // Récupérer la sévérité du dictionnaire
      const dictSeverity = await getSeverity(constraintCode);
      if (dictSeverity) {
        severity = normalizeSeverity(dictSeverity);
      }
    } catch (error) {
      console.error(`Erreur récupération label pour ${constraintCode}:`, error);
    }
  }
  
  // Tronquer le titre et la description à 12 mots
  normalizedTitle = await truncateSentence(normalizedTitle, 12);
  normalizedDescription = await truncateSentence(normalizedDescription, 12);
  
  // Détecter la catégorie
  const category = detectCategory(constraint);
  
  return {
    ...constraint,
    title: normalizedTitle,
    description: normalizedDescription,
    severity,
    category,
    source: constraint.source || 'Analyse documentaire'
  };
}

/**
 * Normalise un tableau de contraintes
 */
export async function normalizeConstraints(constraints: RawConstraint[]): Promise<NormalizedConstraint[]> {
  const normalized = await Promise.all(
    constraints.map(c => normalizeConstraint(c))
  );
  
  // Trier par sévérité (critique d'abord)
  return normalized.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}