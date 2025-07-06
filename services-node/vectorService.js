const fs = require('fs').promises;
const path = require('path');
const { DocumentEmbedding } = require('../models-node');
const { generateEmbedding, generateEmbeddings, cosineSimilarity } = require('./openaiService');

// Index en mémoire pour la recherche vectorielle
let vectorIndex = {
  embeddings: [],
  metadata: []
};

const INDEX_PATH = path.join(__dirname, '../data/vector_index.json');

/**
 * Charger l'index vectoriel depuis le disque
 */
async function loadVectorIndex() {
  try {
    const data = await fs.readFile(INDEX_PATH, 'utf8');
    vectorIndex = JSON.parse(data);
    console.log(`Index vectoriel chargé: ${vectorIndex.embeddings.length} vecteurs`);
    return true;
  } catch (error) {
    console.log('Aucun index vectoriel existant, création d\'un nouvel index');
    await saveVectorIndex();
    return false;
  }
}

/**
 * Sauvegarder l'index vectoriel sur le disque
 */
async function saveVectorIndex() {
  try {
    await fs.mkdir(path.dirname(INDEX_PATH), { recursive: true });
    await fs.writeFile(INDEX_PATH, JSON.stringify(vectorIndex), 'utf8');
    console.log(`Index vectoriel sauvegardé: ${vectorIndex.embeddings.length} vecteurs`);
  } catch (error) {
    console.error('Erreur sauvegarde index:', error);
  }
}

/**
 * Ajouter des documents à l'index
 */
async function addDocuments(texts, metadata) {
  // Générer les embeddings
  const embeddings = await generateEmbeddings(texts);
  
  if (embeddings && embeddings.length > 0) {
    // Ajouter à l'index
    for (let i = 0; i < embeddings.length; i++) {
      vectorIndex.embeddings.push(embeddings[i]);
      vectorIndex.metadata.push(metadata[i]);
    }
    
    // Sauvegarder l'index
    await saveVectorIndex();
    
    console.log(`Ajouté ${texts.length} documents à l'index`);
  }
}

/**
 * Rechercher les k documents les plus similaires
 */
async function search(query, k = 5) {
  // Générer l'embedding de la requête
  const queryEmbedding = await generateEmbedding(query);
  
  if (!queryEmbedding) {
    return [];
  }
  
  // Calculer les similarités
  const similarities = [];
  
  for (let i = 0; i < vectorIndex.embeddings.length; i++) {
    const similarity = cosineSimilarity(queryEmbedding, vectorIndex.embeddings[i]);
    similarities.push({
      index: i,
      similarity,
      metadata: vectorIndex.metadata[i]
    });
  }
  
  // Trier par similarité décroissante
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Retourner les k premiers résultats
  return similarities.slice(0, k).map(item => ({
    metadata: item.metadata,
    similarity: item.similarity
  }));
}

/**
 * Rechercher avec un filtre
 */
async function searchWithFilter(query, filterFn, k = 5) {
  // Rechercher plus de résultats pour compenser le filtrage
  const rawResults = await search(query, k * 3);
  
  // Filtrer les résultats
  const filteredResults = rawResults.filter(result => filterFn(result.metadata));
  
  // Retourner les k premiers résultats filtrés
  return filteredResults.slice(0, k);
}

/**
 * Supprimer un document de l'index
 */
async function removeDocument(documentId) {
  // Filtrer l'index pour supprimer les embeddings du document
  const newEmbeddings = [];
  const newMetadata = [];
  
  for (let i = 0; i < vectorIndex.metadata.length; i++) {
    if (vectorIndex.metadata[i].documentId !== documentId) {
      newEmbeddings.push(vectorIndex.embeddings[i]);
      newMetadata.push(vectorIndex.metadata[i]);
    }
  }
  
  const removed = vectorIndex.embeddings.length - newEmbeddings.length;
  
  vectorIndex.embeddings = newEmbeddings;
  vectorIndex.metadata = newMetadata;
  
  // Sauvegarder l'index mis à jour
  await saveVectorIndex();
  
  console.log(`Document ${documentId} supprimé. ${removed} vecteurs supprimés`);
}

/**
 * Obtenir le contexte pertinent pour une question
 */
async function getContextForQuestion(question, documentId = null, k = 5) {
  let results;
  
  if (documentId) {
    // Filtrer par document
    const filter = (meta) => meta.documentId === documentId;
    results = await searchWithFilter(question, filter, k);
  } else {
    results = await search(question, k);
  }
  
  // Combiner les textes des chunks pertinents
  const contextParts = results.map(result => result.metadata.chunkText || '');
  
  return contextParts.join('\n\n');
}

/**
 * Indexer un document complet
 */
async function indexDocument(documentId, chunks) {
  // Préparer les métadonnées pour chaque chunk
  const metadataList = chunks.map((chunk, index) => ({
    documentId,
    chunkIndex: index,
    chunkText: chunk
  }));
  
  // Ajouter à l'index vectoriel en mémoire
  await addDocuments(chunks, metadataList);
  
  // Sauvegarder aussi en base de données
  try {
    // Générer les embeddings
    const embeddings = await generateEmbeddings(chunks);
    
    if (embeddings && embeddings.length > 0) {
      // Créer les entrées en base
      for (let i = 0; i < chunks.length; i++) {
        await DocumentEmbedding.create({
          documentId,
          chunkIndex: i,
          chunkText: chunks[i],
          embedding: Buffer.from(JSON.stringify(embeddings[i])),
          metadata: { timestamp: new Date() }
        });
      }
    }
  } catch (error) {
    console.error('Erreur sauvegarde embeddings en base:', error);
  }
}

/**
 * Vider l'index
 */
async function clearIndex() {
  vectorIndex = {
    embeddings: [],
    metadata: []
  };
  await saveVectorIndex();
  console.log('Index vidé');
}

/**
 * Obtenir des statistiques sur l'index
 */
function getIndexStats() {
  const documents = new Set(vectorIndex.metadata.map(m => m.documentId));
  
  return {
    totalVectors: vectorIndex.embeddings.length,
    totalDocuments: documents.size,
    indexSize: JSON.stringify(vectorIndex).length
  };
}

module.exports = {
  loadVectorIndex,
  saveVectorIndex,
  addDocuments,
  search,
  searchWithFilter,
  removeDocument,
  getContextForQuestion,
  indexDocument,
  clearIndex,
  getIndexStats
}; 