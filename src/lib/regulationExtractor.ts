// Nouveau fichier pour extraction structurée des règlements communaux via OpenAI
import { callOpenAI } from '../utils/openai';

export interface RegulationConstraint {
  zone: string;
  theme: string;
  rule: string;
  article?: string;
}

const THEMES = [
  'Identification',
  'Destination de zone',
  'Indice d\'utilisation (IBUS)',
  'Gabarits & reculs',
  'Toiture',
  'Stationnement',
  'Espaces de jeux / détente',
  'Prescriptions architecturales'
] as const;

const SYSTEM_PROMPT = `Vous êtes un expert en droit de l'urbanisme suisse.

TÂCHE: Extraire TOUTES les règles pertinentes du texte de règlement communal fourni et les structurer en JSON.

THÈMES OBLIGATOIRES: ${THEMES.join(', ')}

FORMAT DE SORTIE: Retournez UNIQUEMENT un tableau JSON valide, sans texte supplémentaire. 

STRUCTURE EXACTE:
[
  {"zone": "Zone résidentielle 1.0", "theme": "Indice d'utilisation (IBUS)", "rule": "L'indice d'utilisation est fixé à 1.0", "article": "Art. 15"},
  {"zone": "*", "theme": "Gabarits & reculs", "rule": "Distance minimale aux limites: 5 mètres", "article": "Art. 22"}
]

RÈGLES:
- Chaque règle doit être assignée à UN des 8 thèmes obligatoires
- Si la zone n'est pas spécifiée, utilisez "*"
- Incluez l'article/section si mentionné
- Soyez précis et détaillé dans les règles
- Retournez UNIQUEMENT le JSON, rien d'autre`;

/**
 * Analyse un texte de règlement communal et renvoie un tableau de contraintes structurées.
 * Avec gpt-4o-mini, nous pouvons analyser de gros documents efficacement.
 */
export async function extractRegulationConstraints(rawText: string): Promise<RegulationConstraint[]> {
  if (!rawText || rawText.length < 50) return [];

  console.log(`🔍 Extraction contraintes sur ${rawText.length} caractères (analyse avec gpt-4o-mini)...`);
  
  const messages: any = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Analysez ce règlement communal et extrayez toutes les contraintes:\n\n${rawText}` }
  ];

  try {
    console.log(`📤 Envoi du document à OpenAI gpt-4o-mini...`);
    const response = await callOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages,
      max_tokens: 4000
    });

    const content = response.choices[0].message?.content ?? '[]';
    console.log(`📥 Réponse OpenAI reçue (${content.length} caractères)`);
    
    // Vérifier que la réponse n'est pas vide
    if (!content.trim()) {
      console.log('⚠️ Réponse OpenAI vide');
      return [];
    }

    try {
      // Nettoyer la réponse pour extraire le JSON du bloc markdown
      let jsonString = content.trim();
      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.substring(7);
        if (jsonString.endsWith('```')) {
          jsonString = jsonString.slice(0, -3);
        }
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.substring(3);
        if (jsonString.endsWith('```')) {
          jsonString = jsonString.slice(0, -3);
        }
      }
      
      // Assurer que le JSON est propre
      jsonString = jsonString.trim();

      const parsed = JSON.parse(jsonString);
      
      if (Array.isArray(parsed)) {
        console.log(`✅ ${parsed.length} contraintes extraites directement`);
        return parsed as RegulationConstraint[];
      } else if (parsed.constraints && Array.isArray(parsed.constraints)) {
        console.log(`✅ ${parsed.constraints.length} contraintes extraites depuis la propriété 'constraints'`);
        return parsed.constraints as RegulationConstraint[];
      } else if (parsed.rules && Array.isArray(parsed.rules)) {
        console.log(`✅ ${parsed.rules.length} contraintes extraites depuis la propriété 'rules'`);
        return parsed.rules as RegulationConstraint[];
      } else {
        console.log('⚠️ Structure JSON inattendue:', Object.keys(parsed));
        return [];
      }
    } catch (parseError) {
      console.error('❌ Erreur parsing JSON:', parseError);
      console.log('📄 Contenu brut:', content.substring(0, 500) + '...');
      return [];
    }
  } catch (err: any) {
    console.error('Erreur extraction contraintes règlement:', err);
    
    // Retry sans JSON mode si ça échoue
    if (err.message?.includes('json_object') || err.message?.includes('response_format')) {
      console.log('🔄 Retry sans mode JSON...');
      try {
        const response = await callOpenAI({
          model: 'gpt-4o-mini',
          temperature: 0,
          messages,
          max_tokens: 4000
        });

        const content = response.choices[0].message?.content ?? '[]';
        
        // Essayer de trouver du JSON dans la réponse
        const jsonStart = content.indexOf('[');
        const jsonEnd = content.lastIndexOf(']') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          const jsonString = content.slice(jsonStart, jsonEnd);
          return JSON.parse(jsonString) as RegulationConstraint[];
        }
        
        return [];
      } catch (retryErr) {
        console.error('❌ Échec du retry:', retryErr);
        return [];
      }
    }
    
    return [];
  }
}

/**
 * Avec gpt-4o-mini, nous pouvons traiter de gros documents facilement.
 */
export async function extractConstraintsFromLargeText(rawText: string): Promise<RegulationConstraint[]> {
  console.log(`📊 Traitement document complet: ${rawText.length} caractères avec gpt-4o-mini`);
  
  // gpt-4o-mini peut traiter de gros documents sans problème
  return await extractRegulationConstraints(rawText);
} 