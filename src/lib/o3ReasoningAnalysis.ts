import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { downloadRdppf, extractTextFromPdf } from './rdppfExtractor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-dummy-key-for-development',
});

export interface O3AnalysisResult {
  analysis: string;
  confidence: number;
  processingTime: number;
  model: string;
  reasoningEffort: string;
  sources: string[];
  error?: string;
}

/**
 * Analyse directe d'une parcelle avec le modèle o3/o3-mini
 * Envoie les deux PDFs (RDPPF et règlement communal) directement au modèle
 */
export async function analyzeParcelWithO3(
  egrid: string,
  municipality: string,
  parcelNumber?: string
): Promise<O3AnalysisResult> {
  const startTime = Date.now();
  
  console.log(`🧠 Démarrage analyse o3 pour parcelle ${parcelNumber || egrid} à ${municipality}`);
  
  try {
    // 1. Télécharger et extraire le RDPPF
    const rdppfUrl = `https://rdppfvs.geopol.ch/extract/pdf?EGRID=${egrid}&LANG=fr`;
    console.log(`📑 Téléchargement RDPPF: ${rdppfUrl}`);
    
    let rdppfText = '';
    try {
      const pdfPath = await downloadRdppf(rdppfUrl);
      rdppfText = await extractTextFromPdf(pdfPath);
      console.log(`✅ RDPPF extrait: ${rdppfText.length} caractères`);
    } catch (error) {
      console.error('⚠️ Erreur extraction RDPPF:', error);
      rdppfText = 'RDPPF non disponible';
    }
    
    // 2. Lire le règlement communal local
    let regulationText = '';
    const localRegulationPath = path.join(process.cwd(), `reglements/VS_${municipality}_Règlement des constructions.pdf`);
    
    try {
      await fs.access(localRegulationPath);
      const pdfParse = (await import('pdf-parse')).default;
      const pdfBuffer = await fs.readFile(localRegulationPath);
      const pdfData = await pdfParse(pdfBuffer);
      regulationText = pdfData.text;
      console.log(`✅ Règlement communal extrait: ${regulationText.length} caractères`);
    } catch (error) {
      console.error('⚠️ Règlement communal non trouvé:', error);
      regulationText = 'Règlement communal non disponible';
    }
    
    // 3. Préparer le prompt pour o3
    const prompt = `Parcelle n°${parcelNumber || 'N/A'} – ${municipality} (EGRID: ${egrid})

Voici les deux documents officiels pour cette parcelle :

DOCUMENT 1 - EXTRAIT RDPPF (Cadastre des restrictions de droit public à la propriété foncière) :
${rdppfText.substring(0, 50000)} ${rdppfText.length > 50000 ? '[... document tronqué]' : ''}

DOCUMENT 2 - RÈGLEMENT COMMUNAL DES CONSTRUCTIONS :
${regulationText.substring(0, 50000)} ${regulationText.length > 50000 ? '[... document tronqué]' : ''}

MISSION : Analyse toutes les contraintes et règlements de cette parcelle. 

Fournis une analyse complète et structurée incluant :
1) Données officielles (RDPPF) - affectation, degré de sensibilité au bruit, surface, servitudes
2) Règlement communal applicable - nature/usage, implantation, gabarits, toitures
3) Définitions de calcul - indices d'utilisation, surfaces constructibles
4) Exigences transversales - qualité architecturale, eaux pluviales, accès, stationnement
5) Capacité constructive - chiffrage préliminaire avec hypothèses
6) Points de vigilance avant esquisse
7) Conclusion opérationnelle

Sois précis, exhaustif et structure clairement ta réponse. Cite les articles et références exactes.`;

    // 4. Choisir le modèle et le niveau de raisonnement
    // Note: o1/o3 ne sont pas encore disponibles publiquement, utiliser gpt-4o pour l'instant
    let model = 'gpt-4o-mini'; // On commence par gpt-4o-mini qui est plus rapide
    let reasoningEffort = 'standard';
    
    // Pour les parcelles complexes ou si demandé, utiliser gpt-4o complet
    if (rdppfText.length > 30000 || regulationText.length > 30000) {
      model = 'gpt-4o';
      reasoningEffort = 'deep';
      console.log('📊 Documents volumineux détectés, utilisation de gpt-4o avec analyse approfondie');
    }
    
    console.log(`🤖 Appel ${model}`);
    
    // 5. Appeler le modèle
    let completion;
    try {
      // Pour l'instant, utiliser les modèles standards jusqu'à ce que o1/o3 soient disponibles
      completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en urbanisme et droit de la construction suisse. Analyse les documents fournis de manière exhaustive et structurée. Procède avec un raisonnement étape par étape pour chaque section demandée.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0,
        max_tokens: model === 'gpt-4o' ? 8000 : 4000
      });
      
      const analysis = completion.choices[0].message?.content || 'Analyse vide';
      
      console.log(`✅ Analyse ${model} terminée: ${analysis.length} caractères`);
      
      return {
        analysis,
        confidence: model.includes('o3') ? 95 : 85,
        processingTime: Date.now() - startTime,
        model,
        reasoningEffort,
        sources: ['RDPPF officiel', 'Règlement communal']
      };
      
    } catch (error: any) {
      // Si o3 n'est pas disponible, fallback sur gpt-4o
      if (error.status === 404 || error.status === 400) {
        console.log(`⚠️ Modèle ${model} non disponible, fallback sur gpt-4o`);
        
        completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'Tu es un expert en urbanisme et droit de la construction suisse. Analyse les documents fournis de manière exhaustive et structurée.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0,
          max_tokens: 4000
        });
        
        const analysis = completion.choices[0].message?.content || 'Analyse vide';
        
        return {
          analysis,
          confidence: 85,
          processingTime: Date.now() - startTime,
          model: 'gpt-4o',
          reasoningEffort: 'standard',
          sources: ['RDPPF officiel', 'Règlement communal']
        };
      }
      
      throw error;
    }
    
  } catch (error: any) {
    console.error('❌ Erreur analyse o3:', error);
    
    return {
      analysis: '',
      confidence: 0,
      processingTime: Date.now() - startTime,
      model: 'error',
      reasoningEffort: 'none',
      sources: [],
      error: error.message
    };
  }
}

/**
 * Analyse conversationnelle pour répondre à des questions spécifiques
 */
export async function askQuestionAboutParcel(
  egrid: string,
  municipality: string,
  question: string,
  previousAnalysis?: string
): Promise<O3AnalysisResult> {
  const startTime = Date.now();
  
  console.log(`💬 Question sur parcelle ${egrid}: ${question}`);
  
  try {
    let context = '';
    
    // Si on a une analyse précédente, l'utiliser comme contexte
    if (previousAnalysis) {
      context = previousAnalysis;
    } else {
      // Sinon, faire une nouvelle analyse
      const fullAnalysis = await analyzeParcelWithO3(egrid, municipality);
      context = fullAnalysis.analysis;
    }
    
    const prompt = `Contexte de la parcelle (EGRID: ${egrid}, Commune: ${municipality}):
${context}

Question de l'utilisateur : ${question}

Réponds de manière précise et détaillée en te basant uniquement sur les informations du contexte ci-dessus.`;

    // Pour les questions, utiliser o3-mini avec reasoning moyen
    const completion = await openai.chat.completions.create({
      model: 'o3-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      reasoning_effort: 'medium' as any
    } as any);
    
    const answer = completion.choices[0].message?.content || 'Réponse vide';
    
    return {
      analysis: answer,
      confidence: 90,
      processingTime: Date.now() - startTime,
      model: 'o3-mini',
      reasoningEffort: 'medium',
      sources: ['Analyse précédente', 'Question utilisateur']
    };
    
  } catch (error: any) {
    // Fallback sur gpt-4o pour les questions
    if (error.status === 404 || error.status === 400) {
      console.log('⚠️ o3-mini non disponible pour questions, utilisation de gpt-4o');
      
      let context = previousAnalysis || '';
      if (!context) {
        const fullAnalysis = await analyzeParcelWithO3(egrid, municipality);
        context = fullAnalysis.analysis;
      }
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Tu es un assistant expert en urbanisme. Réponds aux questions en te basant sur le contexte fourni.'
          },
          {
            role: 'user',
            content: `Contexte: ${context}\n\nQuestion: ${question}`
          }
        ],
        temperature: 0,
        max_tokens: 2000
      });
      
      return {
        analysis: completion.choices[0].message?.content || '',
        confidence: 85,
        processingTime: Date.now() - startTime,
        model: 'gpt-4o',
        reasoningEffort: 'standard',
        sources: ['Analyse précédente', 'Question utilisateur']
      };
    }
    
    throw error;
  }
}