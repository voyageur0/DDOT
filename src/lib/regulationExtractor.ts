// Nouveau fichier pour extraction structurée des règlements communaux via OpenAI
import { callOpenAI } from '../utils/openai';

export interface RegulationConstraint {
  zone: string;
  theme: string;
  rule: string;
  article?: string;
}

const THEMES = [
  'Zone',
  'But de la zone',
  'Surface de la parcelle',
  'Indice U',
  'Indice IBUS',
  'Hauteur maximale',
  'Distances à la limite',
  'Alignements',
  'Places de jeux',
  'Places de parc'
] as const;

const SYSTEM_PROMPT = `Vous êtes un expert en droit de l'urbanisme suisse analysant des règlements communaux.

OBJECTIF: Extraire TOUTES les informations pertinentes pour ces 10 THÈMES PRINCIPAUX. Soyez FLEXIBLE et cherchez TOUT ce qui concerne chaque thème.

LES 10 THÈMES À RECHERCHER:

1. **Zone** - Type de zone d'affectation
2. **But de la zone** - Objectif et caractéristiques de la zone
3. **Surface de la parcelle** - Surfaces minimales, maximales, constructibles
4. **Indice U** - Indice d'utilisation (parties chauffées)
5. **Indice IBUS** - Indice brut d'utilisation (toutes surfaces)
6. **Hauteur maximale** - Hauteurs selon type de toiture, corniche, faîte
7. **Distances à la limite** - Reculs, distances minimales, calculs H/2
8. **Alignements** - Obligations d'alignement sur rue ou voisins
9. **Places de jeux** - Espaces extérieurs, jeux pour enfants
10. **Places de parc** - Nombre requis, dimensions, vélos

FORMAT JSON STRICT:
[
  {"zone": "Zone R3", "theme": "Indice IBUS", "rule": "L'IBUS est fixé à 0.6 pour la zone R3", "article": "Art. 45"},
  {"zone": "*", "theme": "Hauteur maximale", "rule": "Hauteur maximale 12m pour toiture plate, 15m pour toiture en pente", "article": "Art. 52"}
]

INSTRUCTIONS:
- Extraire TOUT ce qui concerne ces 10 thèmes, même si formulé différemment
- Si la zone n'est pas spécifiée, utilisez "*" 
- Incluez TOUJOURS l'article/section si mentionné
- Soyez EXHAUSTIF - mieux vaut trop d'informations que pas assez
- Le champ "theme" DOIT être l'un des 10 thèmes listés
- Retournez UNIQUEMENT le JSON`;

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