/**
 * Module de calcul de densité constructible spécifique au canton du Valais
 * Gère les indices U et IBUS avec le tableau de conversion, et le bonus CECB/MINERGIE.
 */

export interface ValaisDensityCalculation {
  terrainSurface: number; // m²
  indiceU?: number; // Indice U communal (parties chauffées uniquement)
  indiceIBUS?: number; // Indice IBUS calculé depuis U ou directement fourni
  
  // Calculs pour l'indice U (parties chauffées uniquement)
  surfaceUtileU?: number; // Surface constructible avec indice U (sans parties non chauffées)
  
  // Calculs pour l'indice IBUS (toutes surfaces)
  surfaceUtileIBUS?: number; // Surface constructible avec indice IBUS (toutes surfaces)
  
  // Bonus énergétiques
  bonusCECB: boolean; // Projet certifié CECB
  bonusMINERGIE: boolean; // Projet certifié MINERGIE
  bonusPercentage: number; // Pourcentage de bonus (0% ou 10%)
  
  // Surfaces finales avec bonus
  surfaceUtileUAvecBonus?: number;
  surfaceUtileIBUSAvecBonus?: number;
  
  // Métadonnées
  tableauConversionUtilise: boolean;
  commune: string;
  warnings: string[];
}

/**
 * Tableau de conversion entre l'indice U et l'indice IBUS pour le Valais
 * Source: Annexe 1 - Tableau de conversion fourni par l'utilisateur
 */
export const TABLEAU_CONVERSION_U_IBUS: Record<number, number> = {
  0.35: 0.5,
  0.40: 0.53,
  0.45: 0.60,
  0.50: 0.67,
  0.55: 0.73,
  0.60: 0.80,
  0.65: 0.87,
  0.70: 0.93,
  0.75: 1.0,
  0.80: 1.07,
  0.85: 1.13
};

/**
 * Trouve l'indice IBUS correspondant à un indice U donné
 * Utilise le tableau de conversion officiel du Valais
 */
export function convertirUVersIBUS(indiceU: number): number | null {
  // Recherche exacte d'abord
  if (TABLEAU_CONVERSION_U_IBUS[indiceU]) {
    return TABLEAU_CONVERSION_U_IBUS[indiceU];
  }
  
  // Interpolation linéaire si la valeur exacte n'existe pas
  const indices = Object.keys(TABLEAU_CONVERSION_U_IBUS).map(k => parseFloat(k)).sort((a, b) => a - b);
  
  // Vérifier les limites
  if (indiceU < indices[0]) {
    return TABLEAU_CONVERSION_U_IBUS[indices[0]]; // Valeur minimale
  }
  if (indiceU > indices[indices.length - 1]) {
    return TABLEAU_CONVERSION_U_IBUS[indices[indices.length - 1]]; // Valeur maximale
  }
  
  // Interpolation entre deux valeurs
  for (let i = 0; i < indices.length - 1; i++) {
    const u1 = indices[i];
    const u2 = indices[i + 1];
    
    if (indiceU >= u1 && indiceU <= u2) {
      const ibus1 = TABLEAU_CONVERSION_U_IBUS[u1];
      const ibus2 = TABLEAU_CONVERSION_U_IBUS[u2];
      
      // Interpolation linéaire
      const ratio = (indiceU - u1) / (u2 - u1);
      return ibus1 + ratio * (ibus2 - ibus1);
    }
  }
  
  return null;
}

/**
 * Calcule les surfaces constructibles selon les règles valaisannes
 */
export function calculerDensiteValais(params: {
  terrainSurface: number;
  indiceU?: number;
  indiceIBUS?: number;
  commune: string;
  projetCECB?: boolean;
  projetMINERGIE?: boolean;
}): ValaisDensityCalculation {
  
  const result: ValaisDensityCalculation = {
    terrainSurface: params.terrainSurface,
    indiceU: params.indiceU,
    indiceIBUS: params.indiceIBUS,
    bonusCECB: params.projetCECB || false,
    bonusMINERGIE: params.projetMINERGIE || false,
    bonusPercentage: 0,
    tableauConversionUtilise: false,
    commune: params.commune,
    warnings: []
  };
  
  // Calculer le bonus énergétique
  if (result.bonusCECB || result.bonusMINERGIE) {
    result.bonusPercentage = 10; // +10% selon les règles valaisannes
  }
  
  // Calcul avec l'indice U (parties chauffées uniquement)
  if (params.indiceU) {
    result.surfaceUtileU = params.terrainSurface * params.indiceU;
    
    // Conversion automatique vers IBUS si pas fourni
    if (!params.indiceIBUS) {
      const ibusConverti = convertirUVersIBUS(params.indiceU);
      if (ibusConverti) {
        result.indiceIBUS = ibusConverti;
        result.tableauConversionUtilise = true;
        result.warnings.push(`Indice IBUS calculé automatiquement depuis U (${params.indiceU}) = ${ibusConverti.toFixed(2)}`);
      }
    }
  }
  
  // Calcul avec l'indice IBUS (toutes surfaces)
  if (result.indiceIBUS) {
    result.surfaceUtileIBUS = params.terrainSurface * result.indiceIBUS;
  }
  
  // Application du bonus énergétique
  if (result.bonusPercentage > 0) {
    const facteurBonus = 1 + (result.bonusPercentage / 100);
    
    if (result.surfaceUtileU) {
      result.surfaceUtileUAvecBonus = result.surfaceUtileU * facteurBonus;
    }
    
    if (result.surfaceUtileIBUS) {
      result.surfaceUtileIBUSAvecBonus = result.surfaceUtileIBUS * facteurBonus;
    }
    
    const certifications = [];
    if (result.bonusCECB) certifications.push('CECB');
    if (result.bonusMINERGIE) certifications.push('MINERGIE');
    
    result.warnings.push(`Bonus énergétique appliqué (+${result.bonusPercentage}%) pour certification ${certifications.join(' et ')}`);
  }
  
  // Validation et warnings
  if (!params.indiceU && !params.indiceIBUS) {
    result.warnings.push('Aucun indice de construction fourni - impossible de calculer la densité');
  }
  
  if (params.terrainSurface <= 0) {
    result.warnings.push('Surface de terrain invalide');
  }
  
  return result;
}

/**
 * Formate les résultats de calcul pour l'affichage
 */
export function formaterResultatsValais(calcul: ValaisDensityCalculation): string {
  let resultat = `## 📏 Analyse de la densité constructible (Valais)\n\n`;
  
  resultat += `**Terrain:** ${calcul.terrainSurface.toLocaleString('fr-CH')} m² (${calcul.commune})\n\n`;
  
  // Indice U (parties chauffées uniquement)
  if (calcul.indiceU && calcul.surfaceUtileU) {
    resultat += `### 🏠 Indice U (parties chauffées uniquement)\n`;
    resultat += `- **Indice U:** ${calcul.indiceU}\n`;
    resultat += `- **Surface constructible (base):** ${Math.round(calcul.surfaceUtileU).toLocaleString('fr-CH')} m²\n`;
    resultat += `- **Surface constructible (avec bonus):** ${calcul.surfaceUtileUAvecBonus ? Math.round(calcul.surfaceUtileUAvecBonus).toLocaleString('fr-CH') + ' m²' : 'Non applicable'}\n`;
    resultat += `- *Exclut: parkings, locaux techniques, parties non chauffées*\n\n`;
  }
  
  // Indice IBUS (toutes surfaces)
  if (calcul.indiceIBUS && calcul.surfaceUtileIBUS) {
    resultat += `### 🏢 Indice IBUS (toutes surfaces)\n`;
    resultat += `- **Indice IBUS:** ${calcul.indiceIBUS.toFixed(2)}\n`;
    resultat += `- **Surface constructible (base):** ${Math.round(calcul.surfaceUtileIBUS).toLocaleString('fr-CH')} m²\n`;
    resultat += `- **Surface constructible (avec bonus):** ${calcul.surfaceUtileIBUSAvecBonus ? Math.round(calcul.surfaceUtileIBUSAvecBonus).toLocaleString('fr-CH') + ' m²' : 'Non applicable'}\n`;
    resultat += `- *Inclut: toutes surfaces, même non chauffées (parkings, caves, etc.)*\n\n`;
  }
  
  // Bonus énergétique
  if (calcul.bonusPercentage > 0) {
    resultat += `### 🌱 Bonus énergétique\n`;
    resultat += `- **Bonus applicable:** +${calcul.bonusPercentage}% de densité constructible\n`;
    resultat += `- **Certifications:** ${[calcul.bonusCECB ? 'CECB' : '', calcul.bonusMINERGIE ? 'MINERGIE' : ''].filter(Boolean).join(', ')}\n\n`;
  }
  
  // Tableau de conversion utilisé
  if (calcul.tableauConversionUtilise) {
    resultat += `### 📋 Conversion automatique\n`;
    resultat += `L'indice IBUS a été calculé automatiquement à partir de l'indice U selon le tableau de conversion officiel du Valais.\n\n`;
  }
  
  // Exemple concret
  if (calcul.surfaceUtileU || calcul.surfaceUtileIBUS) {
    resultat += `### 💡 Exemple concret\n`;
    if (calcul.surfaceUtileU) {
      resultat += `Pour un projet avec indice U: vous pouvez construire **${Math.round(calcul.surfaceUtileUAvecBonus || calcul.surfaceUtileU).toLocaleString('fr-CH')} m²** de surface de plancher utile (parties chauffées).\n`;
    }
    if (calcul.surfaceUtileIBUS) {
      resultat += `Pour un projet avec indice IBUS: vous pouvez construire **${Math.round(calcul.surfaceUtileIBUSAvecBonus || calcul.surfaceUtileIBUS).toLocaleString('fr-CH')} m²** de surface brute totale (incluant parkings, caves, etc.).\n`;
    }
    resultat += `\n`;
  }
  
  // Warnings
  if (calcul.warnings.length > 0) {
    resultat += `### ⚠️ Notes importantes\n`;
    calcul.warnings.forEach(warning => {
      resultat += `- ${warning}\n`;
    });
    resultat += `\n`;
  }
  
  return resultat;
}

/**
 * Extrait les indices de construction depuis le texte d'un règlement
 */
export function extraireIndicesReglement(texteReglement: string): { indiceU?: number; indiceIBUS?: number } {
  const result: { indiceU?: number; indiceIBUS?: number } = {};
  
  // Patterns pour extraire les indices
  const patternU = /indice\s+u[^0-9]*([0-9]+[.,][0-9]+)/gi;
  const patternIBUS = /ibus[^0-9]*([0-9]+[.,][0-9]+)/gi;
  
  // Recherche indice U
  const matchU = patternU.exec(texteReglement);
  if (matchU) {
    result.indiceU = parseFloat(matchU[1].replace(',', '.'));
  }
  
  // Recherche indice IBUS
  const matchIBUS = patternIBUS.exec(texteReglement);
  if (matchIBUS) {
    result.indiceIBUS = parseFloat(matchIBUS[1].replace(',', '.'));
  }
  
  return result;
} 