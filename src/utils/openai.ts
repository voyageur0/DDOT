import OpenAI from 'openai';
import { exponentialRetry } from './retry';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function chatCompletion(
  zone: string,
  reglement: string,
  parcelLabel: string,
): Promise<string> {
  // Fonction helper pour choisir le modèle avec fallback
  const getModel = async (): Promise<string> => {
    try {
      // Test rapide avec o3
      await openai.chat.completions.create({
        model: 'o3',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      return 'o3';
    } catch (error: any) {
      if (error.status === 404 || error.message?.includes('o3')) {
        return 'o3-mini';
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
      // Test rapide avec o3
      await openai.chat.completions.create({
        model: 'o3',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      console.log('✅ Modèle o3 disponible');
      return 'o3';
    } catch (error: any) {
      if (error.status === 404 || error.message?.includes('o3')) {
        console.log('⚠️ Modèle o3 non disponible, utilisation de o3-mini');
        return 'o3-mini';
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