import express, { Router } from 'express';
import { performance } from 'perf_hooks';
import axios from 'axios';
import { performComprehensiveAnalysis, performQuickAnalysis } from '../lib/parcelAnalysisOrchestrator';

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
    const response = await axios.post('https://api.openai.com/v1/models', {}, {
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

// Nouvelle fonction d'appel OpenAI avec données complètes automatisées
async function callOpenAIWithComprehensiveData(comprehensiveData: any): Promise<string> {
  console.log('🚀 🤖 Appel OpenAI avec données automatisées complètes');
  
  try {
    console.log('🎯 Envoi requête OpenAI...');
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Vous êtes un expert en urbanisme et aménagement du territoire suisse, spécialisé dans les réglementations valaisannes. 

Votre rôle est d'analyser des données cadastrales complètes et fournir des conseils pratiques et précis pour les projets de construction et d'aménagement.

Vous recevrez des données structurées récoltées automatiquement depuis les APIs officielles suisses incluant :
- Informations cadastrales détaillées (EGRID, surface, coordonnées)
- Restrictions de droit public (PLR) officielles
- Règlements communaux extraits des documents PDF
- Cartes des dangers naturels du Valais
- Contraintes géographiques et géologiques
- Zones de construction et affectations

Analysez ces données factuelles et fournissez une expertise professionnelle basée sur votre connaissance du droit suisse de la construction et de l'aménagement du territoire.

IMPORTANT: Ces données proviennent des sources officielles. Basez votre analyse sur ces faits et votre expertise réglementaire.`
        },
        {
          role: 'user',
          content: comprehensiveData.formattedForAI
        }
      ],
      max_tokens: 4000,
      temperature: 0.2
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 45000
    });

    const expertAnalysis = response.data.choices[0].message.content;
    console.log(`✅ Analyse OpenAI reçue: ${expertAnalysis.length} caractères`);
    
    return expertAnalysis;
    
  } catch (error: any) {
    console.error('💥 ERREUR OPENAI:', error.response?.data || error.message);
    throw new Error(`Erreur OpenAI: ${error.response?.data?.error?.message || error.message}`);
  }
}

// Fonction d'appel à OpenAI SIMPLIFIÉE - pour compatibilité avec l'ancien système
async function callOpenAISimple(userQuery: string, communeData: any, parcelData: any): Promise<string> {
  console.log('🤖 Appel OpenAI avec connaissances de base');
  
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
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

router.post('/ia-constraints', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
        
        console.log(`📊 Données collectées (${comprehensiveData.completeness}% complétude) - Envoi à OpenAI...`);
        
        // Envoyer les données formatées à OpenAI
        const openaiAnalysis = await callOpenAIWithComprehensiveData(comprehensiveData);
        
        const elapsedMs = performance.now() - t0;
        console.log(`✅ Analyse automatisée complète terminée en ${Math.round(elapsedMs)}ms`);

        return res.json({ 
          constraints: openaiAnalysis,
          comprehensiveData,
          searchQuery,
          analysisType,
          completeness: comprehensiveData.completeness,
          processingTime: comprehensiveData.processingTime,
          elapsedMs: Math.round(elapsedMs),
          source: 'Analyse automatisée complète avec APIs officielles + OpenAI GPT-4o'
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
        source: 'OpenAI GPT-4o-mini avec connaissances de base'
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