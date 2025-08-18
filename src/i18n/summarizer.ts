/**
 * Utilitaire de résumé et troncature de texte
 * Garantit des messages courts et percutants (≤12 mots)
 */

/**
 * Tronque une phrase à un nombre maximum de mots
 * Préserve le sens en coupant aux limites de mots
 */
export function truncateSentence(text: string, limit: number = 12): string {
  if (!text) return '';
  
  // Nettoyer le texte
  const cleaned = text.trim().replace(/\s+/g, ' ');
  
  // Découper en mots
  const words = cleaned.split(/\s+/);
  
  // Si déjà dans la limite, retourner tel quel
  if (words.length <= limit) {
    return cleaned;
  }
  
  // Tronquer et ajouter ellipse
  const truncated = words.slice(0, limit).join(' ');
  
  // S'assurer qu'on ne coupe pas au milieu d'une ponctuation
  if (truncated.endsWith(',') || truncated.endsWith(';')) {
    return truncated.slice(0, -1) + '…';
  }
  
  return truncated + '…';
}

/**
 * Résume une liste de messages en respectant une limite globale
 * Priorise les messages les plus importants
 */
export function summarizeMessages(
  messages: Array<{ text: string; priority?: number }>,
  maxMessages: number = 5,
  maxWordsPerMessage: number = 12
): string[] {
  if (!messages || messages.length === 0) return [];
  
  // Trier par priorité décroissante (plus haute priorité en premier)
  const sorted = [...messages].sort((a, b) => 
    (b.priority || 0) - (a.priority || 0)
  );
  
  // Prendre les N plus importants
  const selected = sorted.slice(0, maxMessages);
  
  // Tronquer chaque message
  return selected.map(msg => truncateSentence(msg.text, maxWordsPerMessage));
}

/**
 * Extrait les mots-clés importants d'un texte
 * Utile pour créer des résumés ultra-courts
 */
export function extractKeywords(text: string, maxWords: number = 5): string {
  if (!text) return '';
  
  // Mots à ignorer (français)
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'à', 'au', 'aux',
    'et', 'ou', 'mais', 'donc', 'car', 'ni', 'que', 'qui', 'quoi',
    'dont', 'où', 'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par',
    'ce', 'ces', 'cette', 'se', 'sa', 'son', 'ses', 'leur', 'leurs'
  ]);
  
  // Nettoyer et découper
  const words = text
    .toLowerCase()
    .replace(/[.,;:!?()]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Prendre les premiers mots significatifs
  const keywords = words.slice(0, maxWords);
  
  // Capitaliser le premier mot
  if (keywords.length > 0) {
    keywords[0] = keywords[0].charAt(0).toUpperCase() + keywords[0].slice(1);
  }
  
  return keywords.join(' ');
}

/**
 * Formatte un message de contrainte de manière concise
 * Combine label et détails en respectant la limite de mots
 */
export function formatConstraintMessage(
  label: string,
  detail?: string,
  maxWords: number = 12
): string {
  if (!detail) {
    return truncateSentence(label, maxWords);
  }
  
  // Combiner label et détail
  const combined = `${label} - ${detail}`;
  
  // Si trop long, prioriser le label
  const words = combined.split(/\s+/);
  if (words.length <= maxWords) {
    return combined;
  }
  
  // Calculer l'espace disponible pour le détail
  const labelWords = label.split(/\s+/).length;
  const remainingWords = maxWords - labelWords - 1; // -1 pour le tiret
  
  if (remainingWords <= 0) {
    return truncateSentence(label, maxWords);
  }
  
  // Tronquer le détail
  const truncatedDetail = truncateSentence(detail, remainingWords);
  return `${label} - ${truncatedDetail}`;
}

/**
 * Groupe et résume des messages similaires
 * Évite la répétition en consolidant les messages proches
 */
export function groupSimilarMessages(
  messages: string[],
  similarityThreshold: number = 0.6
): string[] {
  if (messages.length <= 1) return messages;
  
  const groups: string[][] = [];
  const used = new Set<number>();
  
  // Fonction simple de similarité basée sur les mots communs
  const similarity = (a: string, b: string): number => {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.size / union.size;
  };
  
  // Grouper les messages similaires
  for (let i = 0; i < messages.length; i++) {
    if (used.has(i)) continue;
    
    const group = [messages[i]];
    used.add(i);
    
    for (let j = i + 1; j < messages.length; j++) {
      if (used.has(j)) continue;
      
      if (similarity(messages[i], messages[j]) >= similarityThreshold) {
        group.push(messages[j]);
        used.add(j);
      }
    }
    
    groups.push(group);
  }
  
  // Créer un message représentatif pour chaque groupe
  return groups.map(group => {
    if (group.length === 1) return group[0];
    
    // Pour un groupe, prendre le plus court comme base
    const shortest = group.reduce((a, b) => a.length < b.length ? a : b);
    
    // Ajouter le nombre si plusieurs
    if (group.length > 2) {
      return `${shortest} (×${group.length})`;
    }
    
    return shortest;
  });
}

/**
 * Analyse la longueur des messages et retourne des statistiques
 * Utile pour le debug et l'optimisation
 */
export function analyzeMessageLengths(messages: string[]): {
  total: number;
  avgWords: number;
  maxWords: number;
  tooLong: string[];
} {
  if (messages.length === 0) {
    return { total: 0, avgWords: 0, maxWords: 0, tooLong: [] };
  }
  
  const wordCounts = messages.map(msg => msg.split(/\s+/).length);
  const total = messages.length;
  const avgWords = wordCounts.reduce((a, b) => a + b, 0) / total;
  const maxWords = Math.max(...wordCounts);
  const tooLong = messages.filter(msg => msg.split(/\s+/).length > 12);
  
  return {
    total,
    avgWords: Math.round(avgWords * 10) / 10,
    maxWords,
    tooLong
  };
}