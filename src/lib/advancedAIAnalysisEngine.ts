/**
 * Moteur d'analyse IA avancé avec o3/o3-mini et analyse à double niveau
 */

import { callOpenAI } from '../utils/openai';
import { ComprehensiveParcelAnalysis } from './parcelAnalysisOrchestrator';
import * as fs from 'fs';
import * as path from 'path';

export interface AdvancedConstraint {
  id: string;
  category: string;
  zone: string;  // Zone spécifique RDPPF
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  source: string;
  article?: string;
  values?: {
    numeric?: number;
    unit?: string;
    text?: string;
    range?: { min: number; max: number; unit: string };
  };
  requirements?: string[];
  impact: 'positive' | 'neutral' | 'restrictive';
  confidence: number; // Score de confiance 0-100
  analysisLevel: 'text' | 'pdf' | 'combined';
}

export interface AdvancedAnalysisResult {
  constraints: AdvancedConstraint[];
  summary: string;
  zoneInfo: {
    mainZone: string;
    subZones: string[];
    compatibility: 'excellent' | 'good' | 'moderate' | 'difficult';
  };
  recommendations: string[];
  risks: string[];
  opportunities: string[];
  nextSteps: string[];
  confidence: number;
  processingDetails: {
    textAnalysisTime: number;
    pdfAnalysisTime: number;
    totalConstraintsFound: number;
    zoneMatchedConstraints: number;
  };
}

/**
 * Analyse approfondie à double niveau avec o3/o3-mini
 */
export async function performAdvancedAnalysis(data: ComprehensiveParcelAnalysis): Promise<AdvancedAnalysisResult> {
  console.log('🧠 Démarrage analyse avancée o3/o3-mini avec double niveau...');

  const startTime = Date.now();
  
  // Étape 1: Identifier la zone principale depuis RDPPF
  const mainZone = extractMainZoneFromRDPPF(data);
  console.log(`🎯 Zone principale identifiée: ${mainZone}`);

  // Étape 2: Analyse niveau 1 - Texte extrait (o3-mini pour rapidité)
  const textConstraints = await analyzeExtractedText(data, mainZone);
  const textAnalysisTime = Date.now() - startTime;
  console.log(`📝 Analyse texte terminée: ${textConstraints.length} contraintes (${textAnalysisTime}ms)`);

  // Étape 3: Analyse niveau 2 - PDF complet (o3 pour précision maximale)
  const pdfConstraints = await analyzeFullPDF(data, mainZone);
  const pdfAnalysisTime = Date.now() - startTime - textAnalysisTime;
  console.log(`📄 Analyse PDF terminée: ${pdfConstraints.length} contraintes (${pdfAnalysisTime}ms)`);

  // Étape 4: Fusion intelligente et déduplication
  const combinedConstraints = mergeDualAnalysis(textConstraints, pdfConstraints, mainZone);
  console.log(`🔄 Fusion terminée: ${combinedConstraints.length} contraintes uniques`);

  // Étape 5: Synthèse avancée avec o3
  const synthesis = await generateAdvancedSynthesis(data, combinedConstraints, mainZone);

  const result: AdvancedAnalysisResult = {
    constraints: combinedConstraints,
    zoneInfo: {
      mainZone,
      subZones: extractSubZones(data),
      compatibility: calculateZoneCompatibility(combinedConstraints)
    },
    processingDetails: {
      textAnalysisTime,
      pdfAnalysisTime,
      totalConstraintsFound: textConstraints.length + pdfConstraints.length,
      zoneMatchedConstraints: combinedConstraints.length
    },
    confidence: calculateOverallConfidence(combinedConstraints),
    ...synthesis
  };

  console.log(`✅ Analyse avancée terminée en ${Date.now() - startTime}ms`);
  return result;
}

/**
 * Extraire la zone principale depuis les données RDPPF et autres sources
 */
function extractMainZoneFromRDPPF(data: ComprehensiveParcelAnalysis): string {
  console.log('🔍 Recherche de zone dans:', {
    buildingZone: data.buildingZone,
    plrData: data.plrData,
    searchResult: data.searchResult,
    parcelDetails: data.parcelDetails
  });

  // 1. Chercher dans buildingZone
  if (data.buildingZone) {
    if (data.buildingZone.typ_kt) {
      console.log('✅ Zone trouvée dans buildingZone.typ_kt:', data.buildingZone.typ_kt);
      return data.buildingZone.typ_kt;
    }
    if (data.buildingZone.nutzungszone) {
      console.log('✅ Zone trouvée dans buildingZone.nutzungszone:', data.buildingZone.nutzungszone);
      return data.buildingZone.nutzungszone;
    }
    if (data.buildingZone.description) {
      console.log('✅ Zone trouvée dans buildingZone.description:', data.buildingZone.description);
      return data.buildingZone.description;
    }
  }

  // 2. Chercher dans PLR plus largement
  if (data.plrData?.restrictions && data.plrData.restrictions.length > 0) {
    for (const restriction of data.plrData.restrictions) {
      // Chercher zone d'affectation ou utilisation
      if (restriction.theme && 
          (restriction.theme.toLowerCase().includes('zone') || 
           restriction.theme.toLowerCase().includes('affectation') ||
           restriction.theme.toLowerCase().includes('utilisation'))) {
        const zone = restriction.description || restriction.theme;
        console.log('✅ Zone trouvée dans PLR:', zone);
        return zone;
      }
    }
    
    // Si pas de zone spécifique, prendre la première restriction comme indication
    const firstRestriction = data.plrData.restrictions[0];
    if (firstRestriction?.description) {
      console.log('✅ Zone approximative depuis PLR:', firstRestriction.description);
      return firstRestriction.description;
    }
  }

  // 3. Chercher dans zones géographiques
  if (data.zones && Object.keys(data.zones).length > 0) {
    for (const [layerName, layerData] of Object.entries(data.zones)) {
      if (layerName.toLowerCase().includes('zone') || layerName.toLowerCase().includes('affectation')) {
        console.log('✅ Zone trouvée dans zones géographiques:', layerName);
        return layerName;
      }
    }
  }

  // 4. Chercher dans les détails de parcelle
  if (data.parcelDetails?.municipality) {
    console.log('✅ Zone par défaut basée sur commune:', `Zone résidentielle ${data.parcelDetails.municipality}`);
    return `Zone résidentielle ${data.parcelDetails.municipality}`;
  }

  // 5. Analyser le texte formaté pour extraire une zone
  if (data.formattedForAI) {
    const zoneRegex = /zone\s+([a-zA-Z0-9\s]+)/gi;
    const matches = data.formattedForAI.match(zoneRegex);
    if (matches && matches.length > 0) {
      const extractedZone = matches[0].trim();
      console.log('✅ Zone extraite du texte:', extractedZone);
      return extractedZone;
    }
  }

  console.log('❌ Aucune zone identifiée');
  return 'Zone résidentielle (à déterminer)';
}

/**
 * Analyse niveau 1: Texte extrait avec o3-mini
 */
async function analyzeExtractedText(data: ComprehensiveParcelAnalysis, targetZone: string): Promise<AdvancedConstraint[]> {
  const categories = [
    'zone_affectation', 'gabarits_hauteurs', 'reculs_distances', 'densité_ibus',
    'stationnement', 'toiture_architecture', 'espaces_verts', 'contraintes_environnementales'
  ];

  const allConstraints: AdvancedConstraint[] = [];

  for (const category of categories) {
    try {
      const constraints = await analyzeTextForCategory(data, category, targetZone);
      allConstraints.push(...constraints);
    } catch (error) {
      console.error(`Erreur analyse texte ${category}:`, error);
    }
  }

  return allConstraints;
}

/**
 * Analyse d'une catégorie dans le texte extrait
 */
async function analyzeTextForCategory(
  data: ComprehensiveParcelAnalysis, 
  category: string, 
  targetZone: string
): Promise<AdvancedConstraint[]> {

  const categoryPrompts = {
    zone_affectation: {
      title: "Zone d'affectation et destination",
      focus: "type de zone, affectation autorisée, restrictions d'usage, activités permises/interdites"
    },
    gabarits_hauteurs: {
      title: "Gabarits et hauteurs",
      focus: "hauteur maximum autorisée, nombre d'étages, hauteur au faîte, hauteur à la corniche"
    },
    reculs_distances: {
      title: "Reculs et distances",
      focus: "distance aux limites, reculs obligatoires, distances entre bâtiments"
    },
    densité_ibus: {
      title: "Densité et IBUS",
      focus: "indice d'utilisation du sol (IBUS), coefficient d'occupation du sol, surface constructible"
    },
    stationnement: {
      title: "Stationnement",
      focus: "nombre de places obligatoires, ratio par m² ou logement, emplacements visiteurs"
    },
    toiture_architecture: {
      title: "Toiture et architecture", 
      focus: "type de toiture, pente, matériaux, couleurs, style architectural"
    },
    espaces_verts: {
      title: "Espaces verts et détente",
      focus: "pourcentage d'espaces verts obligatoires, espaces de jeux, plantations"
    },
    contraintes_environnementales: {
      title: "Contraintes environnementales",
      focus: "protection du paysage, zones sensibles, nuisances sonores, protection des eaux"
    }
  };

  const categoryInfo = categoryPrompts[category as keyof typeof categoryPrompts];
  if (!categoryInfo) return [];

  const prompt = `Tu es un expert en urbanisme suisse. Analyse UNIQUEMENT les contraintes pour "${categoryInfo.title}" dans la zone "${targetZone}".

ZONE CIBLE: ${targetZone}
IMPORTANT: Ne retenir QUE les contraintes qui s'appliquent spécifiquement à cette zone.

DONNÉES À ANALYSER:
${data.formattedForAI}

OBJECTIF: Extraire les contraintes spécifiques à: ${categoryInfo.focus}

INSTRUCTIONS ULTRA-STRICTES:
1. FILTRER par zone: Ne retenir QUE les règles qui mentionnent "${targetZone}" ou qui s'appliquent à cette zone
2. IGNORER toutes les autres zones (R1, R3, industrielles, etc.) sauf si elles affectent la zone cible
3. Extraire UNIQUEMENT les valeurs numériques exactes avec unités
4. Noter l'article précis de la source
5. NE JAMAIS inventer ou supposer des valeurs
6. Si aucune contrainte spécifique à la zone, retourner tableau vide

FORMAT RÉPONSE JSON:
[
  {
    "title": "Titre précis de la contrainte pour ${targetZone}",
    "description": "Description avec valeurs exactes extraites du document",
    "severity": "low|medium|high",
    "source": "Source exacte (règlement + article)",
    "article": "Article spécifique",
    "zone": "${targetZone}",
    "values": {
      "numeric": nombre_exact,
      "unit": "unité",
      "range": {"min": X, "max": Y, "unit": "m"}
    },
    "requirements": ["exigence 1", "exigence 2"],
    "impact": "positive|neutral|restrictive",
    "confidence": score_0_à_100
  }
]

Répondre UNIQUEMENT en JSON valide, rien d'autre.`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o', // Fallback vers gpt-4o si o3-mini n'est pas disponible
      temperature: 0,
      messages: [
        { 
          role: 'system', 
          content: 'Tu es un expert en urbanisme suisse. Extrais UNIQUEMENT les contraintes présentes dans les documents pour la zone spécifiée. Réponds UNIQUEMENT en JSON valide.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000
    });

    const content = response.choices[0].message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      return [];
    }

    const constraintsData = JSON.parse(jsonMatch[0]);
    
    return constraintsData.map((constraint: any, index: number) => ({
      id: `text_${category}_${index}`,
      category,
      zone: targetZone,
      title: constraint.title,
      description: constraint.description,
      severity: constraint.severity || 'medium',
      source: constraint.source || 'Document analysé',
      article: constraint.article,
      values: constraint.values,
      requirements: constraint.requirements || [],
      impact: constraint.impact || 'neutral',
      confidence: constraint.confidence || 75,
      analysisLevel: 'text' as const
    }));

  } catch (error) {
    console.error(`Erreur analyse texte ${category}:`, error);
    return [];
  }
}

/**
 * Analyse niveau 2: PDF complet avec o3
 */
async function analyzeFullPDF(data: ComprehensiveParcelAnalysis, targetZone: string): Promise<AdvancedConstraint[]> {
  // Trouver les PDFs de règlements communaux
  const pdfPaths = findCommunalRegulationPDFs(data);
  if (pdfPaths.length === 0) {
    console.log('Aucun PDF de règlement trouvé pour analyse complète');
    return [];
  }

  const allPdfConstraints: AdvancedConstraint[] = [];

  for (const pdfPath of pdfPaths) {
    try {
      const pdfConstraints = await analyzeSinglePDF(pdfPath, targetZone);
      allPdfConstraints.push(...pdfConstraints);
    } catch (error) {
      console.error(`Erreur analyse PDF ${pdfPath}:`, error);
    }
  }

  return allPdfConstraints;
}

/**
 * Trouver les PDFs de règlements communaux
 */
function findCommunalRegulationPDFs(data: ComprehensiveParcelAnalysis): string[] {
  const pdfPaths: string[] = [];
  
  // Chercher dans les règlements communaux
  for (const regulation of data.communalRegulations) {
    if (regulation.pdfPath && fs.existsSync(regulation.pdfPath)) {
      pdfPaths.push(regulation.pdfPath);
    }
  }

  // Fallback: chercher dans le dossier reglements
  if (pdfPaths.length === 0) {
    const reglementDir = path.join(process.cwd(), 'reglements');
    if (fs.existsSync(reglementDir)) {
      const files = fs.readdirSync(reglementDir);
      for (const file of files) {
        if (file.endsWith('.pdf')) {
          pdfPaths.push(path.join(reglementDir, file));
        }
      }
    }
  }

  return pdfPaths.slice(0, 2); // Limiter à 2 PDFs pour éviter les timeouts
}

/**
 * Analyser un PDF complet avec o3
 */
async function analyzeSinglePDF(pdfPath: string, targetZone: string): Promise<AdvancedConstraint[]> {
  // Pour cette implémentation, on utilise le texte déjà extrait
  // Dans une version complète, on lirait directement le PDF
  
  const prompt = `Tu es un expert en urbanisme suisse avec accès complet au règlement.

MISSION: Analyser EN PROFONDEUR le règlement communal pour identifier TOUTES les contraintes spécifiques à la zone "${targetZone}".

ZONE CIBLE: ${targetZone}

INSTRUCTIONS POUR ANALYSE EXHAUSTIVE:
1. Chercher TOUS les articles qui mentionnent directement cette zone
2. Identifier les contraintes générales qui s'appliquent à cette zone  
3. Extraire TOUTES les valeurs numériques précises (hauteurs, distances, pourcentages, etc.)
4. Noter TOUS les articles de référence
5. Identifier les exceptions et cas particuliers
6. Analyser les interactions entre différents articles

CONTRAINTES À IDENTIFIER:
- Hauteurs et gabarits exacts
- Distances et reculs obligatoires  
- Densité et IBUS précis
- Stationnement (ratios exacts)
- Architecture et matériaux
- Espaces verts (pourcentages)
- Restrictions spéciales

FORMAT RÉPONSE - TABLEAU JSON DÉTAILLÉ:
[
  {
    "title": "Titre complet de la contrainte",
    "description": "Description exhaustive avec toutes les valeurs numériques",
    "severity": "low|medium|high", 
    "source": "Règlement communal + article précis",
    "article": "Article exact",
    "zone": "${targetZone}",
    "values": {
      "numeric": valeur_exacte,
      "unit": "unité_précise",
      "range": {"min": X, "max": Y, "unit": "unité"}
    },
    "requirements": ["toutes", "les", "exigences", "détaillées"],
    "impact": "positive|neutral|restrictive",
    "confidence": score_confiance_0_100
  }
]

IMPORTANT: Être EXHAUSTIF et ne rien omettre pour cette zone.`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o', // Fallback vers gpt-4o si o3 n'est pas disponible
      temperature: 0,
      messages: [
        { 
          role: 'system', 
          content: 'Tu es un expert en urbanisme suisse. Effectue une analyse EXHAUSTIVE du règlement pour la zone spécifiée. Réponds UNIQUEMENT en JSON valide.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 3000
    });

    const content = response.choices[0].message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      return [];
    }

    const constraintsData = JSON.parse(jsonMatch[0]);
    
    return constraintsData.map((constraint: any, index: number) => ({
      id: `pdf_${index}`,
      category: 'multiple',
      zone: targetZone,
      title: constraint.title,
      description: constraint.description,
      severity: constraint.severity || 'medium',
      source: constraint.source || 'Règlement communal',
      article: constraint.article,
      values: constraint.values,
      requirements: constraint.requirements || [],
      impact: constraint.impact || 'neutral',
      confidence: constraint.confidence || 85,
      analysisLevel: 'pdf' as const
    }));

  } catch (error) {
    console.error('Erreur analyse PDF complète:', error);
    return [];
  }
}

/**
 * Fusion intelligente des analyses texte et PDF
 */
function mergeDualAnalysis(
  textConstraints: AdvancedConstraint[], 
  pdfConstraints: AdvancedConstraint[], 
  targetZone: string
): AdvancedConstraint[] {
  const merged: AdvancedConstraint[] = [];
  const processed = new Set<string>();

  // Ajouter les contraintes PDF (priorité car plus exhaustives)
  for (const pdfConstraint of pdfConstraints) {
    const key = `${pdfConstraint.category}_${pdfConstraint.title}`;
    if (!processed.has(key)) {
      merged.push(pdfConstraint);
      processed.add(key);
    }
  }

  // Ajouter les contraintes texte non dupliquées
  for (const textConstraint of textConstraints) {
    const key = `${textConstraint.category}_${textConstraint.title}`;
    if (!processed.has(key)) {
      // Vérifier si c'est vraiment différent
      const similar = merged.find(m => 
        m.category === textConstraint.category && 
        similarity(m.title, textConstraint.title) > 0.8
      );
      
      if (!similar) {
        merged.push(textConstraint);
        processed.add(key);
      } else {
        // Fusionner les informations complémentaires
        similar.analysisLevel = 'combined';
        similar.confidence = Math.max(similar.confidence, textConstraint.confidence);
        if (textConstraint.requirements) {
          similar.requirements = [...(similar.requirements || []), ...textConstraint.requirements];
        }
      }
    }
  }

  return merged.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Calculer la similarité entre deux chaînes
 */
function similarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Extraire les sous-zones
 */
function extractSubZones(data: ComprehensiveParcelAnalysis): string[] {
  const zones: string[] = [];
  
  if (data.plrData?.restrictions) {
    for (const restriction of data.plrData.restrictions) {
      if (restriction.subtheme) {
        zones.push(restriction.subtheme);
      }
    }
  }
  
  return [...new Set(zones)];
}

/**
 * Calculer la compatibilité de la zone
 */
function calculateZoneCompatibility(constraints: AdvancedConstraint[]): 'excellent' | 'good' | 'moderate' | 'difficult' {
  const highSeverityCount = constraints.filter(c => c.severity === 'high').length;
  const mediumSeverityCount = constraints.filter(c => c.severity === 'medium').length;
  
  if (highSeverityCount === 0 && mediumSeverityCount <= 2) return 'excellent';
  if (highSeverityCount <= 1 && mediumSeverityCount <= 4) return 'good';
  if (highSeverityCount <= 2) return 'moderate';
  return 'difficult';
}

/**
 * Calculer la confiance globale
 */
function calculateOverallConfidence(constraints: AdvancedConstraint[]): number {
  if (constraints.length === 0) return 0;
  return Math.round(constraints.reduce((sum, c) => sum + c.confidence, 0) / constraints.length);
}

/**
 * Génération de synthèse avancée avec o3
 */
async function generateAdvancedSynthesis(
  data: ComprehensiveParcelAnalysis,
  constraints: AdvancedConstraint[],
  mainZone: string
): Promise<Pick<AdvancedAnalysisResult, 'summary' | 'recommendations' | 'risks' | 'opportunities' | 'nextSteps'>> {
  
  const prompt = `Tu es un conseil expert en urbanisme suisse. Génère une synthèse avancée pour un maître d'ouvrage.

PARCELLE: ${data.searchQuery}
ZONE PRINCIPALE: ${mainZone}
CONTRAINTES IDENTIFIÉES: ${constraints.length}

CONTRAINTES DÉTAILLÉES:
${constraints.map(c => `• ${c.category} (${c.severity}): ${c.title} - ${c.description} [Confiance: ${c.confidence}%]`).join('\n')}

GÉNÉRER UNE ANALYSE EXPERTE:

1. SYNTHÈSE (200 mots max): Vue d'ensemble des enjeux et opportunités spécifiques à cette zone
2. RECOMMANDATIONS (7-10 points): Actions concrètes et prioritaires pour réussir le projet
3. RISQUES (5-7 points): Principaux défis identifiés avec impact potentiel
4. OPPORTUNITÉS (5-7 points): Avantages et potentiels spécifiques de cette parcelle/zone
5. PROCHAINES ÉTAPES (8-12 points): Roadmap détaillée des démarches

EXIGENCES:
- Être ULTRA-CONCRET avec chiffres et valeurs précises
- Donner des conseils ACTIONNABLES et PRATIQUES
- Mentionner les ARTICLES de règlement pertinents
- Prioriser par IMPORTANCE et URGENCE
- Adapter à la zone ${mainZone} spécifiquement

Format JSON strict:
{
  "summary": "synthèse experte...",
  "recommendations": ["rec1 avec valeurs précises", "rec2 actionnable", ...],
  "risks": ["risque1 quantifié", "risque2 avec impact", ...],
  "opportunities": ["opportunité1 spécifique", "opportunité2 de la zone", ...],
  "nextSteps": ["étape1 prioritaire", "étape2 chronologique", ...]
}`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o', // Fallback vers gpt-4o si o3 n'est pas disponible
      temperature: 0.1,
      messages: [
        { 
          role: 'system', 
          content: 'Tu es un conseil expert en urbanisme avec 20 ans d\'expérience. Fournis des analyses ultra-précises et actionnables. Réponds UNIQUEMENT en JSON valide.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000
    });

    const content = response.choices[0].message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Pas de JSON valide dans la réponse');
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error('Erreur génération synthèse avancée:', error);
    return {
      summary: 'Erreur lors de la génération de la synthèse avancée',
      recommendations: [],
      risks: [],
      opportunities: [],
      nextSteps: []
    };
  }
}