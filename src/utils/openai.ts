import OpenAI from 'openai';
import { exponentialRetry } from './retry';

// Initialisation conditionnelle d'OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-dummy-key-for-development',
});

export async function chatCompletion(
  zone: string,
  reglement: string,
  parcelLabel: string,
): Promise<string> {
  // Fonction helper pour choisir le modèle avec fallback
  const getModel = async (): Promise<string> => {
    try {
      // Test rapide avec gpt-4o-mini
      await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      return 'gpt-4o-mini';
    } catch (error: any) {
      if (error.status === 404 || error.message?.includes('gpt-4o-mini')) {
        return 'gpt-3.5-turbo';
      }
      throw error;
    }
  };

  const selectedModel = await getModel();
  console.log(`🤖 Modèle sélectionné pour analyse simple: ${selectedModel}`);
  
  const response = await exponentialRetry(async () => {
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content:
            'Tu es un juriste spécialisé en droit de la construction valaisan. Réponds de façon concise et exhaustive, en français.',
        },
        {
          role: 'user',
          content: `ZONE: ${zone}\n\nRÈGLEMENT:\n${reglement}\n\nQUESTION: Quelles contraintes s'appliquent à la parcelle ${parcelLabel} ?`,
        },
      ],
    });
    return completion.choices[0].message.content ?? '';
  });
  return response;
}

/**
 * Analyse approfondie avec recherche multi-étapes (simulation de la recherche approfondie ChatGPT)
 * Utilise plusieurs appels pour une analyse complète et détaillée
 * Essaie d'abord o3, puis bascule sur o3-mini si non disponible
 */
export async function deepSearchAnalysis(
  zone: string,
  reglement: string,
  parcelLabel: string,
  additionalContext?: string
): Promise<string> {
  console.log('🔍 Démarrage de l\'analyse approfondie pour', parcelLabel);
  
  // Fonction helper pour choisir le modèle avec fallback
  const getModel = async (): Promise<string> => {
    try {
      // Test rapide avec gpt-4o-mini
      await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      console.log('✅ Modèle gpt-4o-mini disponible');
      return 'gpt-4o-mini';
          } catch (error: any) {
        if (error.status === 404 || error.message?.includes('gpt-4o-mini')) {
          console.log('⚠️ Modèle gpt-4o-mini non disponible, utilisation de gpt-3.5-turbo');
          return 'gpt-3.5-turbo';
        }
        throw error;
      }
  };
  
  try {
    const selectedModel = await getModel();
    console.log(`🤖 Modèle sélectionné: ${selectedModel}`);
    
    // Étape 1: Analyse préliminaire du zonage
    const zoningAnalysis = await exponentialRetry(async () => {
      const completion = await openai.chat.completions.create({
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en urbanisme valaisan. Analyse en détail les implications du zonage.',
          },
          {
            role: 'user',
            content: `Analyse approfondie du zonage "${zone}" en Valais. Explique toutes les contraintes, possibilités et restrictions de ce type de zone.`,
          },
        ],
      });
      return completion.choices[0].message.content ?? '';
    });

    // Étape 2: Analyse détaillée du règlement
    const regulationAnalysis = await exponentialRetry(async () => {
      const completion = await openai.chat.completions.create({
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: 'Tu es un juriste spécialisé en droit de la construction. Analyse chaque article du règlement.',
          },
          {
            role: 'user',
            content: `Analyse article par article ce règlement communal:\n\n${reglement}\n\nIdentifie tous les points critiques, exceptions, et contraintes spécifiques.`,
          },
        ],
      });
      return completion.choices[0].message.content ?? '';
    });

    // Étape 3: Synthèse croisée et recommandations
    const contextSection = additionalContext ? `CONTEXTE ADDITIONNEL: ${additionalContext}\n\n` : '';
    const prompt = `PARCELLE: ${parcelLabel}
ZONE: ${zone}
${contextSection}ANALYSE DU ZONAGE:
${zoningAnalysis}

ANALYSE DU RÈGLEMENT:
${regulationAnalysis}

Mission: Synthétise ces analyses pour fournir:
1. Un résumé exécutif des contraintes principales
2. Les opportunités de développement
3. Les risques juridiques identifiés
4. Des recommandations concrètes pour le propriétaire
5. Les démarches administratives nécessaires

Sois précis, actionnable et structure ta réponse clairement.`;

    const finalSynthesis = await exponentialRetry(async () => {
      const completion = await openai.chat.completions.create({
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: 'Tu es un consultant expert en développement immobilier valaisan. Fournis une synthèse actionnable et des recommandations précises.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });
      return completion.choices[0].message.content ?? '';
    });

    console.log('✅ Analyse approfondie terminée pour', parcelLabel, 'avec modèle', selectedModel);
    return finalSynthesis;

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse approfondie:', error);
    // Fallback vers l'analyse simple
    return await chatCompletion(zone, reglement, parcelLabel);
  }
}

// Helper générique pour tout appel simple depuis d'autres modules
export async function callOpenAI(params: {
  model?: string;
  temperature?: number;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  max_tokens?: number;
}) {
  const {
    model = 'gpt-4o-mini',
    temperature = 0,
    messages,
    max_tokens = 1000
  } = params;

  return await exponentialRetry(async () => {
    return await openai.chat.completions.create({
      model,
      temperature,
      messages,
      max_tokens
    });
  });
} 