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
À partir du texte ci-dessous, extrayez toutes les règles pertinentes et assignez chacune d'elles à l'un des 8 thèmes obligatoires suivants : ${THEMES.join(', ')}.
Retournez le résultat sous forme JSON, chaque élément devant respecter le format : [{"zone":"<zone ou * si non applicable>","theme":"<thème parmi la liste>","rule":"<description détaillée>","article":"<référence si présente>"}, …]`;

/**
 * Analyse un texte de règlement communal et renvoie un tableau de contraintes structurées.
 */
export async function extractRegulationConstraints(rawText: string): Promise<RegulationConstraint[]> {
  if (!rawText || rawText.length < 50) return [];

  console.log(`🔍 Extraction contraintes sur ${rawText.length} caractères...`);
  
  const messages: any = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: rawText.slice(0, 12000) } // Troncature pour rester sous la limite token
  ];

  try {
    console.log(`📤 Envoi à OpenAI...`);
    const response = await callOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages,
      max_tokens: 2000  // Augmenter pour éviter la troncature
    });

    const content = response.choices[0].message?.content ?? '[]';
    console.log(`📥 Réponse OpenAI reçue (${content.length} caractères)`);
    // console.log(`📝 Début réponse:`, content.substring(0, 200) + '...');  // Commenté pour réduire le bruit
    
    // Essayer de parser le JSON
    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      console.log('⚠️ Pas de JSON trouvé dans la réponse OpenAI');
      return [];
    }
    
    const jsonString = content.slice(jsonStart, jsonEnd);
    console.log(`📝 JSON extrait (${jsonString.length} chars):`, jsonString.substring(0, 100) + '...');
    
    // Vérifier que le JSON semble complet
    if (!jsonString.trim() || jsonString === '[]') {
      console.log('⚠️ JSON vide ou incomplet');
      return [];
    }

    try {
      return JSON.parse(jsonString) as RegulationConstraint[];
    } catch (parseError) {
      console.error('❌ Erreur parsing JSON:', parseError);
      console.log('📄 JSON brut:', jsonString);
      
      // Essayer de nettoyer et re-parser
      try {
        // Supprimer les éléments incomplets à la fin
        let cleanJson = jsonString.trim();
        if (cleanJson.endsWith(',')) {
          cleanJson = cleanJson.slice(0, -1) + ']';
        }
        if (!cleanJson.endsWith(']')) {
          cleanJson = cleanJson + ']';
        }
        
        console.log('🔧 Tentative de réparation du JSON...');
        return JSON.parse(cleanJson) as RegulationConstraint[];
      } catch (repairError) {
        console.error('❌ Impossible de réparer le JSON:', repairError);
        return [];
      }
    }
  } catch (err) {
    console.error('Erreur extraction contraintes règlement:', err);
    return [];
  }
}

/**
 * Pour un gros texte (> 10k), découpe en segments et agrège les contraintes extraites.
 */
export async function extractConstraintsFromLargeText(rawText: string): Promise<RegulationConstraint[]> {
  const CHUNK_SIZE = 8000; // Réduire pour éviter la surcharge OpenAI
  let all: RegulationConstraint[] = [];
  
  console.log(`📊 Traitement texte: ${rawText.length} caractères en chunks de ${CHUNK_SIZE}`);
  const numChunks = Math.ceil(rawText.length / CHUNK_SIZE);
  console.log(`🔄 ${numChunks} chunks à traiter`);

  for (let i = 0; i < rawText.length; i += CHUNK_SIZE) {
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
    console.log(`🔄 Traitement chunk ${chunkIndex}/${numChunks}...`);
    
    const chunk = rawText.slice(i, i + CHUNK_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const constraints = await extractRegulationConstraints(chunk);
    console.log(`✅ Chunk ${chunkIndex}: ${constraints.length} contraintes extraites`);
    all.push(...constraints);
  }

  console.log(`📊 Total brut: ${all.length} contraintes avant déduplication`);
  
  // Déduplication simple sur combinaison zone+theme+rule
  const uniqueMap = new Map<string, RegulationConstraint>();
  for (const c of all) {
    const key = `${c.zone}-${c.theme}-${c.rule}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, c);
    }
  }

  const final = Array.from(uniqueMap.values());
  console.log(`✅ Total final: ${final.length} contraintes uniques`);
  return final;
} 