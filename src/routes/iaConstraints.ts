import { Router, Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import axios from 'axios';
import { performComprehensiveAnalysis, performQuickAnalysis } from '../lib/parcelAnalysisOrchestrator';
import { callOpenAI } from '../utils/openai';
import { performStructuredAnalysis, type AnalysisResult } from '../lib/aiAnalysisEngine';
import { performAdvancedAnalysis, type AdvancedAnalysisResult } from '../lib/advancedAIAnalysisEngine';

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
    
    const { coordinates, address, commune, parcelId, searchQuery, analysisType = 'complete' } = req.body;

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
        
        console.log(`📊 Données collectées (${comprehensiveData.completeness}% complétude) - Analyse IA avancée o3/o3-mini...`);
        
        // Nouvelle analyse IA avancée avec double niveau et filtrage par zone
        const advancedAnalysis = await performAdvancedAnalysis(comprehensiveData);
        
        const elapsedMs = performance.now() - t0;
        console.log(`✅ Analyse automatisée complète terminée en ${Math.round(elapsedMs)}ms`);

        // Extraire la zone depuis les données RDPPF
        let mainZone = 'Zone à déterminer';
        let zoneSurface = '';
        
        // Vérifier dans rdppfData
        if (comprehensiveData.rdppfData?.zoneAffectation?.designation) {
          mainZone = comprehensiveData.rdppfData.zoneAffectation.designation;
          if (comprehensiveData.rdppfData.zoneAffectation.surface) {
            zoneSurface = `${comprehensiveData.rdppfData.zoneAffectation.surface} m²`;
          }
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
          }
        }
        // Sinon utiliser l'analyse avancée
        else if (advancedAnalysis.zone) {
          mainZone = advancedAnalysis.zone;
        }
        
        return res.json({ 
          data: {
            constraints: advancedAnalysis.constraints,
            analysis: advancedAnalysis,
            parcel: {
              address: comprehensiveData.searchResult?.number || comprehensiveData.searchQuery,
              zone: mainZone,
              zone_surface: zoneSurface
            },
            summary: advancedAnalysis.summary
          },
          metadata: {
            confidence: advancedAnalysis.confidence,
            completeness: comprehensiveData.completeness,
            processingTime: comprehensiveData.processingTime,
            elapsedMs: Math.round(elapsedMs)
          },
          searchQuery,
          analysisType: 'advanced',
          source: 'Analyse avancée double niveau o3/o3-mini avec filtrage par zone RDPPF'
        });
        
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