/**
 * Analyse approfondie des documents RDPPF et règlements communaux
 * Utilise une lecture complète des PDFs et extraction de données concrètes
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { callOpenAI } from '../utils/openai';
import { extractTextFromPdf } from './rdppfExtractor';
import { ComprehensiveParcelAnalysis } from './parcelAnalysisOrchestrator';

export interface ConcreteConstraint {
  category: string;
  name: string;
  value: string | number;
  unit?: string;
  source: string;
  article?: string;
  confidence: number;
}

export interface DeepAnalysisResult {
  parcelInfo: {
    egrid: string;
    number: string;
    municipality: string;
    surface: number;
    zone: string;
    zoneDetails?: string;
  };
  concreteConstraints: ConcreteConstraint[];
  synthesisText: string;
  rdppfExtract?: string;
  regulationExtract?: string;
  confidence: number;
}

/**
 * Analyse approfondie avec lecture complète des documents
 */
export async function performDeepDocumentAnalysis(
  data: ComprehensiveParcelAnalysis
): Promise<DeepAnalysisResult> {
  console.log('🔬 Démarrage analyse approfondie des documents...');
  
  const result: DeepAnalysisResult = {
    parcelInfo: {
      egrid: data.searchResult?.egrid || '',
      number: data.parcelDetails?.number || data.searchResult?.number || '',
      municipality: data.parcelDetails?.municipality || '',
      surface: data.parcelDetails?.surface || 0,
      zone: 'À déterminer',
      zoneDetails: ''
    },
    concreteConstraints: [],
    synthesisText: '',
    confidence: 0
  };
  
  // Étape 1: Lire et analyser le RDPPF
  if (data.searchResult?.egrid) {
    const rdppfConstraints = await analyzeRDPPFDocument(data.searchResult.egrid);
    result.concreteConstraints.push(...rdppfConstraints.constraints);
    result.rdppfExtract = rdppfConstraints.extract;
    
    // Extraire la zone depuis le RDPPF
    const zoneConstraint = rdppfConstraints.constraints.find(c => 
      c.category === 'Zone' || c.name.toLowerCase().includes('zone')
    );
    if (zoneConstraint) {
      result.parcelInfo.zone = String(zoneConstraint.value);
      result.parcelInfo.zoneDetails = zoneConstraint.source;
    }
  }
  
  // Étape 2: Lire et analyser le règlement communal
  const municipality = data.parcelDetails?.municipality || 
    data.searchResult?.number?.match(/<b>([^<]+)<\/b>/)?.[1] || '';
  
  if (municipality) {
    const regulationConstraints = await analyzeCommunalRegulation(municipality, result.parcelInfo.zone);
    result.concreteConstraints.push(...regulationConstraints.constraints);
    result.regulationExtract = regulationConstraints.extract;
  }
  
  // Étape 3: Synthèse avec o3/gpt-4o
  result.synthesisText = await generateDeepSynthesis(result, data);
  
  // Calculer la confiance
  result.confidence = calculateConfidence(result);
  
  console.log(`✅ Analyse approfondie terminée: ${result.concreteConstraints.length} contraintes concrètes extraites`);
  
  return result;
}

/**
 * Analyser le document RDPPF
 */
async function analyzeRDPPFDocument(egrid: string): Promise<{
  constraints: ConcreteConstraint[];
  extract: string;
}> {
  console.log(`📄 Analyse RDPPF pour EGRID: ${egrid}`);
  
  try {
    const rdppfUrl = `https://rdppfvs.geopol.ch/extract/pdf?EGRID=${egrid}&LANG=fr`;
    
    // Télécharger et extraire le texte
    const { downloadRdppf } = await import('./rdppfExtractor');
    const pdfPath = await downloadRdppf(rdppfUrl);
    const rdppfText = await extractTextFromPdf(pdfPath);
    
    console.log(`📖 Texte RDPPF extrait: ${rdppfText.length} caractères`);
    
    // Utiliser GPT-4o pour extraire les contraintes concrètes
    const prompt = `Tu es un expert en urbanisme suisse. Analyse ce document RDPPF et extrais UNIQUEMENT les valeurs numériques concrètes et contraintes spécifiques.

DOCUMENT RDPPF:
${rdppfText.substring(0, 15000)}

MISSION: Extraire TOUTES les contraintes avec leurs valeurs EXACTES.

Format JSON STRICT:
{
  "constraints": [
    {
      "category": "Zone",
      "name": "Type de zone",
      "value": "Zone résidentielle R2" // ou autre désignation exacte
    },
    {
      "category": "Densité",
      "name": "IBUS",
      "value": 0.5,
      "unit": "coefficient"
    },
    {
      "category": "Hauteur",
      "name": "Hauteur maximale",
      "value": 12,
      "unit": "m"
    },
    {
      "category": "Distance",
      "name": "Distance à la limite",
      "value": 3,
      "unit": "m"
    }
  ],
  "zoneDetails": "Description détaillée de la zone et ses caractéristiques"
}

IMPORTANT:
- Extraire UNIQUEMENT les valeurs présentes dans le document
- NE JAMAIS inventer ou supposer des valeurs
- Inclure l'article/page source si visible
- Être exhaustif dans l'extraction`;

    const response = await callOpenAI({
      model: 'o3-mini',  // Utilisation du modèle o3-mini pour extraction précise
      temperature: 0,
      messages: [
        { role: 'system', content: 'Expert en extraction de données RDPPF. Réponds uniquement en JSON valide.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000
    });
    
    const content = response.choices[0].message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return { constraints: [], extract: rdppfText.substring(0, 500) };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    const constraints: ConcreteConstraint[] = (parsed.constraints || []).map((c: any) => ({
      category: c.category || 'Autre',
      name: c.name || 'Non spécifié',
      value: c.value,
      unit: c.unit,
      source: 'RDPPF',
      article: c.article,
      confidence: 90
    }));
    
    console.log(`✅ ${constraints.length} contraintes extraites du RDPPF`);
    
    return {
      constraints,
      extract: parsed.zoneDetails || rdppfText.substring(0, 1000)
    };
    
  } catch (error) {
    console.error('Erreur analyse RDPPF:', error);
    return { constraints: [], extract: '' };
  }
}

/**
 * Analyser le règlement communal
 */
async function analyzeCommunalRegulation(
  municipality: string, 
  zone: string
): Promise<{
  constraints: ConcreteConstraint[];
  extract: string;
}> {
  console.log(`📋 Analyse règlement communal de ${municipality} pour zone ${zone}`);
  
  try {
    const regulationPath = path.join(
      process.cwd(), 
      'reglements', 
      `VS_${municipality}_Règlement des constructions.pdf`
    );
    
    // Vérifier si le fichier existe
    await fs.access(regulationPath);
    
    // Extraire le texte
    const regulationText = await extractTextFromPdf(regulationPath);
    console.log(`📖 Texte règlement extrait: ${regulationText.length} caractères`);
    
    // Rechercher les sections pertinentes pour la zone
    const zoneSection = extractZoneSection(regulationText, zone);
    
    // Utiliser GPT-4o pour extraire les contraintes spécifiques à la zone
    const prompt = `Tu es un expert en règlements d'urbanisme suisses. Analyse ce règlement communal et extrais les contraintes SPÉCIFIQUES pour la zone "${zone}".

RÈGLEMENT COMMUNAL DE ${municipality.toUpperCase()}:
${zoneSection || regulationText.substring(0, 15000)}

ZONE CIBLE: ${zone}

MISSION: Extraire TOUTES les contraintes avec leurs valeurs EXACTES pour cette zone spécifique.

Format JSON STRICT:
{
  "constraints": [
    {
      "category": "Densité",
      "name": "Indice d'utilisation U",
      "value": 0.4,
      "unit": "coefficient",
      "article": "Art. 23"
    },
    {
      "category": "Densité", 
      "name": "IBUS",
      "value": 0.6,
      "unit": "coefficient",
      "article": "Art. 24"
    },
    {
      "category": "Hauteur",
      "name": "Hauteur maximale au faîte",
      "value": 10,
      "unit": "m",
      "article": "Art. 25"
    },
    {
      "category": "Hauteur",
      "name": "Nombre d'étages maximum",
      "value": 3,
      "unit": "étages",
      "article": "Art. 25"
    },
    {
      "category": "Distance",
      "name": "Distance minimale à la limite",
      "value": 4,
      "unit": "m",
      "article": "Art. 26"
    },
    {
      "category": "Stationnement",
      "name": "Places par logement",
      "value": 1.5,
      "unit": "places/logement",
      "article": "Art. 45"
    },
    {
      "category": "Espaces verts",
      "name": "Surface verte minimale",
      "value": 30,
      "unit": "%",
      "article": "Art. 50"
    }
  ],
  "zoneSpecificRules": "Règles spécifiques supplémentaires pour cette zone..."
}

CRITÈRES:
- Extraire UNIQUEMENT les valeurs pour la zone ${zone}
- Inclure TOUS les articles pertinents
- NE JAMAIS inventer de valeurs
- Si une valeur n'est pas spécifiée, ne pas l'inclure`;

    const response = await callOpenAI({
      model: 'o3',  // Utilisation du modèle o3 complet pour analyse approfondie du règlement
      temperature: 0,
      messages: [
        { role: 'system', content: 'Expert en extraction de règlements communaux suisses. Réponds uniquement en JSON valide.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000
    });
    
    const content = response.choices[0].message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return { constraints: [], extract: '' };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    const constraints: ConcreteConstraint[] = (parsed.constraints || []).map((c: any) => ({
      category: c.category || 'Autre',
      name: c.name || 'Non spécifié',
      value: c.value,
      unit: c.unit,
      source: `Règlement ${municipality}`,
      article: c.article,
      confidence: 85
    }));
    
    console.log(`✅ ${constraints.length} contraintes extraites du règlement communal`);
    
    return {
      constraints,
      extract: parsed.zoneSpecificRules || zoneSection?.substring(0, 1000) || ''
    };
    
  } catch (error) {
    console.error('Erreur analyse règlement communal:', error);
    return { constraints: [], extract: '' };
  }
}

/**
 * Extraire la section pertinente pour une zone
 */
function extractZoneSection(text: string, zone: string): string | null {
  const lines = text.split('\n');
  const zoneKeywords = zone.toLowerCase().split(' ');
  
  let inZoneSection = false;
  let sectionText = '';
  let linesSinceMatch = 0;
  
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    
    // Chercher le début de la section
    if (!inZoneSection) {
      const hasAllKeywords = zoneKeywords.every(kw => 
        lineLower.includes(kw) || lineLower.includes(kw.replace(/[éèê]/g, 'e'))
      );
      
      if (hasAllKeywords) {
        inZoneSection = true;
        sectionText = line + '\n';
        linesSinceMatch = 0;
      }
    } else {
      // Continuer à collecter la section
      sectionText += line + '\n';
      linesSinceMatch++;
      
      // Arrêter après 200 lignes ou si on trouve une nouvelle zone
      if (linesSinceMatch > 200 || 
          (lineLower.includes('zone') && !zoneKeywords.some(kw => lineLower.includes(kw)))) {
        break;
      }
    }
  }
  
  return sectionText || null;
}

/**
 * Générer une synthèse approfondie
 */
async function generateDeepSynthesis(
  result: DeepAnalysisResult,
  originalData: ComprehensiveParcelAnalysis
): Promise<string> {
  console.log('🧠 Génération synthèse approfondie avec o3/gpt-4o...');
  
  const constraintsSummary = result.concreteConstraints.map(c => 
    `- ${c.category} / ${c.name}: ${c.value}${c.unit ? ' ' + c.unit : ''} ${c.article ? `(${c.article})` : ''}`
  ).join('\n');
  
  const prompt = `Tu es un expert urbaniste consultant pour un projet à ${result.parcelInfo.municipality}.

PARCELLE ANALYSÉE:
- Numéro: ${result.parcelInfo.number}
- EGRID: ${result.parcelInfo.egrid}
- Surface: ${result.parcelInfo.surface} m²
- Zone: ${result.parcelInfo.zone}
- Commune: ${result.parcelInfo.municipality}

CONTRAINTES CONCRÈTES EXTRAITES:
${constraintsSummary}

EXTRAIT RDPPF:
${result.rdppfExtract?.substring(0, 1000)}

EXTRAIT RÈGLEMENT COMMUNAL:
${result.regulationExtract?.substring(0, 1000)}

MISSION:
Rédige une analyse CONVERSATIONNELLE et CONCRÈTE pour le maître d'ouvrage.

INSTRUCTIONS STRICTES:
1. Utiliser TOUTES les valeurs numériques extraites
2. Être ULTRA-SPÉCIFIQUE avec les contraintes de la parcelle
3. Calculer les surfaces constructibles possibles
4. Mentionner les articles de référence
5. Proposer des scénarios de construction concrets
6. Identifier les points d'attention critiques
7. Suggérer les optimisations possibles

Le texte doit être fluide, professionnel et inclure TOUTES les valeurs concrètes.
Environ 600-800 mots.`;

  const response = await callOpenAI({
    model: 'o3',  // Utilisation du modèle o3 pour synthèse avec raisonnement avancé
    temperature: 0.1,
    messages: [
      { 
        role: 'system', 
        content: 'Expert urbaniste suisse. Fournis une analyse détaillée et concrète avec toutes les valeurs numériques. Utilise un raisonnement approfondi pour calculer les surfaces constructibles et proposer des scénarios.' 
      },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2500
  });
  
  return response.choices[0].message?.content || 'Analyse non disponible';
}

/**
 * Calculer la confiance de l'analyse
 */
function calculateConfidence(result: DeepAnalysisResult): number {
  let score = 0;
  
  // Points pour les données de base
  if (result.parcelInfo.egrid) score += 10;
  if (result.parcelInfo.surface > 0) score += 10;
  if (result.parcelInfo.zone !== 'À déterminer') score += 20;
  
  // Points pour les contraintes extraites
  const hasIBUS = result.concreteConstraints.some(c => c.name.toLowerCase().includes('ibus'));
  const hasHeight = result.concreteConstraints.some(c => c.category === 'Hauteur');
  const hasDistance = result.concreteConstraints.some(c => c.category === 'Distance');
  
  if (hasIBUS) score += 20;
  if (hasHeight) score += 15;
  if (hasDistance) score += 15;
  
  // Points pour le nombre de contraintes
  score += Math.min(result.concreteConstraints.length * 2, 20);
  
  return Math.min(score, 95);
}