/**
 * Analyse experte urbanistique - Extraction exhaustive des contraintes
 * Se concentre UNIQUEMENT sur les contraintes réglementaires sans conseils généraux
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { callOpenAI } from '../utils/openai';
import { extractTextFromPdf } from './rdppfExtractor';
import { ComprehensiveParcelAnalysis } from './parcelAnalysisOrchestrator';

export interface UrbanConstraint {
  category: string;
  subcategory?: string;
  constraint: string;
  value: string | number;
  unit?: string;
  article: string;
  source: 'RDPPF' | 'Règlement communal' | 'RDPPF et Règlement';
  pageReference?: number;
  applicableToZone: boolean;
  mandatory: boolean;
}

export interface ExpertUrbanAnalysis {
  parcelIdentification: {
    egrid: string;
    number: string;
    municipality: string;
    surface: number;
    zone: string;
    zoneCode?: string;
  };
  
  // Contraintes exhaustives organisées par catégorie
  constraints: {
    zoning: UrbanConstraint[];           // Zone et affectation
    density: UrbanConstraint[];           // IBUS, indice U, taux occupation
    heights: UrbanConstraint[];           // Hauteurs, étages, gabarits
    distances: UrbanConstraint[];         // Distances aux limites, entre bâtiments
    parking: UrbanConstraint[];           // Places de stationnement obligatoires
    greenSpaces: UrbanConstraint[];       // Espaces verts, arborisation
    playgrounds: UrbanConstraint[];       // Places de jeux, espaces détente
    architecture: UrbanConstraint[];      // Toitures, façades, matériaux
    environment: UrbanConstraint[];       // Bruit, énergie, environnement
    procedures: UrbanConstraint[];        // Procédures, délais, autorisations
    specialRestrictions: UrbanConstraint[]; // Servitudes, restrictions spéciales
  };
  
  calculatedValues: {
    maxBuildableSurface: number;
    maxBuildableVolume?: number;
    requiredParkingSpaces: number;
    requiredGreenSpace: number;
    requiredPlaygroundArea?: number;
    maxHeight: number;
    minDistanceToBoundary: number;
  };
  
  synthesis: string;
  completeness: number;
  confidence: number;
}

/**
 * Analyse experte complète focalisée sur l'extraction exhaustive
 */
export async function performExpertUrbanAnalysis(
  data: ComprehensiveParcelAnalysis
): Promise<ExpertUrbanAnalysis> {
  console.log('🏛️ Démarrage analyse urbanistique experte exhaustive...');
  console.log('📋 Données reçues:', {
    egrid: data.searchResult?.egrid,
    number: data.searchResult?.number,
    municipality: data.parcelDetails?.municipality || extractMunicipality(data),
    surface: data.parcelDetails?.surface || data.rdppfData?.zoneAffectation?.surface
  });
  
  // Identification de la parcelle
  const parcelId = {
    egrid: data.searchResult?.egrid || '',
    number: data.parcelDetails?.number || data.searchResult?.number || '',
    municipality: data.parcelDetails?.municipality || extractMunicipality(data),
    surface: data.parcelDetails?.surface || extractSurface(data) || 1000, // Surface par défaut si inconnue
    zone: '',
    zoneCode: ''
  };
  
  // Si pas d'EGRID, essayer de le récupérer depuis le searchResult
  if (!parcelId.egrid && data.searchResult) {
    console.log('⚠️ EGRID manquant, tentative d\'extraction depuis searchResult');
    // L'EGRID devrait déjà être dans searchResult grâce à nos corrections
  }
  
  // Étape 1: Analyser le RDPPF en profondeur
  const rdppfConstraints = await analyzeRDPPFExhaustive(parcelId.egrid);
  
  // Extraire la zone depuis RDPPF
  const zoneConstraint = rdppfConstraints.find(c => c.category === 'zoning');
  if (zoneConstraint) {
    parcelId.zone = String(zoneConstraint.value);
    parcelId.zoneCode = zoneConstraint.constraint;
  }
  
  // Étape 2: Analyser le règlement communal article par article
  const regulationConstraints = await analyzeRegulationExhaustive(
    parcelId.municipality,
    parcelId.zone
  );
  
  // Étape 3: Fusionner et organiser les contraintes
  const allConstraints = [...rdppfConstraints, ...regulationConstraints];
  const organizedConstraints = organizeConstraintsByCategory(allConstraints, parcelId.zone);
  
  // Étape 4: Calculer les valeurs dérivées
  const calculated = calculateDerivedValues(organizedConstraints, parcelId.surface);
  
  // Étape 5: Générer la synthèse experte
  const synthesis = await generateExpertSynthesis(parcelId, organizedConstraints, calculated);
  
  // Calculer la complétude
  const completeness = calculateCompleteness(organizedConstraints);
  
  return {
    parcelIdentification: parcelId,
    constraints: organizedConstraints,
    calculatedValues: calculated,
    synthesis,
    completeness,
    confidence: Math.min(95, completeness + 10)
  };
}

/**
 * Analyser le RDPPF de manière exhaustive
 */
async function analyzeRDPPFExhaustive(egrid: string): Promise<UrbanConstraint[]> {
  if (!egrid) {
    console.log('⚠️ Pas d\'EGRID pour télécharger le RDPPF');
    return [];
  }
  
  console.log(`📄 Analyse exhaustive RDPPF pour ${egrid}`);
  
  try {
    const rdppfUrl = `https://rdppfvs.geopol.ch/extract/pdf?EGRID=${egrid}&LANG=fr`;
    console.log(`🔗 URL RDPPF: ${rdppfUrl}`);
    
    const { downloadRdppf } = await import('./rdppfExtractor');
    const pdfPath = await downloadRdppf(rdppfUrl);
    const rdppfText = await extractTextFromPdf(pdfPath);
    
    console.log(`📖 Texte RDPPF extrait: ${rdppfText.length} caractères`);
    
    // Analyser chaque section du RDPPF
    const prompt = `Tu es un expert en analyse de documents RDPPF suisses. Analyse ce document et extrais TOUTES les contraintes.

DOCUMENT RDPPF (premiers 20000 caractères):
${rdppfText.substring(0, 20000)}

MISSION: Extraire EXHAUSTIVEMENT toutes les contraintes et valeurs du document.

FOCUS OBLIGATOIRE - EXTRAIRE:
1. ZONE D'AFFECTATION EXACTE (ex: "Zone résidentielle 0.5", "Zone mixte", etc.)
2. SURFACE DE LA PARCELLE en m²
3. IBUS (Indice de bâtisse d'utilisation du sol) - valeur numérique
4. Indice U (indice d'utilisation) - valeur numérique
5. Hauteur maximale en mètres
6. Nombre d'étages maximum
7. Distance minimale aux limites en mètres
8. Degré de sensibilité au bruit (DS I, II, III ou IV)
9. Places de stationnement requises (ratio)
10. Pourcentage d'espaces verts obligatoire
11. Aires de jeux obligatoires en m²
12. Toutes servitudes et restrictions

Format JSON STRICT - Liste TOUTES les contraintes trouvées:
[
  {
    "category": "zoning|density|heights|distances|parking|greenSpaces|playgrounds|environment|specialRestrictions",
    "subcategory": "détail spécifique",
    "constraint": "nom exact de la contrainte",
    "value": "valeur EXACTE trouvée dans le document",
    "unit": "m²|m|%|étages|places|coefficient",
    "article": "référence article/page du document",
    "pageReference": numéro_page_si_visible,
    "mandatory": true/false
  }
]

RÈGLES STRICTES:
- Si tu vois "Zone résidentielle 0.5 (3)", extrais: category:"zoning", value:"Zone résidentielle 0.5 (3)"
- Si tu vois "Surface: 862 m²", extrais: category:"zoning", constraint:"Surface parcelle", value:862, unit:"m²"
- Si tu vois "IBUS 0.6", extrais: category:"density", constraint:"IBUS", value:0.6, unit:"coefficient"
- EXTRAIRE TOUTES LES VALEURS NUMÉRIQUES
- NE JAMAIS inventer de valeurs`;

    const response = await callOpenAI({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { role: 'system', content: 'Expert en extraction RDPPF. Sois exhaustif. Réponds uniquement en JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000
    });
    
    const content = response.choices[0].message?.content || '[]';
    const constraints = JSON.parse(content.match(/\[[\s\S]*\]/)?.[0] || '[]');
    
    return constraints.map((c: any) => ({
      ...c,
      source: 'RDPPF',
      applicableToZone: true
    }));
    
  } catch (error) {
    console.error('Erreur analyse RDPPF:', error);
    return [];
  }
}

/**
 * Analyser le règlement communal de manière exhaustive
 */
async function analyzeRegulationExhaustive(
  municipality: string,
  zone: string
): Promise<UrbanConstraint[]> {
  if (!municipality) return [];
  
  console.log(`📋 Analyse exhaustive règlement ${municipality} pour zone ${zone}`);
  
  try {
    const regulationPath = path.join(
      process.cwd(),
      'reglements',
      `VS_${municipality}_Règlement des constructions.pdf`
    );
    
    await fs.access(regulationPath);
    const regulationText = await extractTextFromPdf(regulationPath);
    
    // Analyser article par article
    const articles = extractArticles(regulationText);
    const constraints: UrbanConstraint[] = [];
    
    // Analyser chaque article pour la zone spécifique
    for (const article of articles) {
      const articleConstraints = await analyzeArticle(article, zone, municipality);
      constraints.push(...articleConstraints);
    }
    
    // Analyse globale pour capturer les contraintes manquées
    const globalConstraints = await analyzeGlobalRegulation(regulationText, zone, municipality);
    constraints.push(...globalConstraints);
    
    return constraints;
    
  } catch (error) {
    console.error('Erreur analyse règlement:', error);
    return [];
  }
}

/**
 * Extraire les articles du règlement
 */
function extractArticles(text: string): Array<{number: string, content: string}> {
  const articles: Array<{number: string, content: string}> = [];
  const lines = text.split('\n');
  
  let currentArticle: {number: string, content: string} | null = null;
  
  for (const line of lines) {
    // Détecter le début d'un article
    const articleMatch = line.match(/^(?:Art(?:icle)?\.?\s*)?(\d+(?:\.\d+)?)/);
    if (articleMatch) {
      if (currentArticle) {
        articles.push(currentArticle);
      }
      currentArticle = {
        number: articleMatch[1],
        content: line
      };
    } else if (currentArticle) {
      currentArticle.content += '\n' + line;
    }
  }
  
  if (currentArticle) {
    articles.push(currentArticle);
  }
  
  return articles;
}

/**
 * Analyser un article spécifique
 */
async function analyzeArticle(
  article: {number: string, content: string},
  zone: string,
  municipality: string
): Promise<UrbanConstraint[]> {
  
  // Analyse directe par patterns pour extraction rapide
  const constraints: UrbanConstraint[] = [];
  const content = article.content.toLowerCase();
  
  // Patterns pour différentes contraintes
  const patterns = {
    heights: /hauteur\s*(?:max(?:imale)?|minimum)?\s*:?\s*(\d+(?:\.\d+)?)\s*(m|mètres?|étages?)/gi,
    distances: /distance\s*(?:min(?:imale)?|aux?\s+limites?)?\s*:?\s*(\d+(?:\.\d+)?)\s*(m|mètres?)/gi,
    density: /(?:ibus|indice\s*(?:u|d'utilisation))\s*:?\s*(\d+(?:\.\d+)?)/gi,
    parking: /(\d+(?:\.\d+)?)\s*places?\s*(?:de\s*)?(?:parc|stationnement)\s*(?:par|pour)\s*(\d+\s*m²|logement|appartement)/gi,
    greenSpaces: /(\d+)\s*%\s*(?:d')?espaces?\s*verts?/gi,
    playgrounds: /(\d+)\s*m²\s*(?:de\s*)?(?:place|aire|espace)s?\s*de\s*jeux?/gi
  };
  
  // Extraire les contraintes par pattern
  for (const [category, pattern] of Object.entries(patterns)) {
    const matches = [...content.matchAll(pattern)];
    for (const match of matches) {
      constraints.push({
        category: mapCategory(category),
        constraint: match[0],
        value: parseFloat(match[1]),
        unit: match[2] || '',
        article: `Art. ${article.number}`,
        source: 'Règlement communal',
        applicableToZone: isApplicableToZone(article.content, zone),
        mandatory: true
      });
    }
  }
  
  return constraints;
}

/**
 * Analyse globale du règlement avec IA
 */
async function analyzeGlobalRegulation(
  text: string,
  zone: string,
  municipality: string
): Promise<UrbanConstraint[]> {
  
  // Si pas de zone spécifiée, essayer de la détecter dans le texte
  const actualZone = zone || 'Zone à déterminer';
  console.log(`📋 Analyse globale du règlement pour zone: ${actualZone}`);
  
  const prompt = `Tu es un expert en règlements d'urbanisme suisses. Analyse ce règlement communal et extrais TOUTES les contraintes pour la zone "${actualZone}".

RÈGLEMENT: ${municipality}
ZONE CIBLE: ${actualZone}

TEXTE (premiers 25000 caractères):
${text.substring(0, 25000)}

MISSION: Extraire EXHAUSTIVEMENT toutes les contraintes qui s'appliquent à cette zone.

FOCUS OBLIGATOIRE:
1. Places de stationnement (nombre par logement, par m², visiteurs)
2. Places de jeux (surface minimale, pourcentage, localisation)
3. Espaces verts (pourcentage minimum, arborisation obligatoire)
4. Hauteurs (au faîte, à la corniche, totale, nombre d'étages)
5. Distances (aux limites, entre bâtiments, aux routes)
6. Indices (IBUS, indice U, taux d'occupation)
7. Toitures (type, pente, matériaux)
8. Façades (matériaux, couleurs)
9. Procédures (délais, autorisations spéciales)

Format JSON - Liste TOUTES les contraintes:
[
  {
    "category": "parking|playgrounds|greenSpaces|heights|distances|density|architecture|procedures",
    "subcategory": "détail spécifique",
    "constraint": "description exacte",
    "value": valeur_ou_texte,
    "unit": "unité",
    "article": "Art. X",
    "mandatory": true/false
  }
]`;

  const response = await callOpenAI({
    model: 'gpt-4o',
    temperature: 0,
    messages: [
      { role: 'system', content: 'Expert règlements communaux suisses. Extraction exhaustive. JSON uniquement.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 4000
  });
  
  const content = response.choices[0].message?.content || '[]';
  const constraints = JSON.parse(content.match(/\[[\s\S]*\]/)?.[0] || '[]');
  
  return constraints.map((c: any) => ({
    ...c,
    source: 'Règlement communal',
    applicableToZone: true
  }));
}

/**
 * Organiser les contraintes par catégorie
 */
function organizeConstraintsByCategory(
  constraints: UrbanConstraint[],
  zone: string
): ExpertUrbanAnalysis['constraints'] {
  
  const organized: ExpertUrbanAnalysis['constraints'] = {
    zoning: [],
    density: [],
    heights: [],
    distances: [],
    parking: [],
    greenSpaces: [],
    playgrounds: [],
    architecture: [],
    environment: [],
    procedures: [],
    specialRestrictions: []
  };
  
  for (const constraint of constraints) {
    // Filtrer par zone si applicable
    if (!constraint.applicableToZone && zone && !isApplicableToZone(String(constraint.value), zone)) {
      continue;
    }
    
    // Catégoriser
    const category = constraint.category.toLowerCase();
    
    if (category.includes('zon')) {
      organized.zoning.push(constraint);
    } else if (category.includes('dens') || category.includes('ibus') || category.includes('indice')) {
      organized.density.push(constraint);
    } else if (category.includes('haut') || category.includes('height')) {
      organized.heights.push(constraint);
    } else if (category.includes('dist')) {
      organized.distances.push(constraint);
    } else if (category.includes('park') || category.includes('station')) {
      organized.parking.push(constraint);
    } else if (category.includes('green') || category.includes('vert')) {
      organized.greenSpaces.push(constraint);
    } else if (category.includes('play') || category.includes('jeu')) {
      organized.playgrounds.push(constraint);
    } else if (category.includes('arch') || category.includes('toit') || category.includes('façade')) {
      organized.architecture.push(constraint);
    } else if (category.includes('env') || category.includes('bruit') || category.includes('énergie')) {
      organized.environment.push(constraint);
    } else if (category.includes('proc') || category.includes('délai')) {
      organized.procedures.push(constraint);
    } else {
      organized.specialRestrictions.push(constraint);
    }
  }
  
  return organized;
}

/**
 * Calculer les valeurs dérivées
 */
function calculateDerivedValues(
  constraints: ExpertUrbanAnalysis['constraints'],
  parcelSurface: number
): ExpertUrbanAnalysis['calculatedValues'] {
  
  // Extraire les valeurs des contraintes
  let ibus = 0;
  let maxHeight = 0;
  let minDistance = 999;
  let parkingRatio = 0;
  let greenSpacePercent = 0;
  let playgroundArea = 0;
  
  // IBUS/Densité
  for (const c of constraints.density) {
    if (c.constraint.toLowerCase().includes('ibus') && typeof c.value === 'number') {
      ibus = Math.max(ibus, c.value);
    }
  }
  
  // Hauteur max
  for (const c of constraints.heights) {
    if (typeof c.value === 'number' && c.unit?.includes('m')) {
      maxHeight = Math.max(maxHeight, c.value);
    }
  }
  
  // Distance min
  for (const c of constraints.distances) {
    if (typeof c.value === 'number') {
      minDistance = Math.min(minDistance, c.value);
    }
  }
  
  // Stationnement
  for (const c of constraints.parking) {
    if (typeof c.value === 'number') {
      if (c.constraint.includes('logement')) {
        parkingRatio = c.value;
      }
    }
  }
  
  // Espaces verts
  for (const c of constraints.greenSpaces) {
    if (typeof c.value === 'number' && c.unit === '%') {
      greenSpacePercent = Math.max(greenSpacePercent, c.value);
    }
  }
  
  // Aires de jeux
  for (const c of constraints.playgrounds) {
    if (typeof c.value === 'number' && c.unit?.includes('m²')) {
      playgroundArea = Math.max(playgroundArea, c.value);
    }
  }
  
  // Calculs
  const maxBuildableSurface = parcelSurface * ibus;
  const requiredGreenSpace = parcelSurface * (greenSpacePercent / 100);
  const requiredParkingSpaces = Math.ceil(maxBuildableSurface / 100 * parkingRatio); // Estimation
  
  return {
    maxBuildableSurface: Math.round(maxBuildableSurface),
    maxBuildableVolume: maxBuildableSurface * maxHeight,
    requiredParkingSpaces,
    requiredGreenSpace: Math.round(requiredGreenSpace),
    requiredPlaygroundArea: playgroundArea,
    maxHeight,
    minDistanceToBoundary: minDistance === 999 ? 3 : minDistance // Défaut 3m
  };
}

/**
 * Générer la synthèse experte
 */
async function generateExpertSynthesis(
  parcel: ExpertUrbanAnalysis['parcelIdentification'],
  constraints: ExpertUrbanAnalysis['constraints'],
  calculated: ExpertUrbanAnalysis['calculatedValues']
): Promise<string> {
  
  // Compter les contraintes
  const totalConstraints = Object.values(constraints).reduce((sum, cat) => sum + cat.length, 0);
  
  const prompt = `Tu es un expert urbaniste suisse. Rédige une synthèse TECHNIQUE et FACTUELLE des contraintes.

PARCELLE:
- EGRID: ${parcel.egrid}
- Surface: ${parcel.surface} m²
- Zone: ${parcel.zone}
- Commune: ${parcel.municipality}

CONTRAINTES IDENTIFIÉES: ${totalConstraints}

VALEURS CALCULÉES:
- Surface constructible max: ${calculated.maxBuildableSurface} m²
- Hauteur max: ${calculated.maxHeight} m
- Distance min aux limites: ${calculated.minDistanceToBoundary} m
- Places de parc requises: ${calculated.requiredParkingSpaces}
- Espaces verts requis: ${calculated.requiredGreenSpace} m²
- Aires de jeux requises: ${calculated.requiredPlaygroundArea} m²

PRINCIPALES CONTRAINTES PAR CATÉGORIE:
${Object.entries(constraints).map(([cat, items]) => 
  items.length > 0 ? `${cat}: ${items.slice(0, 3).map(i => `${i.constraint} (${i.article})`).join(', ')}` : ''
).filter(Boolean).join('\n')}

MISSION: Rédige une synthèse TECHNIQUE de 200-300 mots qui:
1. Énonce les contraintes principales avec leurs valeurs exactes
2. Cite les articles de référence
3. Mentionne les obligations (stationnement, espaces verts, jeux)
4. NE DONNE PAS de conseils généraux
5. NE PARLE PAS d'opportunités ou de potentiel
6. RESTE FACTUEL et TECHNIQUE

Synthèse technique:`;

  const response = await callOpenAI({
    model: 'gpt-4o',
    temperature: 0,
    messages: [
      { role: 'system', content: 'Expert urbaniste suisse. Synthèse technique factuelle uniquement.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 800
  });
  
  return response.choices[0].message?.content || '';
}

// Fonctions utilitaires
function extractMunicipality(data: ComprehensiveParcelAnalysis): string {
  const label = data.searchResult?.number || '';
  const match = label.match(/<b>([^<]+)<\/b>/);
  if (match) {
    const municipality = match[1];
    // Si c'est un code postal (4 chiffres), chercher le vrai nom après
    if (/^\d{4}$/.test(municipality)) {
      const realMatch = label.match(/\d{4}\s+([^<]+)/);
      return realMatch ? realMatch[1].trim() : '';
    }
    return municipality;
  }
  return '';
}

function extractSurface(data: ComprehensiveParcelAnalysis): number {
  if (data.parcelDetails?.surface) return data.parcelDetails.surface;
  if (data.rdppfData?.zoneAffectation?.surface) return data.rdppfData.zoneAffectation.surface;
  return 0;
}

function isApplicableToZone(text: string, targetZone: string): boolean {
  if (!targetZone) return true;
  const textLower = text.toLowerCase();
  const zoneLower = targetZone.toLowerCase();
  
  // Vérifier si le texte mentionne la zone
  const zoneKeywords = zoneLower.split(/\s+/);
  return zoneKeywords.some(kw => textLower.includes(kw));
}

function mapCategory(category: string): string {
  const mapping: Record<string, string> = {
    'heights': 'heights',
    'distances': 'distances',
    'density': 'density',
    'parking': 'parking',
    'greenSpaces': 'greenSpaces',
    'playgrounds': 'playgrounds'
  };
  return mapping[category] || 'specialRestrictions';
}

function calculateCompleteness(constraints: ExpertUrbanAnalysis['constraints']): number {
  let score = 0;
  const weights = {
    zoning: 15,
    density: 15,
    heights: 10,
    distances: 10,
    parking: 15,
    greenSpaces: 10,
    playgrounds: 10,
    architecture: 5,
    environment: 5,
    procedures: 3,
    specialRestrictions: 2
  };
  
  for (const [category, weight] of Object.entries(weights)) {
    const categoryConstraints = constraints[category as keyof typeof constraints];
    if (categoryConstraints && categoryConstraints.length > 0) {
      score += weight;
    }
  }
  
  return Math.min(95, score);
}