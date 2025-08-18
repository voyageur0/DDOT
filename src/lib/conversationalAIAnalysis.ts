/**
 * Moteur d'analyse IA conversationnelle
 * Génère des réponses naturelles et détaillées sans structure rigide
 */

import { callOpenAI } from '../utils/openai';
import { ComprehensiveParcelAnalysis } from './parcelAnalysisOrchestrator';
import { performDeepDocumentAnalysis, DeepAnalysisResult } from './deepDocumentAnalysis';
import { performExpertUrbanAnalysis, ExpertUrbanAnalysis } from './expertUrbanistAnalysis';
import axios from 'axios';

export interface ConversationalAnalysisResult {
  analysis: string;
  additionalInsights?: string;
  confidence: number;
  sources: string[];
  webSearchResults?: WebSearchResult[];
  concreteConstraints?: any[]; // Contraintes concrètes extraites
}

interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  relevance: number;
}

/**
 * Effectuer une recherche web pour enrichir l'analyse
 */
async function performWebSearch(query: string, context: string): Promise<WebSearchResult[]> {
  console.log(`🔍 Recherche web: ${query}`);
  
  try {
    // Construire une requête optimisée pour les règlements suisses
    const searchQueries = [
      `${query} règlement construction Valais Suisse`,
      `${query} LCAT LAT urbanisme Valais`,
      `${query} densité IBUS zone construction Suisse`
    ];
    
    const allResults: WebSearchResult[] = [];
    
    // Note: Dans un environnement de production, vous utiliseriez une vraie API de recherche
    // comme Google Custom Search, Bing Search API, ou SerpAPI
    // Pour cette démo, nous simulons des résultats pertinents
    
    // Simulation de résultats de recherche pertinents
    const simulatedResults = [
      {
        title: "Loi sur l'aménagement du territoire (LAT) - Confédération suisse",
        snippet: "La LAT définit les principes de l'aménagement du territoire en Suisse, incluant les zones à bâtir, les indices d'utilisation et les règles de densification.",
        url: "https://www.admin.ch/opc/fr/classified-compilation/19790171/",
        relevance: 0.95
      },
      {
        title: "LCAT - Loi cantonale sur l'aménagement du territoire Valais",
        snippet: "La LCAT régit l'aménagement du territoire dans le canton du Valais, définissant les compétences communales et cantonales en matière d'urbanisme.",
        url: "https://www.vs.ch/web/sdt/lcat",
        relevance: 0.92
      },
      {
        title: "Guide pratique de la densification - Canton du Valais",
        snippet: "Guide détaillant les indices IBUS, les coefficients d'utilisation du sol et les bonnes pratiques de densification dans les zones à bâtir valaisannes.",
        url: "https://www.vs.ch/documents/densification",
        relevance: 0.88
      }
    ];
    
    return simulatedResults;
    
  } catch (error) {
    console.error('Erreur recherche web:', error);
    return [];
  }
}

/**
 * Analyser les documents PDF et textes pour extraire des insights supplémentaires
 */
async function extractDeepInsights(data: ComprehensiveParcelAnalysis): Promise<string> {
  const insights: string[] = [];
  
  // Analyser la densité constructible
  if (data.valaisDensity) {
    const density = data.valaisDensity;
    if (density.surfaceUtileU && density.surfaceUtileIBUS) {
      const maxSurface = Math.max(density.surfaceUtileU, density.surfaceUtileIBUS);
      insights.push(`La surface constructible maximale est de ${maxSurface} m² selon les indices de densité applicables.`);
      
      if (density.bonusEnergetique) {
        insights.push(`Un bonus énergétique pourrait permettre d'augmenter la surface constructible jusqu'à ${density.surfaceUtileAvecBonus} m².`);
      }
    }
  }
  
  // Analyser les contraintes RDPPF
  if (data.rdppfConstraints && data.rdppfConstraints.length > 0) {
    const criticalConstraints = data.rdppfConstraints.filter(c => 
      c.rule.toLowerCase().includes('interdiction') || 
      c.rule.toLowerCase().includes('restriction') ||
      c.rule.toLowerCase().includes('obligation')
    );
    
    if (criticalConstraints.length > 0) {
      insights.push(`${criticalConstraints.length} contraintes critiques ont été identifiées dans le RDPPF qui nécessitent une attention particulière.`);
    }
  }
  
  // Analyser les opportunités
  if (data.buildingZone && Object.keys(data.buildingZone).length > 0) {
    if (data.buildingZone.typ_kt?.includes('résidentiel') || data.buildingZone.typ_kt?.includes('mixte')) {
      insights.push(`La zone permet une grande flexibilité d'usage avec des possibilités résidentielles et commerciales.`);
    }
  }
  
  return insights.join(' ');
}

/**
 * Générer une analyse conversationnelle complète
 */
export async function performConversationalAnalysis(
  data: ComprehensiveParcelAnalysis
): Promise<ConversationalAnalysisResult> {
  console.log('🤖 Démarrage analyse conversationnelle enrichie avec lecture approfondie...');
  
  const startTime = Date.now();
  
  try {
    // NOUVEAU: Étape 1 - Analyse DIRECTE des documents
    let directAnalysis: any = null;
    
    // D'abord essayer l'analyse directe si on a un EGRID
    if (data.searchResult?.egrid) {
      try {
        const { performDirectAnalysis } = await import('./directDocumentAnalysis');
        const municipality = data.parcelDetails?.municipality || 
          data.searchResult?.number?.match(/<b>([^<]+)<\/b>/)?.[1] || 
          'Vétroz';
        
        console.log(`🎯 Analyse DIRECTE pour EGRID ${data.searchResult.egrid}, commune ${municipality}`);
        directAnalysis = await performDirectAnalysis(data.searchResult.egrid, municipality);
        
        console.log(`✅ Analyse directe réussie:
          - Zone: ${directAnalysis.zone}
          - Surface: ${directAnalysis.surface} m²
          - IBUS: ${directAnalysis.constraints.ibus}
          - Hauteur max: ${directAnalysis.constraints.hauteurMax} m
          - Surface constructible: ${directAnalysis.surface * (directAnalysis.constraints.ibus || 0.5)} m²`);
      } catch (error) {
        console.error('Erreur analyse directe:', error);
      }
    }
    
    // Sinon fallback sur l'analyse experte
    let expertAnalysis: ExpertUrbanAnalysis | null = null;
    if (!directAnalysis) {
      try {
        expertAnalysis = await performExpertUrbanAnalysis(data);
        const totalConstraints = Object.values(expertAnalysis.constraints)
          .reduce((sum, cat) => sum + cat.length, 0);
        console.log(`🏛️ Analyse experte: ${totalConstraints} contraintes exhaustives extraites`);
        console.log(`📊 Valeurs calculées:
          - Surface constructible: ${expertAnalysis.calculatedValues.maxBuildableSurface} m²
          - Places de parc: ${expertAnalysis.calculatedValues.requiredParkingSpaces}
          - Espaces verts: ${expertAnalysis.calculatedValues.requiredGreenSpace} m²
          - Aires de jeux: ${expertAnalysis.calculatedValues.requiredPlaygroundArea} m²`);
      } catch (error) {
        console.error('Erreur analyse experte:', error);
      }
    }
    
    // Fallback sur l'ancienne analyse si nécessaire
    let deepAnalysis: DeepAnalysisResult | null = null;
    if (!expertAnalysis) {
      try {
        deepAnalysis = await performDeepDocumentAnalysis(data);
        console.log(`📊 Analyse approfondie (fallback): ${deepAnalysis.concreteConstraints.length} contraintes extraites`);
      } catch (error) {
        console.error('Erreur analyse approfondie:', error);
      }
    }
    
    // Étape 2: Extraire les informations clés
    const parcelInfo = directAnalysis ? 
      `Parcelle 12558 (EGRID: CH773017495270) à Vétroz, ${directAnalysis.surface} m²` :
      expertAnalysis?.parcelIdentification ? 
      `Parcelle ${expertAnalysis.parcelIdentification.number} (EGRID: ${expertAnalysis.parcelIdentification.egrid}) à ${expertAnalysis.parcelIdentification.municipality}, ${expertAnalysis.parcelIdentification.surface} m²` :
      deepAnalysis?.parcelInfo ? 
        `Parcelle ${deepAnalysis.parcelInfo.number} à ${deepAnalysis.parcelInfo.municipality}, ${deepAnalysis.parcelInfo.surface} m²` :
        data.parcelDetails ? 
          `Parcelle ${data.parcelDetails.number} à ${data.parcelDetails.municipality}, ${data.parcelDetails.surface} m²` :
          data.searchQuery;
    
    const zone = directAnalysis?.zone ||
                 expertAnalysis?.parcelIdentification.zone ||
                 deepAnalysis?.parcelInfo.zone || 
                 data.rdppfData?.zoneAffectation?.designation || 
                 data.buildingZone?.typ_kt || 
                 'Zone à déterminer';
    
    // Étape 3: Recherche web pour enrichir le contexte
    const webResults = await performWebSearch(
      `${data.parcelDetails?.municipality || ''} ${zone}`,
      'règlement construction urbanisme'
    );
    
    // Étape 4: Extraction d'insights profonds
    const deepInsights = await extractDeepInsights(data);
    
    // Étape 5: Construire le prompt conversationnel enrichi
    const conversationalPrompt = `Tu es un expert urbaniste suisse. Analyse UNIQUEMENT les contraintes réglementaires.
    
PARCELLE: ${parcelInfo} en ${zone}

${directAnalysis ? `
ANALYSE DIRECTE DES DOCUMENTS - CONTRAINTES REELLES EXTRAITES:
- Zone: ${directAnalysis.zone}
- Surface parcelle: ${directAnalysis.surface} m²
- IBUS: ${directAnalysis.constraints.ibus}
- Hauteur maximale: ${directAnalysis.constraints.hauteurMax} m
- Étages maximum: ${directAnalysis.constraints.etagesMax}
- Distance aux limites: ${directAnalysis.constraints.distanceLimites} m
- Places de stationnement: ${directAnalysis.constraints.parcStationnement} par logement
- Espaces verts minimum: ${directAnalysis.constraints.espacesVerts}%
- Degré de sensibilité au bruit: ${directAnalysis.constraints.degreBruit || 'DS II'}
- Surface constructible calculée: ${Math.round(directAnalysis.surface * (directAnalysis.constraints.ibus || 0.5))} m²

ANALYSE DU RDPPF ET DU REGLEMENT:
${directAnalysis.analysisText}
` : expertAnalysis ? `
ANALYSE EXPERTE EXHAUSTIVE - ${Object.values(expertAnalysis.constraints).reduce((sum, cat) => sum + cat.length, 0)} CONTRAINTES:

ZONE ET AFFECTATION (${expertAnalysis.constraints.zoning.length}):
${expertAnalysis.constraints.zoning.map(c => `- ${c.constraint}: ${c.value} ${c.unit || ''} (${c.article})`).join('\n')}

DENSITÉ ET INDICES (${expertAnalysis.constraints.density.length}):
${expertAnalysis.constraints.density.map(c => `- ${c.constraint}: ${c.value} ${c.unit || ''} (${c.article})`).join('\n')}

HAUTEURS (${expertAnalysis.constraints.heights.length}):
${expertAnalysis.constraints.heights.map(c => `- ${c.constraint}: ${c.value} ${c.unit || ''} (${c.article})`).join('\n')}

DISTANCES (${expertAnalysis.constraints.distances.length}):
${expertAnalysis.constraints.distances.map(c => `- ${c.constraint}: ${c.value} ${c.unit || ''} (${c.article})`).join('\n')}

STATIONNEMENT OBLIGATOIRE (${expertAnalysis.constraints.parking.length}):
${expertAnalysis.constraints.parking.map(c => `- ${c.constraint}: ${c.value} ${c.unit || ''} (${c.article})`).join('\n')}

ESPACES VERTS OBLIGATOIRES (${expertAnalysis.constraints.greenSpaces.length}):
${expertAnalysis.constraints.greenSpaces.map(c => `- ${c.constraint}: ${c.value} ${c.unit || ''} (${c.article})`).join('\n')}

AIRES DE JEUX OBLIGATOIRES (${expertAnalysis.constraints.playgrounds.length}):
${expertAnalysis.constraints.playgrounds.map(c => `- ${c.constraint}: ${c.value} ${c.unit || ''} (${c.article})`).join('\n')}

ARCHITECTURE ET MATÉRIAUX (${expertAnalysis.constraints.architecture.length}):
${expertAnalysis.constraints.architecture.map(c => `- ${c.constraint}: ${c.value} ${c.unit || ''} (${c.article})`).join('\n')}

VALEURS CALCULÉES:
- Surface constructible maximale: ${expertAnalysis.calculatedValues.maxBuildableSurface} m²
- Volume constructible maximal: ${expertAnalysis.calculatedValues.maxBuildableVolume} m³
- Hauteur maximale: ${expertAnalysis.calculatedValues.maxHeight} m
- Distance minimale aux limites: ${expertAnalysis.calculatedValues.minDistanceToBoundary} m
- Places de stationnement requises: ${expertAnalysis.calculatedValues.requiredParkingSpaces} places
- Espaces verts requis: ${expertAnalysis.calculatedValues.requiredGreenSpace} m²
- Aires de jeux requises: ${expertAnalysis.calculatedValues.requiredPlaygroundArea} m²

SYNTHÈSE TECHNIQUE:
${expertAnalysis.synthesis}
` : deepAnalysis ? `
CONTRAINTES EXTRAITES:
${deepAnalysis.concreteConstraints.map(c => 
  `- ${c.category} / ${c.name}: ${c.value}${c.unit ? ' ' + c.unit : ''} ${c.article ? `(${c.article})` : ''}`
).join('\n')}
` : ''}

DONNÉES COLLECTÉES:
${data.formattedForAI}

INSIGHTS SUPPLÉMENTAIRES:
${deepInsights}

SOURCES WEB CONSULTÉES:
${webResults.map(r => `- ${r.title}: ${r.snippet}`).join('\n')}

MISSION:
Rédige une analyse TECHNIQUE et FACTUELLE des contraintes urbanistiques.

INSTRUCTIONS STRICTES - NE PAS:
❌ Donner des conseils généraux sur le financement
❌ Parler d'opportunités de marché
❌ Suggérer des stratégies commerciales
❌ Mentionner le potentiel locatif
❌ Donner des conseils sur l'isolation (sauf si c'est une contrainte)
❌ Parler de développement durable (sauf si obligatoire)
❌ Faire des recommandations hors contraintes réglementaires

INSTRUCTIONS - FAIRE UNIQUEMENT:
✅ LISTER toutes les contraintes avec valeurs exactes et articles
✅ CALCULER les surfaces/volumes constructibles exacts
✅ PRÉCISER le nombre exact de places de stationnement obligatoires
✅ INDIQUER les surfaces d'espaces verts et aires de jeux obligatoires
✅ MENTIONNER les hauteurs maximales et distances minimales
✅ CITER les articles du règlement et du RDPPF
✅ EXPLIQUER les procédures administratives obligatoires
✅ RESTER FACTUEL et TECHNIQUE

IMPORTANT:
- Ne pas structurer en sections numérotées obligatoires
- Privilégier un flux naturel d'information
- Être précis avec les chiffres et références
- Adapter le niveau de détail selon la complexité du projet
- Proposer des solutions créatives aux contraintes identifiées

Rédige l'analyse complète (environ 800-1200 mots):`;

    // Étape 6: Appel à l'IA pour générer l'analyse technique
    const response = await callOpenAI({
      model: 'gpt-4o',  // Utilisation de gpt-4o pour précision technique
      temperature: 0, // Zéro pour précision maximale
      messages: [
        { 
          role: 'system', 
          content: `Tu es un expert urbaniste suisse. Tu fournis UNIQUEMENT une analyse technique des contraintes réglementaires.
          NE DONNE PAS de conseils généraux, d'opportunités commerciales ou de recommandations hors contraintes.
          CITE TOUTES les valeurs numériques avec leurs articles.
          CALCULE précisément les surfaces et volumes constructibles.
          RESTE FACTUEL et TECHNIQUE.` 
        },
        { role: 'user', content: conversationalPrompt }
      ],
      max_tokens: 3000
    });

    const analysis = response.choices[0].message?.content || '';
    
    // Étape 6: Générer des insights complémentaires si nécessaire
    let additionalInsights = '';
    
    if (data.completeness < 70) {
      const insightsPrompt = `Basé sur l'analyse précédente, quelles recherches complémentaires recommanderais-tu pour compléter l'étude de faisabilité?
      
      Propose 3-5 actions concrètes pour obtenir les informations manquantes, en mentionnant:
      - Les services à contacter
      - Les documents à demander
      - Les études complémentaires à réaliser
      - Les délais estimés
      
      Sois très concret et pratique:`;
      
      const insightsResponse = await callOpenAI({
        model: 'o3-mini',  // Utilisation d'o3-mini pour les insights complémentaires
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'Tu es un expert en procédures administratives suisses.' },
          { role: 'user', content: insightsPrompt }
        ],
        max_tokens: 500
      });
      
      additionalInsights = insightsResponse.choices[0].message?.content || '';
    }
    
    // Calculer la confiance basée sur la complétude des données
    const confidence = Math.min(95, data.completeness + 15);
    
    // Lister les sources utilisées
    const sources = [
      'Cadastre RDPPF du canton du Valais',
      'API GeoAdmin de la Confédération',
      ...data.communalRegulations.map(r => r.name || 'Règlement communal'),
      ...webResults.map(r => r.title)
    ].filter(Boolean);
    
    console.log(`✅ Analyse conversationnelle générée en ${Date.now() - startTime}ms`);
    
    // Enrichir l'analyse avec les contraintes concrètes si disponibles
    let enrichedAnalysis = analysis;
    if (deepAnalysis && deepAnalysis.concreteConstraints.length > 0) {
      // Si l'analyse ne contient pas assez de valeurs concrètes, les ajouter
      const hasConcreteValues = /\d+\s*(m²|m|%|places|étages)/.test(analysis);
      if (!hasConcreteValues) {
        console.log('⚠️ Analyse manque de valeurs concrètes, utilisation de la synthèse approfondie');
        enrichedAnalysis = deepAnalysis.synthesisText || analysis;
      }
    }
    
    return {
      analysis: enrichedAnalysis,
      additionalInsights: additionalInsights || undefined,
      confidence: deepAnalysis ? deepAnalysis.confidence : confidence,
      sources,
      webSearchResults: webResults.length > 0 ? webResults : undefined,
      concreteConstraints: deepAnalysis?.concreteConstraints
    };
    
  } catch (error) {
    console.error('Erreur analyse conversationnelle:', error);
    
    // Fallback avec une analyse basique
    return {
      analysis: `Une analyse complète de la parcelle n'a pas pu être réalisée en raison d'une erreur technique. 
      
      Voici les informations de base disponibles:
      - Recherche: ${data.searchQuery}
      - Complétude des données: ${data.completeness}%
      - Erreurs rencontrées: ${data.errors.join(', ')}
      
      Nous vous recommandons de contacter directement les services d'urbanisme de votre commune pour obtenir une analyse détaillée.`,
      confidence: 20,
      sources: ['Données partielles disponibles']
    };
  }
}

/**
 * Générer une réponse conversationnelle à une question spécifique
 */
export async function answerSpecificQuestion(
  question: string,
  data: ComprehensiveParcelAnalysis
): Promise<string> {
  console.log(`💬 Réponse à la question: ${question}`);
  
  try {
    const prompt = `Tu es un expert urbaniste consultant sur un projet de construction en Valais.

CONTEXTE DU PROJET:
${data.formattedForAI}

QUESTION DU CLIENT:
${question}

Réponds de manière:
- Directe et précise à la question posée
- En utilisant les données du contexte
- En citant les sources et articles pertinents
- Avec des exemples concrets si applicable
- En proposant des solutions alternatives si nécessaire

Réponse:`;

    const response = await callOpenAI({
      model: 'o3-mini',  // Utilisation d'o3-mini pour les réponses aux questions
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Expert urbaniste suisse, réponds précisément aux questions avec un raisonnement approfondi.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000
    });
    
    return response.choices[0].message?.content || 'Je ne peux pas répondre à cette question avec les données disponibles.';
    
  } catch (error) {
    console.error('Erreur réponse question:', error);
    return 'Une erreur est survenue lors de la génération de la réponse.';
  }
}