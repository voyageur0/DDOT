import { callOpenAI } from '../utils/openai';

export interface RdppfData {
  zoneAffectation: {
    designation: string;
    indice?: number;
    surface: number;
    pourcentage: number;
  };
  degreSensibiliteBruit?: {
    degre: string;
    surface: number;
    pourcentage: number;
  };
  autresRestrictions: Array<{
    type: string;
    description: string;
    reference?: string;
  }>;
}

const RDPPF_EXTRACTION_PROMPT = `Tu es un expert en urbanisme suisse spécialisé dans l'analyse des documents RDPPF.

À partir du texte RDPPF fourni, extrais TRÈS PRÉCISÉMENT les informations suivantes:

1. ZONE D'AFFECTATION PRINCIPALE
   - Nom exact de la zone (ex: "Zone résidentielle 0.5 (3)", "Zone à bâtir d'habitation de très faible densité", etc.)
   - Indice d'utilisation si mentionné (ex: 0.5, 0.3, etc.)
   - Surface en m²
   - Pourcentage de la parcelle

2. DEGRÉ DE SENSIBILITÉ AU BRUIT
   - Degré (I, II, III, IV)
   - Surface en m²
   - Pourcentage

3. AUTRES RESTRICTIONS IMPORTANTES
   - Zones de dangers naturels (si présentes)
   - Périmètres de protection
   - Servitudes particulières
   - Références aux dispositions juridiques

IMPORTANT:
- Extrais EXACTEMENT les dénominations telles qu'elles apparaissent dans le document
- Les surfaces et pourcentages doivent être des nombres
- Ne pas inventer d'informations non présentes dans le document

Réponds UNIQUEMENT avec un JSON valide au format suivant:
{
  "zoneAffectation": {
    "designation": "Zone résidentielle 0.5 (3)",
    "indice": 0.5,
    "surface": 2257,
    "pourcentage": 100.0
  },
  "degreSensibiliteBruit": {
    "degre": "II",
    "surface": 2257,
    "pourcentage": 100.0
  },
  "autresRestrictions": [
    {
      "type": "Disposition juridique",
      "description": "Modification partielle du règlement communal MRCCZ 0",
      "reference": "10.08.2016"
    }
  ]
}`;

/**
 * Extrait les données structurées du RDPPF avec une approche plus précise
 */
export async function extractRdppfData(rawText: string): Promise<RdppfData | null> {
  if (!rawText || rawText.length < 50) {
    console.log('❌ Texte RDPPF trop court ou vide');
    return null;
  }

  console.log(`🔍 Extraction avancée RDPPF: ${rawText.length} caractères`);

  try {
    // Extraire les sections pertinentes du texte
    const relevantText = extractRelevantSections(rawText);
    
    const response = await callOpenAI({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { role: 'system', content: RDPPF_EXTRACTION_PROMPT },
        { role: 'user', content: relevantText }
      ],
      max_tokens: 1500
    });

    const content = response.choices[0].message?.content;
    if (!content) {
      console.error('❌ Pas de réponse OpenAI');
      return null;
    }

    const data = JSON.parse(content) as RdppfData;
    console.log('✅ Données RDPPF extraites:', data);
    return data;

  } catch (error) {
    console.error('❌ Erreur extraction RDPPF avancée:', error);
    return null;
  }
}

/**
 * Extrait les sections pertinentes du texte RDPPF
 */
function extractRelevantSections(fullText: string): string {
  const lines = fullText.split('\n');
  const relevantLines: string[] = [];
  let inRelevantSection = false;
  
  for (const line of lines) {
    // Détecter les sections importantes
    if (line.includes('Plans d\'affectation') || 
        line.includes('Zone résidentielle') ||
        line.includes('Zone à bâtir') ||
        line.includes('Degré de sensibilité') ||
        line.includes('Surface') ||
        line.includes('%') ||
        line.includes('Dispositions juridiques') ||
        line.includes('Légende des objets touchés')) {
      inRelevantSection = true;
    }
    
    // Collecter les lignes pertinentes
    if (inRelevantSection && line.trim().length > 0) {
      relevantLines.push(line);
    }
    
    // Arrêter après les dispositions juridiques
    if (line.includes('Page') && relevantLines.length > 20) {
      break;
    }
  }
  
  return relevantLines.join('\n');
}

/**
 * Recherche des contraintes spécifiques dans le règlement communal basées sur la zone
 */
export async function findZoneConstraints(
  zoneDesignation: string, 
  reglementText: string
): Promise<Array<{title: string, description: string, source: string}>> {
  
  const CONSTRAINT_SEARCH_PROMPT = `Tu es un expert en urbanisme suisse. 
  
À partir du règlement communal fourni, trouve TOUTES les contraintes qui s'appliquent spécifiquement à la zone: "${zoneDesignation}"

Recherche notamment:
1. L'indice d'utilisation du sol (IBUS) pour cette zone
2. La hauteur maximale autorisée
3. Les distances aux limites
4. Le nombre d'étages maximum
5. Les prescriptions architecturales spécifiques
6. Les exigences de stationnement
7. Les espaces verts requis
8. Toute autre contrainte mentionnée pour cette zone

IMPORTANT:
- Cite les articles exacts du règlement
- Donne les valeurs numériques précises (IBUS, hauteurs, distances, etc.)
- Ne pas inventer de contraintes non mentionnées

Réponds avec un JSON au format:
{
  "constraints": [
    {
      "title": "Indice d'utilisation du sol (IBUS)",
      "description": "IBUS maximum de 0.5 selon art. 23 RCC",
      "source": "Art. 23 RCC"
    }
  ]
}`;

  try {
    const response = await callOpenAI({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { role: 'system', content: CONSTRAINT_SEARCH_PROMPT },
        { role: 'user', content: `Zone recherchée: ${zoneDesignation}\n\nRèglement:\n${reglementText.substring(0, 50000)}` }
      ],
      max_tokens: 2000
    });

    const content = response.choices[0].message?.content;
    if (!content) return [];

    const result = JSON.parse(content);
    return result.constraints || [];

  } catch (error) {
    console.error('❌ Erreur recherche contraintes zone:', error);
    return [];
  }
}

/**
 * Génère des contraintes basées sur le degré de sensibilité au bruit
 */
export function generateNoiseConstraints(degre: string): Array<{title: string, description: string, severity: string}> {
  const constraints = [];
  
  switch (degre) {
    case 'I':
      constraints.push({
        title: 'Zone de détente - Degré de sensibilité I',
        description: 'Zone nécessitant une protection accrue contre le bruit. Aucune activité bruyante autorisée. Valeurs limites très strictes.',
        severity: 'high'
      });
      break;
    case 'II':
      constraints.push({
        title: 'Zone d\'habitation - Degré de sensibilité II',
        description: 'Zone où aucune entreprise gênante n\'est autorisée. Protection standard contre le bruit pour l\'habitat.',
        severity: 'medium'
      });
      break;
    case 'III':
      constraints.push({
        title: 'Zone mixte - Degré de sensibilité III',
        description: 'Zone où des entreprises moyennement gênantes sont admises. Niveau de bruit modéré toléré.',
        severity: 'low'
      });
      break;
    case 'IV':
      constraints.push({
        title: 'Zone industrielle - Degré de sensibilité IV',
        description: 'Zone où des entreprises fortement gênantes sont admises. Niveau de bruit élevé toléré.',
        severity: 'low'
      });
      break;
  }
  
  return constraints;
}