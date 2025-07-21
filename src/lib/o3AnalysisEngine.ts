/**
 * Moteur d'analyse IA optimisé pour OpenAI o3 avec double analyse (texte + PDF)
 * Conçu pour maximiser les capacités de raisonnement d'o3
 */

import { callOpenAI } from '../utils/openai';
import { ComprehensiveParcelAnalysis } from './parcelAnalysisOrchestrator';
// import { filterAndPrioritizeConstraints, generateConstraintSummary } from './constraintFilter';
import * as fs from 'fs/promises';
import * as path from 'path';
const pdf = require('pdf-parse');

export interface O3Constraint {
  id: string;
  category: string;
  zone: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  article?: string;
  values?: {
    numeric?: number;
    unit?: string;
    text?: string;
    range?: { min: number; max: number; unit: string };
    formula?: string; // Pour les calculs complexes
  };
  requirements?: string[];
  impact: 'positive' | 'neutral' | 'restrictive' | 'blocking';
  confidence: number; // 0-100
  analysisLevel: 'text' | 'pdf' | 'combined' | 'enhanced';
  reasoning?: string; // Chaîne de raisonnement o3
  crossReferences?: string[]; // Références croisées vers d'autres articles
}

export interface O3AnalysisResult {
  constraints: O3Constraint[];
  summary: {
    executive: string;
    technical: string;
    practical: string;
  };
  zoneAnalysis: {
    mainZone: string;
    subZones: string[];
    compatibility: 'excellent' | 'good' | 'moderate' | 'difficult' | 'incompatible';
    potentialUsages: string[];
    prohibitedUsages: string[];
  };
  calculations: {
    maxBuildableArea?: number;
    maxHeight?: number;
    requiredGreenSpace?: number;
    parkingSpaces?: number;
    constructionDensity?: number;
  };
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    reason: string;
    timeline?: string;
  }[];
  risks: {
    level: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    mitigation: string;
    probability: number; // 0-100
  }[];
  opportunities: {
    type: string;
    description: string;
    potential: 'high' | 'medium' | 'low';
    requirements?: string[];
  }[];
  nextSteps: {
    phase: string;
    tasks: string[];
    duration: string;
    dependencies?: string[];
  }[];
  confidence: number;
  processingMetrics: {
    textAnalysisTime: number;
    pdfAnalysisTime: number;
    reasoningDepth: number;
    totalConstraints: number;
    highConfidenceConstraints: number;
    crossReferencesFound: number;
  };
}

/**
 * Analyse avancée avec o3 - Double niveau optimisé
 */
export async function performO3Analysis(data: ComprehensiveParcelAnalysis): Promise<O3AnalysisResult> {
  console.log('🧠 Démarrage analyse o3 avancée avec raisonnement profond...');
  
  const startTime = Date.now();
  
  // Étape 1: Extraction et analyse de zone enrichie
  const zoneContext = await extractEnhancedZoneContext(data);
  console.log(`🎯 Contexte de zone enrichi: ${zoneContext.mainZone} avec ${zoneContext.relatedZones.length} zones liées`);
  
  // Étape 2: Analyse spécifique du PDF RDPPF
  console.log('📋 Étape 1/4: Analyse du texte extrait du PDF RDPPF...');
  const rdppfAnalysis = await analyzeRDPPFPDF(data, zoneContext);
  
  // Étape 3: Analyse spécifique du PDF du règlement communal
  console.log('📘 Étape 2/4: Analyse du texte extrait du PDF du règlement communal...');
  const reglementAnalysis = await analyzeReglementPDF(data, zoneContext);
  
  // Étape 4: Analyse combinée des deux PDFs
  console.log('🔄 Étape 3/4: Analyse combinée des deux PDFs dans leur ensemble...');
  const combinedPDFAnalysis = await analyzeCombinedPDFs(rdppfAnalysis, reglementAnalysis, data, zoneContext);
  
  // Étape 5: Synthèse intelligente avec o3
  console.log('📝 Étape 4/4: Synthèse intelligente avec le modèle o3...');
  const textAnalysis = await performO3TextAnalysis(data, zoneContext);
  const textTime = Date.now() - startTime;
  
  // Fusionner toutes les analyses
  const allConstraints = [
    ...rdppfAnalysis,
    ...reglementAnalysis,
    ...combinedPDFAnalysis,
    ...textAnalysis
  ];
  const pdfTime = Date.now() - startTime - textTime;
  
  // Étape 6: Fusion et enrichissement avec raisonnement croisé
  console.log('🔄 Fusion et enrichissement des analyses...');
  const enrichedConstraints = await mergeAndEnrichAnalyses(textAnalysis, allConstraints, zoneContext);
  
  // Étape 5: Calculs avancés et modélisation
  console.log('📊 Calculs et modélisation...');
  const calculations = await performAdvancedCalculations(enrichedConstraints, data);
  
  // Étape 6: Synthèse stratégique avec o3
  console.log('📋 Génération synthèse stratégique o3...');
  const synthesis = await generateO3StrategicSynthesis(data, enrichedConstraints, calculations, zoneContext);
  
  // TODO: Réactiver le filtrage des contraintes
  // const filteredConstraints = filterAndPrioritizeConstraints(
  //   enrichedConstraints,
  //   data.rdppfData,
  //   false
  // );
  
  const result: O3AnalysisResult = {
    constraints: enrichedConstraints,
    summary: synthesis.summary,
    zoneAnalysis: {
      mainZone: zoneContext.mainZone,
      subZones: zoneContext.relatedZones,
      compatibility: calculateEnhancedCompatibility(enrichedConstraints),
      potentialUsages: zoneContext.potentialUsages,
      prohibitedUsages: zoneContext.prohibitedUsages
    },
    calculations,
    recommendations: synthesis.recommendations,
    risks: synthesis.risks,
    opportunities: synthesis.opportunities,
    nextSteps: synthesis.nextSteps,
    confidence: calculateO3Confidence(enrichedConstraints, synthesis),
    processingMetrics: {
      textAnalysisTime: textTime,
      pdfAnalysisTime: pdfTime,
      reasoningDepth: enrichedConstraints.filter(c => c.reasoning).length,
      totalConstraints: enrichedConstraints.length,
      highConfidenceConstraints: enrichedConstraints.filter(c => c.confidence >= 85).length,
      crossReferencesFound: enrichedConstraints.reduce((sum, c) => sum + (c.crossReferences?.length || 0), 0)
    }
  };
  
  console.log(`✅ Analyse o3 terminée en ${Date.now() - startTime}ms avec ${result.constraints.length} contraintes`);
  return result;
}

/**
 * Extraction enrichie du contexte de zone
 */
async function extractEnhancedZoneContext(data: ComprehensiveParcelAnalysis): Promise<{
  mainZone: string;
  relatedZones: string[];
  potentialUsages: string[];
  prohibitedUsages: string[];
  zoneCharacteristics: Record<string, any>;
}> {
  // Extraction intelligente depuis toutes les sources
  const zones = new Set<string>();
  let mainZone = '';
  
  // Priorité 1: Données RDPPF structurées (plus fiables)
  if (data.rdppfData?.zoneAffectation) {
    mainZone = data.rdppfData.zoneAffectation.designation;
    zones.add(mainZone);
    console.log(`🎯 Zone principale extraite du RDPPF: ${mainZone}`);
  }
  // Priorité 2: buildingZone
  else if (data.buildingZone?.typ_kt) {
    mainZone = data.buildingZone.typ_kt;
    zones.add(mainZone);
  }
  
  // Analyser PLR
  if (data.plrData?.restrictions) {
    for (const restriction of data.plrData.restrictions) {
      const restrictionText = `${restriction.theme || ''} ${restriction.typeTxt || ''} ${restriction.description || ''}`.toLowerCase();
      
      if (restrictionText.includes('zone') || 
          restrictionText.includes('affectation') ||
          restrictionText.includes('nutzung') ||
          restriction.typeCode === 'NutzungsplanungUeberlagernd' ||
          restriction.typeCode === 'NutzungsplanungGrundnutzung') {
        
        if (restriction.typeTxt) {
          zones.add(restriction.typeTxt);
        }
        if (restriction.theme && restriction.theme.includes('Zone')) {
          zones.add(restriction.theme);
        }
      }
    }
  }
  
  // Analyser contraintes RDPPF
  if (data.rdppfConstraints) {
    for (const constraint of data.rdppfConstraints) {
      const constraintText = `${constraint.theme} ${constraint.rule}`.toLowerCase();
      
      // Chercher spécifiquement la destination de zone dans le RDPPF
      if (constraint.theme === 'Destination de zone' || 
          (constraintText.includes('zone') && constraintText.includes('résidentiel'))) {
        
        // Extraire la zone principale avec surface si disponible
        // Ex: "Zone résidentielle 0.5 (3), Surface: 862 m², 100.0%"
        if (constraint.rule) {
          // Extraire uniquement la partie zone (avant la virgule si présente)
          const zoneMatch = constraint.rule.match(/^([^,]+)/);  
          if (zoneMatch) {
            const extractedZone = zoneMatch[1].trim();
            if (!mainZone && extractedZone.toLowerCase().includes('zone')) {
              mainZone = extractedZone;
              zones.add(extractedZone);
              console.log(`🎯 Zone extraite des contraintes RDPPF: ${mainZone}`);
            }
          }
        }
      }
    }
  }
  
  // Analyser les données de parcelle
  if (data.parcelDetails?.zone) {
    zones.add(data.parcelDetails.zone);
  }
  
  // Analyser les règlements communaux pour les zones
  if (data.communalRegulations) {
    for (const reg of data.communalRegulations) {
      if (reg.title?.toLowerCase().includes('zone') || reg.content?.includes('Zone')) {
        // Extraire les zones mentionnées
        const zoneMatches = reg.content?.match(/Zone\s+[A-Z0-9]+/gi) || [];
        zoneMatches.forEach(z => zones.add(z));
      }
    }
  }
  
  // Déterminer la zone principale si pas encore trouvée
  if (!mainZone && zones.size > 0) {
    mainZone = Array.from(zones)[0];
  }
  
  if (!mainZone) {
    mainZone = 'Zone à déterminer';
  }
  
  // Analyser les usages potentiels avec o3
  const usageAnalysis = await analyzeZoneUsages(mainZone, data);
  
  return {
    mainZone,
    relatedZones: Array.from(zones).filter(z => z !== mainZone),
    potentialUsages: usageAnalysis.potential,
    prohibitedUsages: usageAnalysis.prohibited,
    zoneCharacteristics: usageAnalysis.characteristics
  };
}

/**
 * Analyse des usages de zone avec o3
 */
async function analyzeZoneUsages(zone: string, data: ComprehensiveParcelAnalysis): Promise<{
  potential: string[];
  prohibited: string[];
  characteristics: Record<string, any>;
}> {
  const prompt = `En tant qu'expert en urbanisme suisse, analyse la zone "${zone}" et détermine:

1. USAGES POTENTIELS: Liste tous les usages possibles dans cette zone
2. USAGES INTERDITS: Liste tous les usages explicitement interdits
3. CARACTÉRISTIQUES: Extrais les caractéristiques clés de la zone

Base ton analyse sur:
${data.formattedForAI}

Réponds en JSON:
{
  "potential": ["usage1", "usage2", ...],
  "prohibited": ["interdit1", "interdit2", ...],
  "characteristics": {
    "type": "résidentiel/mixte/industriel/etc",
    "density": "faible/moyenne/forte",
    "height_category": "bas/moyen/élevé",
    "special_features": ["feature1", "feature2"]
  }
}`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o', // Utiliser gpt-4o en attendant o3
      temperature: 0,
      messages: [
        { role: 'system', content: 'Expert en zonage suisse. Réponds uniquement en JSON valide.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000
    });
    
    const content = response.choices[0].message?.content || '{}';
    // Nettoyer le contenu pour extraire le JSON
    const cleanedContent = content
      .replace(/^```json\s*\n?/, '') // Retirer ```json au début
      .replace(/\n?```\s*$/, '') // Retirer ``` à la fin
      .trim();
    
    return JSON.parse(cleanedContent);
  } catch (error) {
    console.error('Erreur analyse usages zone:', error);
    return {
      potential: ['Habitat individuel', 'Habitat collectif'],
      prohibited: ['Industrie lourde'],
      characteristics: { type: 'résidentiel' }
    };
  }
}

/**
 * Analyse textuelle o3 avec raisonnement profond
 */
async function performO3TextAnalysis(
  data: ComprehensiveParcelAnalysis, 
  zoneContext: any
): Promise<O3Constraint[]> {
  
  const categories = [
    'zone_affectation',
    'gabarits_hauteurs',
    'reculs_distances', 
    'densité_ibus',
    'stationnement',
    'toiture_architecture',
    'espaces_verts',
    'prescriptions_architecturales',
    'procédures_administratives'
  ];
  
  const constraints: O3Constraint[] = [];
  
  // Analyse par catégorie avec prompts optimisés pour o3
  for (const category of categories) {
    const categoryConstraints = await analyzeO3Category(data, category, zoneContext);
    constraints.push(...categoryConstraints);
  }
  
  // Analyse des références croisées
  await analyzeO3CrossReferences(constraints, data);
  
  return constraints;
}

/**
 * Analyse d'une catégorie avec o3
 */
async function analyzeO3Category(
  data: ComprehensiveParcelAnalysis,
  category: string,
  zoneContext: any
): Promise<O3Constraint[]> {
  
  const categoryConfig = getCategoryConfig(category);
  
  const prompt = `Tu es un expert légal en urbanisme suisse avec 30 ans d'expérience.

MISSION: Analyse exhaustive de "${categoryConfig.title}" pour la zone "${zoneContext.mainZone}"

CONTEXTE DE ZONE:
- Zone principale: ${zoneContext.mainZone}
- Zones liées: ${zoneContext.relatedZones.join(', ')}
- Usages potentiels: ${zoneContext.potentialUsages.join(', ')}

DONNÉES COMPLÈTES:
${data.formattedForAI}

INSTRUCTIONS POUR ANALYSE o3:
1. Identifier TOUTES les contraintes spécifiques à la zone "${zoneContext.mainZone}"
2. Identifier TOUTES les contraintes qui s'appliquent à TOUTES les zones de la commune
3. VALEURS EXACTES: Extrais TOUTES les valeurs numériques avec unités précises
4. NE PAS inclure les zones de dangers (avalanches, inondations, etc.) SAUF si elles sont explicitement mentionnées dans le RDPPF
5. EXCEPTIONS: Note toutes les exceptions et cas particuliers
6. IMPLICATIONS: Analyse les implications pratiques de chaque contrainte

FOCUS SPÉCIFIQUE: ${categoryConfig.focus}

FORMAT JSON DÉTAILLÉ:
[
  {
    "title": "Titre exact de la contrainte",
    "description": "Description complète avec toutes les nuances",
    "severity": "low|medium|high|critical",
    "source": "Source exacte avec référence complète",
    "article": "Article(s) précis",
    "zone": "${zoneContext.mainZone}",
    "values": {
      "numeric": valeur_exacte,
      "unit": "unité_précise",
      "range": {"min": X, "max": Y, "unit": "unité"},
      "formula": "formule_si_applicable"
    },
    "requirements": ["req1_détaillée", "req2_avec_conditions"],
    "impact": "positive|neutral|restrictive|blocking",
    "confidence": 0-100,
    "reasoning": "Chaîne de raisonnement complète expliquant l'interprétation",
    "crossReferences": ["Art. X", "Art. Y"],
    "exceptions": ["exception1", "exception2"]
  }
]`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o', // Utiliser gpt-4o en attendant o3
      temperature: 0,
      messages: [
        { 
          role: 'system', 
          content: 'Expert légal en urbanisme. Fournis une analyse exhaustive avec raisonnement complet. JSON uniquement.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 3000
    });
    
    const content = response.choices[0].message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) return [];
    
    const constraintsData = JSON.parse(jsonMatch[0]);
    
    return constraintsData.map((c: any, idx: number) => ({
      id: `o3_text_${category}_${idx}`,
      category,
      zone: zoneContext.mainZone,
      title: c.title,
      description: c.description,
      severity: c.severity || 'medium',
      source: c.source,
      article: c.article,
      values: c.values,
      requirements: c.requirements || [],
      impact: c.impact || 'neutral',
      confidence: c.confidence || 85,
      analysisLevel: 'text' as const,
      reasoning: c.reasoning,
      crossReferences: c.crossReferences || []
    }));
    
  } catch (error) {
    console.error(`Erreur analyse o3 ${category}:`, error);
    return [];
  }
}

/**
 * Configuration des catégories
 */
function getCategoryConfig(category: string): { title: string; focus: string } {
  const configs: Record<string, { title: string; focus: string }> = {
    zone_affectation: {
      title: "Zone d'affectation et destination",
      focus: "type exact de zone, affectations autorisées/interdites, mixité fonctionnelle, restrictions spécifiques"
    },
    gabarits_hauteurs: {
      title: "Gabarits et hauteurs",
      focus: "hauteur maximale au faîte, à la corniche, nombre d'étages, hauteur par étage, exceptions"
    },
    reculs_distances: {
      title: "Reculs et distances",
      focus: "distances aux limites (grandes/petites), entre bâtiments, reculs sur rue, cas particuliers"
    },
    densité_ibus: {
      title: "Densité et indices",
      focus: "IBUS, IUS, COS, CUS, surface de plancher déterminante, bonus densité, calculs"
    },
    stationnement: {
      title: "Stationnement et mobilité",
      focus: "nombre places par logement/m², visiteurs, vélos, handicapés, localisation, dimensions"
    },
    toiture_architecture: {
      title: "Toiture et architecture",
      focus: "type toiture, pente min/max, matériaux, couleurs, superstructures, panneaux solaires"
    },
    espaces_verts: {
      title: "Espaces verts et aménagements",
      focus: "% espaces verts, plantations, perméabilité, espaces jeux, biodiversité"
    },
    contraintes_environnementales: {
      title: "Environnement et nuisances",
      focus: "protection paysage, bruit, pollution, eaux, nature, énergie"
    },
    prescriptions_architecturales: {
      title: "Prescriptions architecturales",
      focus: "style, matériaux façade, couleurs, modénature, intégration, patrimoine"
    },
    procédures_administratives: {
      title: "Procédures et autorisations",
      focus: "permis requis, procédures spéciales, consultations, délais, taxes"
    }
  };
  
  return configs[category] || { title: category, focus: 'analyse générale' };
}

/**
 * Analyse des références croisées avec o3
 */
async function analyzeO3CrossReferences(constraints: O3Constraint[], data: ComprehensiveParcelAnalysis): Promise<void> {
  const prompt = `Analyse les références croisées entre ces contraintes d'urbanisme:

${constraints.map(c => `- ${c.title} (${c.article}): ${c.description}`).join('\n')}

Identifie:
1. Les contraintes qui se réfèrent mutuellement
2. Les contradictions potentielles
3. Les cumuls d'effets
4. Les hiérarchies entre règles

Réponds en JSON:
{
  "crossReferences": [
    {
      "from": "id_contrainte1",
      "to": "id_contrainte2",
      "type": "reference|contradiction|cumul|hierarchie",
      "description": "explication"
    }
  ]
}`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o',
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'Expert en analyse juridique urbanistique.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500
    });
    
    const refContent = response.choices[0].message?.content || '{}';
    const cleanedRefContent = refContent
      .replace(/^```json\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();
    const refs = JSON.parse(cleanedRefContent);
    
    // Enrichir les contraintes avec les références croisées
    for (const ref of refs.crossReferences || []) {
      const constraint = constraints.find(c => c.id === ref.from);
      if (constraint) {
        constraint.crossReferences = constraint.crossReferences || [];
        constraint.crossReferences.push(`${ref.type}: ${ref.to} - ${ref.description}`);
      }
    }
  } catch (error) {
    console.error('Erreur analyse références croisées:', error);
  }
}

/**
 * Analyse PDF approfondie avec o3
 */
async function performO3PDFAnalysis(
  data: ComprehensiveParcelAnalysis,
  zoneContext: any,
  textAnalysis: O3Constraint[]
): Promise<O3Constraint[]> {
  
  const pdfPaths = await findRelevantPDFs(data);
  if (pdfPaths.length === 0) return [];
  
  const pdfConstraints: O3Constraint[] = [];
  
  for (const pdfPath of pdfPaths) {
    try {
      const pdfContent = await extractPDFContent(pdfPath);
      const constraints = await analyzePDFWithO3(pdfContent, zoneContext, textAnalysis);
      pdfConstraints.push(...constraints);
    } catch (error) {
      console.error(`Erreur analyse PDF ${pdfPath}:`, error);
    }
  }
  
  return pdfConstraints;
}

/**
 * Trouver les PDFs pertinents
 */
async function findRelevantPDFs(data: ComprehensiveParcelAnalysis): Promise<string[]> {
  const pdfPaths: string[] = [];
  
  // Chercher le règlement communal local
  const municipality = data.parcelDetails?.municipality || data.searchResult?.municipality || '';
  if (municipality) {
    const localPath = path.join(process.cwd(), 'reglements', `VS_${municipality}_Règlement des constructions.pdf`);
    try {
      await fs.access(localPath);
      pdfPaths.push(localPath);
    } catch {
      // Pas de règlement local
    }
  }
  
  // Ajouter d'autres PDFs pertinents si disponibles
  if (data.communalRegulations) {
    for (const reg of data.communalRegulations) {
      if (reg.url && reg.url.endsWith('.pdf')) {
        pdfPaths.push(reg.url);
      }
    }
  }
  
  return pdfPaths.slice(0, 2); // Limiter pour performance
}

/**
 * Extraire le contenu d'un PDF
 */
async function extractPDFContent(pdfPath: string): Promise<string> {
  try {
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Erreur extraction PDF:', error);
    return '';
  }
}

/**
 * Analyser un PDF avec o3
 */
async function analyzePDFWithO3(
  pdfContent: string,
  zoneContext: any,
  textAnalysis: O3Constraint[]
): Promise<O3Constraint[]> {
  
  const prompt = `Expert en urbanisme, analyse ce règlement communal complet pour la zone "${zoneContext.mainZone}".

RÈGLEMENT COMPLET:
${pdfContent.substring(0, 15000)} // Limiter pour les tokens

ZONE CIBLE: ${zoneContext.mainZone}
CONTRAINTES DÉJÀ IDENTIFIÉES: ${textAnalysis.length}

MISSION o3 - ANALYSE EXHAUSTIVE:
1. Identifier TOUTES les contraintes spécifiques à cette zone
2. Identifier TOUTES les contraintes qui s'appliquent à TOUTES les zones de la commune
3. Extraire les TABLEAUX de valeurs (hauteurs, distances, indices)
4. Identifier les FORMULES de calcul
5. Trouver les EXCEPTIONS et cas particuliers
6. NE PAS inclure les zones de dangers (avalanches, inondations) SAUF si mentionnées dans le RDPPF

FORMAT JSON ENRICHI:
[
  {
    "title": "Contrainte spécifique du PDF",
    "description": "Description avec valeurs des tableaux",
    "severity": "critical|high|medium|low",
    "source": "Règlement communal - Page X",
    "article": "Article + alinéa",
    "zone": "${zoneContext.mainZone}",
    "values": {
      "numeric": valeur,
      "unit": "unité",
      "range": {"min": X, "max": Y, "unit": "unité"},
      "formula": "formule complète si présente"
    },
    "requirements": ["détail1", "détail2"],
    "impact": "positive|neutral|restrictive|blocking",
    "confidence": 90-100,
    "reasoning": "Explication du raisonnement et interprétation",
    "crossReferences": ["référence1", "référence2"],
    "visualReference": "Figure X / Tableau Y si applicable"
  }
]`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { 
          role: 'system', 
          content: 'Expert en analyse de règlements d\'urbanisme. Extraction exhaustive. JSON uniquement.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000
    });
    
    const content = response.choices[0].message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) return [];
    
    const constraintsData = JSON.parse(jsonMatch[0]);
    
    return constraintsData.map((c: any, idx: number) => ({
      id: `o3_pdf_${idx}`,
      category: categorizeConstraint(c.title),
      zone: zoneContext.mainZone,
      title: c.title,
      description: c.description,
      severity: c.severity || 'high',
      source: c.source,
      article: c.article,
      values: c.values,
      requirements: c.requirements || [],
      impact: c.impact || 'restrictive',
      confidence: c.confidence || 95,
      analysisLevel: 'pdf' as const,
      reasoning: c.reasoning,
      crossReferences: c.crossReferences || []
    }));
    
  } catch (error) {
    console.error('Erreur analyse PDF o3:', error);
    return [];
  }
}

/**
 * Catégoriser automatiquement une contrainte
 */
function categorizeConstraint(title: string): string {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('zone') || titleLower.includes('affectation')) return 'zone_affectation';
  if (titleLower.includes('hauteur') || titleLower.includes('gabarit')) return 'gabarits_hauteurs';
  if (titleLower.includes('recul') || titleLower.includes('distance')) return 'reculs_distances';
  if (titleLower.includes('ibus') || titleLower.includes('densité')) return 'densité_ibus';
  if (titleLower.includes('parking') || titleLower.includes('stationnement')) return 'stationnement';
  if (titleLower.includes('toiture') || titleLower.includes('toit')) return 'toiture_architecture';
  if (titleLower.includes('vert') || titleLower.includes('jardin')) return 'espaces_verts';
  if (titleLower.includes('environnement') || titleLower.includes('protection')) return 'contraintes_environnementales';
  if (titleLower.includes('architectural') || titleLower.includes('façade')) return 'prescriptions_architecturales';
  
  return 'autres';
}

/**
 * Analyser spécifiquement le PDF RDPPF
 */
async function analyzeRDPPFPDF(
  data: ComprehensiveParcelAnalysis,
  zoneContext: any
): Promise<O3Constraint[]> {
  
  if (!data.rdppfConstraints || data.rdppfConstraints.length === 0) {
    console.log('⚠️ Aucune contrainte RDPPF trouvée');
    return [];
  }
  
  const prompt = `Expert en urbanisme suisse, analyse le texte extrait du PDF RDPPF pour cette parcelle.

ZONE CIBLE: ${zoneContext.mainZone}

CONTRAINTES RDPPF EXTRAITES:
${JSON.stringify(data.rdppfConstraints, null, 2)}

MISSION:
1. Analyser chaque contrainte RDPPF en détail
2. Extraire les implications concrètes pour la construction
3. Identifier les restrictions légales spécifiques
4. Évaluer l'impact sur le projet de construction
5. Croiser avec les données de zone

Pour chaque contrainte RDPPF, fournis une analyse détaillée au format JSON:
[
  {
    "title": "Titre de la contrainte RDPPF",
    "description": "Description détaillée avec implications",
    "severity": "critical|high|medium|low",
    "source": "RDPPF - [Thème spécifique]",
    "zone": "${zoneContext.mainZone}",
    "impact": "blocking|restrictive|neutral|positive",
    "confidence": 90,
    "reasoning": "Explication du raisonnement",
    "requirements": ["Exigence 1", "Exigence 2"],
    "legalReference": "Référence légale exacte"
  }
]`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { 
          role: 'system', 
          content: 'Expert RDPPF. Analyse exhaustive des restrictions de droit public. JSON uniquement.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000
    });
    
    const content = response.choices[0].message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) return [];
    
    const constraintsData = JSON.parse(jsonMatch[0]);
    
    return constraintsData.map((c: any, idx: number) => ({
      id: `rdppf_${idx}`,
      category: 'rdppf_restrictions',
      zone: zoneContext.mainZone,
      title: c.title,
      description: c.description,
      severity: c.severity || 'medium',
      source: c.source || 'RDPPF',
      values: c.values,
      requirements: c.requirements || [],
      impact: c.impact || 'neutral',
      confidence: c.confidence || 90,
      analysisLevel: 'pdf' as const,
      reasoning: c.reasoning,
      crossReferences: c.legalReference ? [c.legalReference] : []
    }));
    
  } catch (error) {
    console.error('Erreur analyse RDPPF:', error);
    return [];
  }
}

/**
 * Analyser spécifiquement le PDF du règlement communal
 */
async function analyzeReglementPDF(
  data: ComprehensiveParcelAnalysis,
  zoneContext: any
): Promise<O3Constraint[]> {
  
  if (!data.communalRegulations || data.communalRegulations.length === 0) {
    console.log('⚠️ Aucun règlement communal trouvé');
    return [];
  }
  
  // Extraire le texte des règlements
  const reglementText = data.communalRegulations
    .map(r => r.content || r.summary || '')
    .join('\n\n');
  
  const prompt = `Expert en règlements communaux suisses, analyse le texte extrait du règlement communal.

ZONE CIBLE: ${zoneContext.mainZone}
COMMUNE: ${data.parcelDetails?.municipality || 'Non spécifiée'}

TEXTE DU RÈGLEMENT COMMUNAL:
${reglementText.substring(0, 10000)}

MISSION:
1. Identifier TOUTES les contraintes applicables à la zone ${zoneContext.mainZone}
2. Extraire les valeurs numériques exactes (IBUS, hauteurs, distances, etc.)
3. Noter les articles spécifiques du règlement
4. Identifier les procédures administratives requises
5. Détecter les exceptions et cas particuliers

Pour chaque contrainte du règlement, fournis une analyse au format JSON:
[
  {
    "title": "Titre de la contrainte",
    "description": "Description complète avec valeurs",
    "severity": "critical|high|medium|low",
    "source": "Règlement communal - Art. X",
    "article": "Article exact",
    "zone": "${zoneContext.mainZone}",
    "values": {
      "numeric": valeur,
      "unit": "unité",
      "formula": "formule si applicable"
    },
    "impact": "blocking|restrictive|neutral|positive",
    "confidence": 95,
    "reasoning": "Interprétation et application",
    "requirements": ["Condition 1", "Condition 2"],
    "exceptions": ["Exception 1", "Exception 2"]
  }
]`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { 
          role: 'system', 
          content: 'Expert règlements communaux. Extraction exhaustive des contraintes. JSON uniquement.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 3000
    });
    
    const content = response.choices[0].message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) return [];
    
    const constraintsData = JSON.parse(jsonMatch[0]);
    
    return constraintsData.map((c: any, idx: number) => ({
      id: `reglement_${idx}`,
      category: 'reglement_communal',
      zone: zoneContext.mainZone,
      title: c.title,
      description: c.description,
      severity: c.severity || 'medium',
      source: c.source,
      article: c.article,
      values: c.values,
      requirements: c.requirements || [],
      impact: c.impact || 'neutral',
      confidence: c.confidence || 95,
      analysisLevel: 'pdf' as const,
      reasoning: c.reasoning,
      crossReferences: c.exceptions || []
    }));
    
  } catch (error) {
    console.error('Erreur analyse règlement:', error);
    return [];
  }
}

/**
 * Analyser les deux PDFs ensemble pour une vue d'ensemble
 */
async function analyzeCombinedPDFs(
  rdppfConstraints: O3Constraint[],
  reglementConstraints: O3Constraint[],
  data: ComprehensiveParcelAnalysis,
  zoneContext: any
): Promise<O3Constraint[]> {
  
  const prompt = `Expert en urbanisme, analyse l'ensemble des contraintes des deux PDFs pour identifier les synergies et conflits.

ZONE: ${zoneContext.mainZone}

CONTRAINTES RDPPF (${rdppfConstraints.length}):
${JSON.stringify(rdppfConstraints.map(c => ({ title: c.title, severity: c.severity })), null, 2)}

CONTRAINTES RÈGLEMENT COMMUNAL (${reglementConstraints.length}):
${JSON.stringify(reglementConstraints.map(c => ({ title: c.title, severity: c.severity })), null, 2)}

MISSION:
1. Identifier les conflits entre RDPPF et règlement communal
2. Détecter les contraintes cumulatives (qui s'ajoutent)
3. Trouver les synergies positives
4. Évaluer l'impact global sur la constructibilité
5. Proposer une stratégie d'optimisation

Fournis une analyse globale au format JSON:
[
  {
    "title": "Synthèse ou conflit identifié",
    "description": "Description de l'interaction entre contraintes",
    "severity": "critical|high|medium|low",
    "source": "Analyse croisée RDPPF/Règlement",
    "type": "conflict|cumulative|synergy|optimization",
    "impact": "blocking|restrictive|neutral|positive",
    "confidence": 85,
    "reasoning": "Explication du raisonnement",
    "recommendations": ["Action 1", "Action 2"]
  }
]`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { 
          role: 'system', 
          content: 'Expert analyse croisée urbanisme. Synthèse stratégique. JSON uniquement.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000
    });
    
    const content = response.choices[0].message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) return [];
    
    const analysisData = JSON.parse(jsonMatch[0]);
    
    return analysisData.map((a: any, idx: number) => ({
      id: `combined_${idx}`,
      category: 'analyse_globale',
      zone: zoneContext.mainZone,
      title: a.title,
      description: a.description,
      severity: a.severity || 'medium',
      source: a.source,
      values: {},
      requirements: a.recommendations || [],
      impact: a.impact || 'neutral',
      confidence: a.confidence || 85,
      analysisLevel: 'combined' as const,
      reasoning: a.reasoning,
      crossReferences: []
    }));
    
  } catch (error) {
    console.error('Erreur analyse combinée:', error);
    return [];
  }
}

/**
 * Fusion et enrichissement des analyses
 */
async function mergeAndEnrichAnalyses(
  textConstraints: O3Constraint[],
  pdfConstraints: O3Constraint[],
  zoneContext: any
): Promise<O3Constraint[]> {
  
  const merged: O3Constraint[] = [];
  const processed = new Set<string>();
  
  // Prioriser les contraintes PDF (plus complètes)
  for (const pdfC of pdfConstraints) {
    const key = `${pdfC.category}_${pdfC.title}`;
    merged.push({ ...pdfC, analysisLevel: 'enhanced' });
    processed.add(key);
  }
  
  // Ajouter les contraintes texte uniques
  for (const textC of textConstraints) {
    const key = `${textC.category}_${textC.title}`;
    if (!processed.has(key)) {
      // Vérifier si c'est une variante
      const similar = merged.find(m => 
        m.category === textC.category && 
        similarity(m.title, textC.title) > 0.7
      );
      
      if (!similar) {
        merged.push(textC);
      } else {
        // Enrichir la contrainte existante
        similar.analysisLevel = 'combined';
        similar.confidence = Math.max(similar.confidence, textC.confidence);
        if (textC.reasoning && !similar.reasoning) {
          similar.reasoning = textC.reasoning;
        }
      }
    }
  }
  
  // Enrichissement final avec analyse de cohérence
  await enrichWithCoherenceAnalysis(merged, zoneContext);
  
  return merged.sort((a, b) => {
    // Trier par catégorie puis par confiance
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return b.confidence - a.confidence;
  });
}

/**
 * Enrichissement avec analyse de cohérence
 */
async function enrichWithCoherenceAnalysis(constraints: O3Constraint[], zoneContext: any): Promise<void> {
  const prompt = `Analyse la cohérence de ces ${constraints.length} contraintes pour la zone "${zoneContext.mainZone}":

${constraints.map(c => `${c.id}: ${c.title} - ${c.values?.numeric || ''} ${c.values?.unit || ''}`).join('\n')}

Identifie:
1. Incohérences ou contradictions
2. Contraintes manquantes évidentes
3. Validité des valeurs numériques
4. Suggestions d'amélioration

JSON uniquement.`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o',
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'Expert en cohérence réglementaire.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000
    });
    
    // Traiter les résultats de cohérence
    const coherenceContent = response.choices[0].message?.content || '{}';
    const cleanedCoherenceContent = coherenceContent
      .replace(/^```json\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();
    const coherence = JSON.parse(cleanedCoherenceContent);
    
    // Enrichir les contraintes avec les insights
    if (coherence.issues) {
      for (const issue of coherence.issues) {
        const constraint = constraints.find(c => c.id === issue.constraintId);
        if (constraint) {
          constraint.reasoning = `${constraint.reasoning || ''}\n⚠️ ${issue.description}`;
        }
      }
    }
  } catch (error) {
    console.error('Erreur analyse cohérence:', error);
  }
}

/**
 * Calculs avancés
 */
async function performAdvancedCalculations(
  constraints: O3Constraint[],
  data: ComprehensiveParcelAnalysis
): Promise<O3AnalysisResult['calculations']> {
  
  const surface = data.parcelDetails?.surface || 0;
  const calculations: O3AnalysisResult['calculations'] = {};
  
  // Extraire les valeurs des contraintes
  for (const constraint of constraints) {
    if (constraint.category === 'densité_ibus' && constraint.values?.numeric) {
      const ibus = constraint.values.numeric;
      calculations.maxBuildableArea = Math.round(surface * ibus);
      calculations.constructionDensity = ibus;
    }
    
    if (constraint.category === 'gabarits_hauteurs' && constraint.values?.numeric) {
      calculations.maxHeight = constraint.values.numeric;
    }
    
    if (constraint.category === 'espaces_verts' && constraint.values?.numeric) {
      const greenPercent = constraint.values.numeric;
      calculations.requiredGreenSpace = Math.round(surface * greenPercent / 100);
    }
    
    if (constraint.category === 'stationnement' && constraint.values?.numeric) {
      // Calcul basique pour exemple
      calculations.parkingSpaces = constraint.values.numeric;
    }
  }
  
  return calculations;
}

/**
 * Synthèse stratégique o3
 */
async function generateO3StrategicSynthesis(
  data: ComprehensiveParcelAnalysis,
  constraints: O3Constraint[],
  calculations: O3AnalysisResult['calculations'],
  zoneContext: any
): Promise<Pick<O3AnalysisResult, 'summary' | 'recommendations' | 'risks' | 'opportunities' | 'nextSteps'>> {
  
  const prompt = `Expert conseil senior en développement immobilier suisse, génère une synthèse stratégique.

PARCELLE: ${data.searchQuery}
ZONE: ${zoneContext.mainZone}
SURFACE: ${data.parcelDetails?.surface || 'N/A'} m²
CONTRAINTES: ${constraints.length} identifiées

CONTRAINTES CRITIQUES:
${constraints.filter(c => c.severity === 'critical' || c.severity === 'high')
  .map(c => `- ${c.title}: ${c.description} [${c.values?.numeric || ''} ${c.values?.unit || ''}]`)
  .join('\n')}

CALCULS:
- Surface constructible max: ${calculations.maxBuildableArea || 'N/A'} m²
- Hauteur max: ${calculations.maxHeight || 'N/A'} m
- Espaces verts requis: ${calculations.requiredGreenSpace || 'N/A'} m²

GÉNÈRE UNE SYNTHÈSE STRATÉGIQUE COMPLÈTE:

1. RÉSUMÉ EXÉCUTIF (200 mots): Vue stratégique pour décideur
2. RÉSUMÉ TECHNIQUE (200 mots): Aspects techniques pour architecte
3. RÉSUMÉ PRATIQUE (200 mots): Actions concrètes pour maître d'ouvrage

4. RECOMMANDATIONS PRIORITAIRES (10-15): Actions stratégiques classées par importance
5. RISQUES (5-10): Risques majeurs avec probabilité et mitigation
6. OPPORTUNITÉS (5-10): Opportunités uniques de cette parcelle
7. FEUILLE DE ROUTE (phases): Plan d'action détaillé par phases

FORMAT JSON STRUCTURÉ:
{
  "summary": {
    "executive": "résumé exécutif...",
    "technical": "résumé technique...",
    "practical": "résumé pratique..."
  },
  "recommendations": [
    {
      "priority": "high|medium|low",
      "action": "action concrète",
      "reason": "justification",
      "timeline": "délai"
    }
  ],
  "risks": [
    {
      "level": "critical|high|medium|low",
      "description": "description du risque",
      "mitigation": "stratégie de mitigation",
      "probability": 0-100
    }
  ],
  "opportunities": [
    {
      "type": "type d'opportunité",
      "description": "description détaillée",
      "potential": "high|medium|low",
      "requirements": ["req1", "req2"]
    }
  ],
  "nextSteps": [
    {
      "phase": "Phase 1: Titre",
      "tasks": ["tâche1", "tâche2"],
      "duration": "durée estimée",
      "dependencies": ["dep1", "dep2"]
    }
  ]
}`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o',
      temperature: 0.1,
      messages: [
        { 
          role: 'system', 
          content: 'Conseil stratégique senior en immobilier suisse. 30 ans d\'expérience. Synthèses exécutives percutantes.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000
    });
    
    const content = response.choices[0].message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Pas de JSON valide');
    }
    
    return JSON.parse(jsonMatch[0]);
    
  } catch (error) {
    console.error('Erreur synthèse o3:', error);
    return {
      summary: {
        executive: 'Analyse en cours...',
        technical: 'Analyse en cours...',
        practical: 'Analyse en cours...'
      },
      recommendations: [],
      risks: [],
      opportunities: [],
      nextSteps: []
    };
  }
}

/**
 * Calcul de compatibilité amélioré
 */
function calculateEnhancedCompatibility(constraints: O3Constraint[]): O3AnalysisResult['zoneAnalysis']['compatibility'] {
  const criticalCount = constraints.filter(c => c.severity === 'critical').length;
  const highCount = constraints.filter(c => c.severity === 'high').length;
  const blockingCount = constraints.filter(c => c.impact === 'blocking').length;
  
  if (blockingCount > 0) return 'incompatible';
  if (criticalCount > 2) return 'difficult';
  if (criticalCount > 0 || highCount > 3) return 'moderate';
  if (highCount > 1) return 'good';
  return 'excellent';
}

/**
 * Calcul de confiance o3
 */
function calculateO3Confidence(constraints: O3Constraint[], synthesis: any): number {
  const avgConstraintConfidence = constraints.length > 0
    ? constraints.reduce((sum, c) => sum + c.confidence, 0) / constraints.length
    : 0;
  
  const hasHighConfidenceConstraints = constraints.filter(c => c.confidence >= 90).length / constraints.length;
  const hasReasoning = constraints.filter(c => c.reasoning).length / constraints.length;
  const hasCrossRefs = constraints.filter(c => c.crossReferences && c.crossReferences.length > 0).length / constraints.length;
  
  const confidence = (
    avgConstraintConfidence * 0.4 +
    hasHighConfidenceConstraints * 100 * 0.3 +
    hasReasoning * 100 * 0.2 +
    hasCrossRefs * 100 * 0.1
  );
  
  return Math.round(Math.min(confidence, 100));
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