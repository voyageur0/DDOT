import { Router, Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import axios from 'axios';
import { performComprehensiveAnalysis, performQuickAnalysis } from '../lib/parcelAnalysisOrchestrator';
import { callOpenAI } from '../utils/openai';
import { performStructuredAnalysis, type AnalysisResult } from '../lib/aiAnalysisEngine';
import { performAdvancedAnalysis, type AdvancedAnalysisResult } from '../lib/advancedAIAnalysisEngine';
import { performConversationalAnalysis, answerSpecificQuestion } from '../lib/conversationalAIAnalysis';
import { formatContext } from '../engine/contextFormatterWithLabels';
import { calculateFeasibility } from '../services/feasibilityCalculatorWithLabels';
// import { normalizeConstraints } from '../i18n/constraintNormalizer'; // TODO: Fix après compilation

const router = Router();

// Clé OpenAI depuis variable d'environnement uniquement
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ ERREUR CRITIQUE: OPENAI_API_KEY manquante dans les variables d\'environnement');
  console.error('📝 Créez un fichier .env avec OPENAI_API_KEY=sk-votre-cle-api');
}

// Test de la clé API au démarrage
async function testOpenAIConnection() {
  if (!OPENAI_API_KEY) {
    console.log('⚠️ OpenAI désactivé - clé API manquante');
    return false;
  }

  try {
    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ OpenAI connecté avec succès');
    return true;
  } catch (error: any) {
    console.error('❌ Erreur de connexion OpenAI:', error.response?.status, error.response?.statusText);
    if (error.response?.status === 401) {
      console.error('🔑 Clé API OpenAI invalide ou expirée');
    }
    return false;
  }
}

// Test au démarrage du module
testOpenAIConnection();

// Nouvelle fonction d'appel OpenAI avec analyse approfondie
async function callOpenAIWithDeepSearch(comprehensiveData: any): Promise<string> {
  console.log('🚀 🧠 Démarrage analyse approfondie avec modèle gpt-4.1');
  
  try {
    const parcelLabel = comprehensiveData.parcelDetails?.number ? `Parcelle ${comprehensiveData.parcelDetails.number}` : comprehensiveData.searchQuery;

    // Le message système inclut directement notre tableau structuré
    const enrichedPrompt = `${comprehensiveData.formattedForAI}

---

INSTRUCTION STRICTE : Utilise UNIQUEMENT les données ci-dessus pour remplir les 8 thèmes obligatoires.
Si une donnée manque, écris "Non spécifié dans les documents analysés" mais UTILISE TOUTES les contraintes extraites.

Exemples concrets trouvés dans les documents :
- STATIONNEMENT : Si tu vois "1 place par 65 m²", utilise cette règle exacte
- GABARITS : Si tu vois "hauteur max 12 m", utilise cette valeur exacte  
- ZONES : Si tu vois "zone d'habitation R2", utilise cette désignation exacte

STRUCTURE OBLIGATOIRE (9 thèmes numérotés) :
1. **Identification** : Parcelle, commune, coordonnées
2. **Destination de zone** : Type exact depuis RDPPF/règlement
3. **Indice d'utilisation (IBUS)** : Valeur exacte si mentionnée
4. **Densité constructible** : Surfaces constructibles calculées selon les règles valaisannes (indices U et IBUS)
5. **Gabarits & reculs** : Hauteurs et distances exactes
6. **Toiture** : Contraintes exactes (pente, matériaux)
7. **Stationnement** : Règles exactes (nombre places/m²)
8. **Espaces de jeux/détente** : Obligations exactes si mentionnées
9. **Prescriptions architecturales** : Contraintes exactes de style/matériaux`;

    const analysisResponse = await callOpenAI({
      model: 'gpt-4.1',
      temperature: 0,
      messages: [
        { role: 'system', content: 'Tu es un expert urbaniste suisse. En te basant STRICTEMENT sur les données fournies, rédige une synthèse vulgarisée à destination d\'un maître d\'ouvrage.' },
        { role: 'user', content: enrichedPrompt }
      ],
      max_tokens: 1500
    });

    const analysis = analysisResponse.choices[0].message?.content || '';

    console.log(`✅ Analyse approfondie terminée: ${analysis.length} caractères`);
    return analysis;

  } catch (error: any) {
    console.error('💥 ERREUR ANALYSE APPROFONDIE:', error.message);
    throw new Error(`Erreur analyse approfondie: ${error.message}`);
  }
}

// Fonction d'appel à OpenAI SIMPLIFIÉE - pour compatibilité avec l'ancien système
async function callOpenAISimple(userQuery: string, communeData: any, parcelData: any): Promise<string> {
  console.log('🤖 Appel OpenAI avec connaissances de base');
  
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert urbaniste spécialisé dans les règlements du canton du Valais, Suisse. 

Utilise UNIQUEMENT tes vraies connaissances des règlements valaisans.
Baser l'analyse sur les vrais principes d'urbanisme du Valais.
Mentionner les vraies références légales (LAT, LCAT, règlements communaux).`
        },
        {
          role: 'user',
          content: userQuery
        }
      ],
      max_tokens: 3000,
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return response.data.choices[0].message.content;
    
  } catch (error: any) {
    console.error('💥 ERREUR OPENAI:', error.response?.data || error.message);
    throw new Error(`Erreur OpenAI: ${error.response?.data?.error?.message || error.message}`);
  }
}

router.post('/ia-constraints', async (req, res, next) => {
  try {
    console.log('📞 Requête IA reçue:', req.body);
    
    const { coordinates, address, commune, parcelId, searchQuery, analysisType = 'complete', useConversational = true } = req.body;

    // NOUVEAU WORKFLOW: Recherche automatisée complète
    if (searchQuery) {
      console.log(`🔍 Démarrage analyse automatisée pour: "${searchQuery}"`);
      
      const t0 = performance.now();
      
      try {
        // Choisir le type d'analyse
        const analysisFunction = analysisType === 'quick' ? performQuickAnalysis : performComprehensiveAnalysis;
        
        // Effectuer la recherche et collecte automatisée
        const comprehensiveData = await analysisFunction(searchQuery);
        
        if (comprehensiveData.completeness === 0 || !comprehensiveData.formattedForAI) {
          return res.status(404).json({ 
            error: 'Parcelle non trouvée ou données insuffisantes',
            details: comprehensiveData.errors.join('; '),
            searchQuery,
            completeness: comprehensiveData.completeness
          });
        }
        
        console.log(`📊 Données collectées (${comprehensiveData.completeness}% complétude) - Lancement analyse IA...`);
        
        // Choisir le type d'analyse IA
        let analysisResult;
        let analysisMode;
        
        if (useConversational) {
          // Utiliser le nouveau système d'analyse avec o3
          if (comprehensiveData.searchResult?.egrid) {
            try {
              const { analyzeParcelWithO3 } = await import('../lib/o3ReasoningAnalysis');
              const municipality = comprehensiveData.parcelDetails?.municipality || 
                comprehensiveData.searchResult?.number?.match(/<b>([^<]+)<\/b>/)?.[1]?.replace(/^\d{4}\s+/, '') || 
                'Vétroz';
              
              // Extraire le numéro de parcelle sans l'adresse
              const parcelNumber = comprehensiveData.parcelDetails?.number || 
                comprehensiveData.searchResult?.number?.match(/(\d+)\s*\(/)?.[1] ||
                comprehensiveData.searchResult?.number?.match(/parcelle\s+(\d+)/i)?.[1];
              
              console.log(`🧠 Analyse O3 pour EGRID ${comprehensiveData.searchResult.egrid}, parcelle n°${parcelNumber}`);
              const o3Result = await analyzeParcelWithO3(comprehensiveData.searchResult.egrid, municipality, parcelNumber);
              
              if (o3Result.error) {
                throw new Error(o3Result.error);
              }
              
              analysisResult = {
                analysis: o3Result.analysis,
                confidence: o3Result.confidence,
                sources: o3Result.sources,
                model: o3Result.model,
                reasoningEffort: o3Result.reasoningEffort
              };
              analysisMode = 'o3-reasoning';
            } catch (error) {
              console.error('Erreur analyse O3, fallback sur conversationnel:', error);
              // Si l'analyse O3 échoue, continuer avec l'analyse conversationnelle
              const conversationalResult = await performConversationalAnalysis(comprehensiveData);
              
              analysisResult = {
                analysis: conversationalResult.analysis,
                additionalInsights: conversationalResult.additionalInsights,
                confidence: conversationalResult.confidence,
                sources: conversationalResult.sources,
                webSearchResults: conversationalResult.webSearchResults
              };
              analysisMode = 'conversational';
            }
          } else {
            // Pas d'EGRID, utiliser l'analyse conversationnelle
            console.log('🤖 Mode conversationnel (pas d\'EGRID)...');
            const conversationalResult = await performConversationalAnalysis(comprehensiveData);
            
            analysisResult = {
              analysis: conversationalResult.analysis,
              additionalInsights: conversationalResult.additionalInsights,
              confidence: conversationalResult.confidence,
              sources: conversationalResult.sources,
              webSearchResults: conversationalResult.webSearchResults
            };
            analysisMode = 'conversational';
          }
        } else {
          // Ancienne analyse structurée (pour compatibilité)
          console.log('📊 Mode structuré - Analyse avec contraintes formatées...');
          const advancedAnalysis = await performAdvancedAnalysis(comprehensiveData);
          analysisResult = advancedAnalysis;
          analysisMode = 'structured';
        }
        
        // Pour le mode structuré uniquement, normaliser les contraintes
        if (analysisMode === 'structured' && analysisResult.constraints && analysisResult.constraints.length > 0) {
          // Import dynamique pour éviter les problèmes de compilation
          const { truncateSentence } = await import('../i18n/summarizer');
          
          // Normaliser chaque contrainte
          for (const constraint of analysisResult.constraints) {
            // Tronquer le titre et la description à 12 mots
            constraint.title = await truncateSentence(constraint.title || '', 12);
            constraint.description = await truncateSentence(constraint.description || '', 12);
            
            // Normaliser la sévérité
            if (typeof constraint.severity === 'string') {
              const sev = constraint.severity.toLowerCase();
              if (sev === 'high' || sev === 'élevé' || sev === 'critique') {
                constraint.severity = 'high';
              } else if (sev === 'low' || sev === 'faible' || sev === 'info') {
                constraint.severity = 'low';
              } else {
                constraint.severity = 'medium';
              }
            }
            
            // Ajouter une catégorie si elle manque
            if (!constraint.category) {
              const combined = `${constraint.title} ${constraint.description}`.toLowerCase();
              if (combined.includes('hauteur') || combined.includes('gabarit')) {
                constraint.category = 'Gabarits & reculs';
              } else if (combined.includes('stationnement') || combined.includes('parking')) {
                constraint.category = 'Stationnement';
              } else if (combined.includes('vert') || combined.includes('jardin')) {
                constraint.category = 'Espaces de jeux / détente';
              } else if (combined.includes('densité') || combined.includes('ibus')) {
                constraint.category = 'Densité constructible';
              } else if (combined.includes('toiture') || combined.includes('architecture')) {
                constraint.category = 'Prescriptions architecturales';
              } else {
                constraint.category = 'Autres contraintes';
              }
            }
          }
          
          // Trier par sévérité (critique d'abord)
          analysisResult.constraints.sort((a: any, b: any) => {
            const severityOrder: any = { high: 3, medium: 2, low: 1 };
            return severityOrder[b.severity] - severityOrder[a.severity];
          });
        }
        
        // Note: La normalisation est maintenant faite par normalizeConstraints()
        
        // Si on a des données de faisabilité, les normaliser aussi (mode structuré uniquement)
        if (analysisMode === 'structured' && comprehensiveData.parcelDetails) {
          const feasibilityData = await calculateFeasibility(comprehensiveData);
          if (feasibilityData && feasibilityData.zone_label) {
            analysisResult.zoneInfo = analysisResult.zoneInfo || {};
            analysisResult.zoneInfo.zone_label = feasibilityData.zone_label;
            analysisResult.zoneInfo.zone_label_long = feasibilityData.zone_label_long;
          }
        }
        
        const elapsedMs = performance.now() - t0;
        console.log(`✅ Analyse automatisée complète terminée en ${Math.round(elapsedMs)}ms`);

        // Préparer la réponse selon le mode
        if (analysisMode === 'o3-reasoning') {
          // Mode O3 avec raisonnement
          return res.json({
            data: {
              analysis: analysisResult.analysis,
              parcel: {
                address: comprehensiveData.searchResult?.number || comprehensiveData.searchQuery,
                zone: comprehensiveData.rdppfData?.zoneAffectation?.designation || 
                      comprehensiveData.buildingZone?.typ_kt || 
                      'Zone à déterminer',
                surface: comprehensiveData.parcelDetails?.surface,
                egrid: comprehensiveData.searchResult?.egrid
              }
            },
            metadata: {
              confidence: analysisResult.confidence,
              completeness: comprehensiveData.completeness,
              processingTime: comprehensiveData.processingTime,
              elapsedMs: Math.round(elapsedMs),
              sources: analysisResult.sources,
              model: analysisResult.model,
              reasoningEffort: analysisResult.reasoningEffort
            },
            searchQuery,
            analysisType: 'o3-reasoning',
            source: `Analyse avec modèle de raisonnement ${analysisResult.model}`
          });
        } else if (analysisMode === 'conversational') {
          // Mode conversationnel - Réponse naturelle
          return res.json({
            data: {
              analysis: analysisResult.analysis,
              additionalInsights: analysisResult.additionalInsights,
              parcel: {
                address: comprehensiveData.searchResult?.number || comprehensiveData.searchQuery,
                zone: comprehensiveData.rdppfData?.zoneAffectation?.designation || 
                      comprehensiveData.buildingZone?.typ_kt || 
                      'Zone à déterminer',
                surface: comprehensiveData.parcelDetails?.surface
              }
            },
            metadata: {
              confidence: analysisResult.confidence,
              completeness: comprehensiveData.completeness,
              processingTime: comprehensiveData.processingTime,
              elapsedMs: Math.round(elapsedMs),
              sources: analysisResult.sources,
              webSearchResults: analysisResult.webSearchResults
            },
            searchQuery,
            analysisType: 'conversational',
            source: 'Analyse conversationnelle enrichie avec recherche web'
          });
        } else {
          // Mode structuré - Compatibilité avec l'ancien système
          let mainZone = 'Zone à déterminer';
          let zoneSurface = '';
          
          console.log('🔍 Extraction de la zone...');
          console.log('  - rdppfData:', comprehensiveData.rdppfData);
          console.log('  - rdppfConstraints:', comprehensiveData.rdppfConstraints?.length || 0, 'contraintes');
          console.log('  - analysisResult.zoneInfo:', analysisResult.zoneInfo);
          
          // Vérifier dans rdppfData
          if (comprehensiveData.rdppfData?.zoneAffectation?.designation) {
            mainZone = comprehensiveData.rdppfData.zoneAffectation.designation;
            if (comprehensiveData.rdppfData.zoneAffectation.surface) {
              zoneSurface = `${comprehensiveData.rdppfData.zoneAffectation.surface} m²`;
            }
            console.log('✅ Zone trouvée dans rdppfData:', mainZone, zoneSurface);
          }
          // Sinon chercher dans les contraintes RDPPF
          else if (comprehensiveData.rdppfConstraints?.length > 0) {
            const zoneConstraint = comprehensiveData.rdppfConstraints.find(c => 
              c.theme === 'Destination de zone' || c.rule?.includes('Zone résidentielle')
            );
            if (zoneConstraint) {
              mainZone = zoneConstraint.rule;
              // Extraire la surface si présente dans la règle
              const surfaceMatch = zoneConstraint.rule.match(/(\d+)\s*m²/);
              if (surfaceMatch) {
                zoneSurface = surfaceMatch[0];
              }
              console.log('✅ Zone trouvée dans contraintes RDPPF:', mainZone, zoneSurface);
            }
          }
          // Sinon utiliser l'analyse avancée
          else if (analysisResult.zoneInfo?.mainZone) {
            mainZone = analysisResult.zoneInfo.mainZone;
            console.log('✅ Zone trouvée dans analyse avancée:', mainZone);
          }
          
          console.log('📍 Zone finale:', mainZone, zoneSurface);
          
          return res.json({ 
            data: {
              constraints: analysisResult.constraints,
              analysis: analysisResult,
              parcel: {
                address: comprehensiveData.searchResult?.number || comprehensiveData.searchQuery,
                zone: mainZone,
                zone_surface: zoneSurface
              },
              summary: analysisResult.summary
            },
            metadata: {
              confidence: analysisResult.confidence,
              completeness: comprehensiveData.completeness,
              processingTime: comprehensiveData.processingTime,
              elapsedMs: Math.round(elapsedMs)
            },
            searchQuery,
            analysisType: 'structured',
            source: 'Analyse structurée avec contraintes catégorisées'
          });
        }
        
      } catch (error: any) {
        console.error('❌ Erreur analyse automatisée:', error.message);
        return res.status(500).json({ 
          error: 'Erreur lors de l\'analyse automatisée',
          details: error.message,
          searchQuery
        });
      }
    }
    
    // ANCIEN WORKFLOW: Analyse basique pour compatibilité
    if (!coordinates && !address) {
      return res.status(400).json({ 
        error: 'Paramètres manquants', 
        message: 'Fournissez soit "searchQuery" pour l\'analyse automatisée, soit "coordinates" ou "address" pour l\'analyse basique'
      });
    }

    try {
      console.log(`🤖 Lancement analyse basique pour ${commune || 'la commune'}...`);
      
      const t0 = performance.now();
      
      const communeData = {
        commune: commune || 'Commune à identifier',
        coordinates: coordinates,
        address: address
      };
      
      const parcelData = {
        address: address || coordinates,
        parcelId: parcelId || 'Non spécifié',
        coordinates: coordinates
      };
      
      const userQuery = `Analyse cette parcelle cadastrale au Valais, Suisse. Utilise tes vraies connaissances sur l'urbanisme valaisan.
      
      Commune: ${commune || 'À identifier'}
      Adresse: ${address || 'À déterminer'}
      Coordonnées: ${coordinates || 'Non fourni'}
      Parcelle: ${parcelId || 'À identifier'}`;
      
      const openaiAnalysis = await callOpenAISimple(userQuery, communeData, parcelData);
      const elapsedMs = performance.now() - t0;

      console.log(`✅ Analyse basique terminée en ${Math.round(elapsedMs)}ms`);

      res.json({ 
        constraints: openaiAnalysis, 
        elapsedMs: Math.round(elapsedMs),
        commune: commune || 'À identifier',
        analysisType: 'basic',
        source: 'OpenAI GPT-4.1 avec connaissances de base'
      });
      
    } catch (openaiError: any) {
      console.error('❌ Erreur OpenAI:', openaiError.message);
      
      res.status(500).json({ 
        error: 'Service d\'analyse temporairement indisponible',
        message: 'OpenAI est requis pour l\'analyse. Vérifiez votre clé API.',
        technical_error: openaiError.message
      });
    }
    
  } catch (err) {
    console.error('❌ Erreur dans l\'API IA:', err);
    next(err);
  }
});

export default router; 