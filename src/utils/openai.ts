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
  reasoning_effort?: 'low' | 'medium' | 'high';
}) {
  let {
    model = 'gpt-4o',
    temperature = 0,
    messages,
    max_tokens = 1000,
    reasoning_effort = 'medium'
  } = params;

  // Log du modèle utilisé
  console.log(`🤖 Utilisation du modèle: ${model}`);

  try {
    // Les modèles o1 et o3 ont des restrictions spéciales
    const isO3Model = model === 'o3' || model === 'o3-mini';
    const isO1Model = model === 'o1' || model === 'o1-mini';
    const isReasoningModel = isO3Model || isO1Model;
    
    if (isReasoningModel) {
      // Modèles de raisonnement: pas de system message, pas de temperature
      console.log(`🧠 Modèle de raisonnement ${model} avec effort: ${reasoning_effort}`);
      
      // Convertir le system message en user message
      const reasoningMessages = messages.map(msg => {
        if (msg.role === 'system') {
          return { 
            role: 'user' as const, 
            content: `Instructions: ${msg.content}\n\n` 
          };
        }
        return msg;
      });
      
      // Fusionner les messages user consécutifs
      const mergedMessages: typeof messages = [];
      for (const msg of reasoningMessages) {
        if (msg.role === 'user' && mergedMessages.length > 0 && mergedMessages[mergedMessages.length - 1].role === 'user') {
          mergedMessages[mergedMessages.length - 1].content += '\n\n' + msg.content;
        } else {
          mergedMessages.push(msg);
        }
      }
      
      // Pour o3/o3-mini, utiliser reasoning_effort
      if (isO3Model) {
        return await exponentialRetry(async () => {
          const requestParams: any = {
            model,
            messages: mergedMessages,
            reasoning_effort
          };
          
          console.log(`📊 Appel o3 avec reasoning_effort=${reasoning_effort}`);
          return await openai.chat.completions.create(requestParams);
        });
      } else {
        // Pour o1/o1-mini, on peut utiliser max_completion_tokens
        return await exponentialRetry(async () => {
          return await openai.chat.completions.create({
            model,
            messages: mergedMessages,
            max_completion_tokens: Math.min(max_tokens, 32768)
          });
        });
      }
    } else {
      // Modèles standards (gpt-4o, etc.)
      return await exponentialRetry(async () => {
        return await openai.chat.completions.create({
          model,
          temperature,
          messages,
          max_tokens
        });
      });
    }
  } catch (error: any) {
    // Fallback vers gpt-4o si le modèle n'est pas disponible
    if (error.status === 404 || error.status === 400) {
      console.log(`⚠️ Modèle ${model} non disponible ou erreur, fallback vers gpt-4o`);
      return await exponentialRetry(async () => {
        return await openai.chat.completions.create({
          model: 'gpt-4o',
          temperature,
          messages,
          max_tokens
        });
      });
    }
    throw error;
  }
} 