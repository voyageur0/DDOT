const OpenAI = require('openai');
require('dotenv').config();

// Configuration OpenAI
const openai = new OpenAI({
  apiKey: "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"
});

const EMBEDDING_MODEL = "text-embedding-ada-002";
// Modèle de chat avancé - GPT-4.1
const CHAT_MODEL = "gpt-4.1";

/**
 * Générer un embedding pour un texte
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Erreur génération embedding:', error);
    return null;
  }
}

/**
 * Générer des embeddings pour plusieurs textes
 */
async function generateEmbeddings(texts) {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts
    });
    
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Erreur génération embeddings batch:', error);
    return [];
  }
}

/**
 * Générer un résumé du texte avec GPT-4.1 (sans chunking)
 */
async function generateSummary(text, maxTokens = 1000) {
  try {
    // Avec GPT-4.1, nous pouvons traiter le document entier d'un coup !
    console.log(`📊 Génération résumé avec GPT-4.1 pour ${text.length} caractères (sans chunking)`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4.1", // Utiliser GPT-4.1 directement
      messages: [
        {
          role: "system",
          content: "Tu es un assistant spécialisé en urbanisme qui produit des résumés clairs et exhaustifs des règlements d'urbanisme. Analyse le document complet et fournis une synthèse structurée couvrant : zones, coefficients (IBUS, COS, CES), hauteurs maximales, distances aux limites, stationnement, et toutes autres contraintes importantes."
        },
        {
          role: "user",
          content: `Résume de façon complète et structurée ce règlement d'urbanisme:\n\n${text}`
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.3
    });
    
    return {
      summary: response.choices[0].message.content,
      chunksProcessed: 1, // Plus de chunks !
      tokensUsed: estimateTokens(text)
    };
  } catch (error) {
    console.error('Erreur génération résumé:', error);
    return {
      summary: null,
      error: error.message
    };
  }
}

/**
 * Générer un résumé pour un chunk
 */
async function generateChunkSummary(text) {
  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: "Tu es un assistant spécialisé en urbanisme qui produit des résumés clairs et concis des règlements d'urbanisme. Concentre-toi sur les éléments clés : zones, coefficients (IBUS, COS, CES), hauteurs maximales, distances aux limites, et autres contraintes importantes."
        },
        {
          role: "user",
          content: `Résume les points clés de ce règlement d'urbanisme:\n\n${text}`
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Erreur chunk summary:', error);
    return null;
  }
}

/**
 * Générer un résumé final à partir des résumés de chunks
 */
async function generateFinalSummary(combinedSummaries) {
  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: "Tu es un assistant spécialisé en urbanisme. Combine les résumés partiels suivants en une synthèse cohérente et structurée du règlement d'urbanisme."
        },
        {
          role: "user",
          content: `Combine ces résumés en une synthèse unique et cohérente:\n\n${combinedSummaries}`
        }
      ],
      max_tokens: 800,
      temperature: 0.3
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Erreur final summary:', error);
    return combinedSummaries;
  }
}

/**
 * Générer un tableau de faisabilité
 */
async function generateFeasibilityTable(rulesData, projectData = null) {
  try {
    const rulesText = formatRulesData(rulesData);
    let prompt;
    
    if (projectData) {
      const projectText = formatProjectData(projectData);
      prompt = `En te basant sur les règles d'urbanisme suivantes:

${rulesText}

Et sur les caractéristiques du projet:

${projectText}

Génère un tableau de faisabilité en Markdown avec les colonnes suivantes:
| Critère | Exigence du règlement | Projet envisagé | Conforme ? |

Ne fournis QUE le tableau Markdown, sans texte additionnel.`;
    } else {
      prompt = `En te basant sur les règles d'urbanisme suivantes:

${rulesText}

Génère un tableau récapitulatif des contraintes en Markdown avec les colonnes suivantes:
| Critère | Valeur réglementaire | Remarques |

Ne fournis QUE le tableau Markdown, sans texte additionnel.`;
    }
    
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: "Tu es un assistant expert en urbanisme. Génère uniquement des tableaux Markdown structurés sans commentaire additionnel."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.2
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Erreur génération tableau:', error);
    return "Erreur lors de la génération du tableau";
  }
}

/**
 * Répondre à une question basée sur le contexte
 */
async function answerQuestion(question, context, maxTokens = 500) {
  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: "Tu es un assistant expert en urbanisme. Réponds aux questions en te basant uniquement sur le contexte fourni. Si l'information n'est pas dans le contexte, indique-le clairement."
        },
        {
          role: "user",
          content: `Contexte:\n${context}\n\nQuestion: ${question}`
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.3
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Erreur answer question:', error);
    return `Erreur lors de la génération de la réponse: ${error.message}`;
  }
}

/**
 * Utilitaires
 */

function splitTextIntoTokenChunks(text, maxTokens = 2000) {
  // Approximation : 1 token ≈ 4 caractères
  const chunkSize = maxTokens * 4;
  const chunks = [];
  
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  
  return chunks;
}

function estimateTokens(text) {
  // Approximation simple
  return Math.ceil(text.length / 4);
}

function formatRulesData(rulesData) {
  const formatted = [];
  
  if (rulesData.zones) {
    formatted.push(`Zones identifiées: ${rulesData.zones.join(', ')}`);
  }
  
  if (rulesData.coefficients) {
    formatted.push('\nCoefficients généraux:');
    for (const [key, value] of Object.entries(rulesData.coefficients)) {
      formatted.push(`- ${key.toUpperCase()}: ${value}`);
    }
  }
  
  if (rulesData.rules) {
    for (const [zone, zoneRules] of Object.entries(rulesData.rules)) {
      formatted.push(`\nRègles pour Zone ${zone}:`);
      for (const [key, value] of Object.entries(zoneRules)) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        formatted.push(`- ${label}: ${value}`);
      }
    }
  }
  
  return formatted.join('\n');
}

function formatProjectData(projectData) {
  const formatted = [];
  
  const mapping = {
    zone: 'Zone du projet',
    hauteur: 'Hauteur prévue',
    ibus: 'IBUS prévu',
    emprise: 'Emprise au sol',
    distance_limite: 'Distance aux limites'
  };
  
  for (const [key, label] of Object.entries(mapping)) {
    if (projectData[key] !== undefined) {
      formatted.push(`- ${label}: ${projectData[key]}`);
    }
  }
  
  return formatted.join('\n');
}

/**
 * Calculer la similarité cosinus entre deux vecteurs
 */
function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);
  
  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }
  
  return dotProduct / (norm1 * norm2);
}

module.exports = {
  generateEmbedding,
  generateEmbeddings,
  generateSummary,
  generateFeasibilityTable,
  answerQuestion,
  cosineSimilarity
}; 