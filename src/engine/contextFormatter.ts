/**
 * Formateur pour les messages de contexte
 * Transforme les flags techniques en messages utilisateur
 */

import { ContextFlag } from './contextResolver';

/**
 * Résume les flags de contexte en messages hiérarchisés
 */
export function summarizeContext(flags: ContextFlag[], limit: number = 5): string[] {
  // Trier par sévérité décroissante
  const sorted = [...flags].sort((a, b) => {
    if (b.severity !== a.severity) {
      return b.severity - a.severity;
    }
    // En cas d'égalité, prioriser certains types
    const priority = getLayerPriority(a.layer) - getLayerPriority(b.layer);
    if (priority !== 0) return priority;
    
    return a.layer.localeCompare(b.layer);
  });

  // Limiter et formater
  return sorted
    .slice(0, limit)
    .map(flag => formatContextMessage(flag));
}

/**
 * Formate un flag en message lisible
 */
function formatContextMessage(flag: ContextFlag): string {
  // Si un message est déjà fourni, l'utiliser
  if (flag.message) {
    return flag.message;
  }

  // Sinon, générer selon le type
  switch (flag.layer) {
    case 'opb_noise':
      return formatNoiseMessage(flag);
    
    case 'ofac_airport':
      return 'Zone réglementée aéroport (hauteurs limitées)';
    
    case 'risk_nat':
      return formatRiskMessage(flag);
    
    case 'roads_cantonal':
      return formatRoadMessage(flag);
    
    case 'slope_pct':
      return formatSlopeMessage(flag);
    
    default:
      return `Contrainte ${flag.layer}`;
  }
}

/**
 * Formate un message de bruit
 */
function formatNoiseMessage(flag: ContextFlag): string {
  const dsLevel = flag.valueText || 'inconnue';
  const severity = flag.severity;
  
  if (severity >= 3) {
    return `⚠️ Zone de bruit élevé (${dsLevel}) - Mesures acoustiques obligatoires`;
  } else if (severity === 2) {
    return `Zone de bruit modéré (${dsLevel}) - Isolation recommandée`;
  }
  
  return `Zone de sensibilité au bruit ${dsLevel}`;
}

/**
 * Formate un message de risque naturel
 */
function formatRiskMessage(flag: ContextFlag): string {
  const type = flag.metadata?.hazard_type || 'naturel';
  const level = flag.metadata?.danger_level || '';
  
  const typeLabels: Record<string, string> = {
    'crue': 'inondation',
    'glissement': 'glissement de terrain',
    'avalanche': 'avalanche',
    'chute_pierres': 'chute de pierres'
  };
  
  const hazardType = typeLabels[type] || type;
  
  if (flag.severity >= 3) {
    return `⚠️ Zone de danger ${hazardType} élevé - Construction très limitée`;
  } else if (flag.severity === 2) {
    return `Zone de danger ${hazardType} moyen - Étude requise`;
  }
  
  return `Zone de danger ${hazardType} faible`;
}

/**
 * Formate un message de proximité routière
 */
function formatRoadMessage(flag: ContextFlag): string {
  const distance = flag.distance;
  
  if (distance && distance < 25) {
    return `À ${Math.round(distance)}m d'une route cantonale - Recul obligatoire`;
  } else if (distance && distance < 50) {
    return `Route cantonale à proximité (${Math.round(distance)}m)`;
  }
  
  return 'Proximité route cantonale';
}

/**
 * Formate un message de pente
 */
function formatSlopeMessage(flag: ContextFlag): string {
  const slope = flag.valueNum || 0;
  
  if (slope > 45) {
    return `⚠️ Pente très forte (${Math.round(slope)}%) - Construction complexe`;
  } else if (slope > 30) {
    return `Pente importante (${Math.round(slope)}%) - Terrassements conséquents`;
  } else if (slope > 15) {
    return `Pente modérée (${Math.round(slope)}%)`;
  }
  
  return `Terrain relativement plat (${Math.round(slope)}%)`;
}

/**
 * Détermine la priorité d'affichage d'une couche
 */
function getLayerPriority(layer: string): number {
  const priorities: Record<string, number> = {
    'risk_nat': 1,      // Plus prioritaire
    'ofac_airport': 2,
    'opb_noise': 3,
    'slope_pct': 4,
    'roads_cantonal': 5  // Moins prioritaire
  };
  
  return priorities[layer] || 99;
}

/**
 * Génère un résumé textuel complet
 */
export function generateContextSummary(flags: ContextFlag[]): string {
  if (flags.length === 0) {
    return 'Aucune contrainte environnementale particulière identifiée.';
  }

  const criticalCount = flags.filter(f => f.severity === 3).length;
  const warningCount = flags.filter(f => f.severity === 2).length;
  
  let summary = `${flags.length} contrainte(s) identifiée(s)`;
  
  if (criticalCount > 0) {
    summary += ` dont ${criticalCount} critique(s)`;
  }
  if (warningCount > 0) {
    summary += ` et ${warningCount} importante(s)`;
  }
  
  summary += '.';
  
  // Ajouter les plus critiques
  const critical = flags.filter(f => f.severity === 3);
  if (critical.length > 0) {
    summary += ' Attention particulière requise pour: ';
    summary += critical.map(f => getShortLabel(f.layer)).join(', ');
    summary += '.';
  }
  
  return summary;
}

/**
 * Retourne un label court pour une couche
 */
function getShortLabel(layer: string): string {
  const labels: Record<string, string> = {
    'opb_noise': 'bruit',
    'ofac_airport': 'aéroport',
    'risk_nat': 'dangers naturels',
    'roads_cantonal': 'route',
    'slope_pct': 'pente'
  };
  
  return labels[layer] || layer;
}

/**
 * Formate les contraintes pour export CSV
 */
export function formatContextForCSV(flags: ContextFlag[]): string {
  if (flags.length === 0) return '';
  
  return flags
    .slice(0, 3) // Limiter pour le CSV
    .map(f => `${getShortLabel(f.layer)}${f.severity >= 3 ? '!' : ''}`)
    .join('; ');
}

/**
 * Génère un objet de métadonnées enrichi
 */
export function enrichContextMetadata(flags: ContextFlag[]): any {
  const metadata: any = {
    total_constraints: flags.length,
    critical_count: flags.filter(f => f.severity === 3).length,
    warning_count: flags.filter(f => f.severity === 2).length,
    info_count: flags.filter(f => f.severity === 1).length,
    layers_affected: [...new Set(flags.map(f => f.layer))],
    max_severity: Math.max(...flags.map(f => f.severity), 0)
  };

  // Ajouter des flags spécifiques
  metadata.has_noise_issues = flags.some(f => f.layer === 'opb_noise' && f.severity >= 2);
  metadata.has_natural_hazards = flags.some(f => f.layer === 'risk_nat');
  metadata.has_slope_issues = flags.some(f => f.layer === 'slope_pct' && f.valueNum && f.valueNum > 30);
  metadata.near_infrastructure = flags.some(f => ['roads_cantonal', 'ofac_airport'].includes(f.layer));

  return metadata;
}