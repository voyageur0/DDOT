/**
 * Moteur d'analyse IA amélioré pour l'extraction structurée de contraintes d'urbanisme
 */

import { callOpenAI } from '../utils/openai';
import { ComprehensiveParcelAnalysis } from './parcelAnalysisOrchestrator';

export interface StructuredConstraint {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  source: string;
  article?: string;
  values?: {
    numeric?: number;
    unit?: string;
    text?: string;
  };
  requirements?: string[];
  impact: 'positive' | 'neutral' | 'restrictive';
}

export interface AnalysisResult {
  constraints: StructuredConstraint[];
  summary: string;
  recommendations: string[];
  risks: string[];
  opportunities: string[];
  nextSteps: string[];
}

/**
 * Analyse approfondie avec extraction structurée de contraintes
 */
export async function performStructuredAnalysis(data: ComprehensiveParcelAnalysis): Promise<AnalysisResult> {
  console.log('🧠 Démarrage analyse structurée IA avancée...');

  // Étape 1: Extraction des contraintes par catégorie
  const constraints = await extractStructuredConstraints(data);
  
  // Étape 2: Synthèse et recommandations
  const synthesis = await generateSynthesis(data, constraints);

  return {
    constraints,
    ...synthesis
  };
}

/**
 * Extraction structurée des contraintes par catégories
 */
async function extractStructuredConstraints(data: ComprehensiveParcelAnalysis): Promise<StructuredConstraint[]> {
  const categories = [
    'zone_affectation',
    'gabarits_hauteurs', 
    'reculs_distances',
    'densité_ibus',
    'stationnement',
    'toiture_architecture',
    'espaces_verts',
    'contraintes_environnementales',
    'prescriptions_architecturales'
  ];

  const allConstraints: StructuredConstraint[] = [];

  for (const category of categories) {
    try {
      const categoryConstraints = await extractConstraintsForCategory(data, category);
      allConstraints.push(...categoryConstraints);
    } catch (error) {
      console.error(`Erreur extraction catégorie ${category}:`, error);
    }
  }

  return allConstraints;
}

/**
 * Extraction des contraintes pour une catégorie spécifique
 */
async function extractConstraintsForCategory(
  data: ComprehensiveParcelAnalysis, 
  category: string
): Promise<StructuredConstraint[]> {
  
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
    },
    prescriptions_architecturales: {
      title: "Prescriptions architecturales",
      focus: "style, matériaux imposés, couleurs, formes, intégration paysagère"
    }
  };

  const categoryInfo = categoryPrompts[category as keyof typeof categoryPrompts];
  if (!categoryInfo) return [];

  const prompt = `Analyse UNIQUEMENT la catégorie "${categoryInfo.title}" dans les documents fournis.

DONNÉES À ANALYSER:
${data.formattedForAI}

OBJECTIF: Extraire toutes les contraintes spécifiques à: ${categoryInfo.focus}

INSTRUCTIONS STRICTES:
1. Cherche UNIQUEMENT les informations relatives à: ${categoryInfo.focus}
2. Pour chaque contrainte trouvée, extrais:
   - La règle exacte (avec valeurs numériques si présentes)
   - La source (article, règlement)
   - Le niveau de sévérité (faible/moyen/élevé)
3. NE JAMAIS écrire "Non spécifié" - si pas d'info, ne pas créer de contrainte
4. Être PRÉCIS avec les valeurs numériques et unités

FORMAT DE RÉPONSE OBLIGATOIRE (JSON):
[
  {
    "title": "Titre précis de la contrainte",
    "description": "Description détaillée avec valeurs exactes",
    "severity": "low|medium|high",
    "source": "Source exacte (article, règlement)",
    "article": "Article spécifique si mentionné",
    "values": {
      "numeric": nombre_si_applicable,
      "unit": "unité_si_applicable",
      "text": "valeur_textuelle_si_applicable"
    },
    "requirements": ["exigence 1", "exigence 2"],
    "impact": "positive|neutral|restrictive"
  }
]

Répondre UNIQUEMENT avec le JSON, rien d'autre.`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { 
          role: 'system', 
          content: 'Tu es un expert en urbanisme suisse. Extrais UNIQUEMENT les contraintes présentes dans les documents, avec une précision technique maximale. Réponds UNIQUEMENT en JSON valide.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000
    });

    const content = response.choices[0].message?.content || '';
    
    // Nettoyer le contenu pour extraire le JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn(`Pas de JSON valide pour catégorie ${category}`);
      return [];
    }

    const constraintsData = JSON.parse(jsonMatch[0]);
    
    return constraintsData.map((constraint: any, index: number) => ({
      id: `${category}_${index}`,
      category,
      title: constraint.title,
      description: constraint.description,
      severity: constraint.severity || 'medium',
      source: constraint.source || 'Document analysé',
      article: constraint.article,
      values: constraint.values,
      requirements: constraint.requirements || [],
      impact: constraint.impact || 'neutral'
    }));

  } catch (error) {
    console.error(`Erreur parsing JSON pour ${category}:`, error);
    return [];
  }
}

/**
 * Génération de la synthèse et recommandations
 */
async function generateSynthesis(
  data: ComprehensiveParcelAnalysis, 
  constraints: StructuredConstraint[]
): Promise<Omit<AnalysisResult, 'constraints'>> {
  
  const prompt = `Génère une synthèse complète basée sur ces contraintes d'urbanisme:

PARCELLE: ${data.searchQuery}
CONTRAINTES IDENTIFIÉES: ${constraints.length} contraintes

CONTRAINTES DÉTAILLÉES:
${constraints.map(c => `• ${c.category}: ${c.title} - ${c.description} (${c.severity})`).join('\n')}

DONNÉES COMPLÈTES:
${data.formattedForAI}

GÉNÈRE UNE ANALYSE STRUCTURÉE:

1. SYNTHÈSE (150 mots max): Résumé des principales contraintes et opportunités
2. RECOMMANDATIONS (5-7 points): Actions concrètes pour le maître d'ouvrage  
3. RISQUES (3-5 points): Principaux risques identifiés
4. OPPORTUNITÉS (3-5 points): Avantages et potentiels du terrain
5. PROCHAINES ÉTAPES (5-7 points): Démarches administratives et techniques

EXIGENCES:
- Être CONCRET et ACTIONNABLE
- Mentionner les VALEURS PRÉCISES des contraintes
- Éviter le jargon technique
- Donner des conseils PRATIQUES

Format JSON:
{
  "summary": "synthèse...",
  "recommendations": ["rec1", "rec2", ...],
  "risks": ["risque1", "risque2", ...],
  "opportunities": ["opp1", "opp2", ...],
  "nextSteps": ["étape1", "étape2", ...]
}`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o',
      temperature: 0.1,
      messages: [
        { 
          role: 'system', 
          content: 'Tu es un expert conseil en urbanisme. Fournis des analyses pratiques et actionnables pour les maîtres d\'ouvrage. Réponds UNIQUEMENT en JSON valide.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500
    });

    const content = response.choices[0].message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Pas de JSON valide dans la réponse');
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error('Erreur génération synthèse:', error);
    return {
      summary: 'Erreur lors de la génération de la synthèse',
      recommendations: [],
      risks: [],
      opportunities: [],
      nextSteps: []
    };
  }
}