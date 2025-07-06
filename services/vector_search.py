import faiss
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import pickle
import os
from .openai_service import OpenAIService

class VectorSearchService:
    """Service de recherche sémantique avec FAISS"""
    
    def __init__(self, dimension: int = 1536):
        self.dimension = dimension
        self.index = faiss.IndexFlatL2(dimension)
        self.metadata = []
        self.openai_service = OpenAIService()
        self.index_path = 'data/faiss_index.bin'
        self.metadata_path = 'data/faiss_metadata.pkl'
        
    def add_documents(self, texts: List[str], metadata: List[Dict[str, Any]]) -> None:
        """Ajouter des documents à l'index"""
        # Générer les embeddings
        embeddings = self.openai_service.generate_embeddings_batch(texts)
        
        if embeddings:
            # Convertir en numpy array
            embeddings_array = np.array(embeddings).astype('float32')
            
            # Ajouter à l'index FAISS
            self.index.add(embeddings_array)
            
            # Ajouter les métadonnées
            self.metadata.extend(metadata)
            
            print(f"Ajouté {len(texts)} documents à l'index. Total: {self.index.ntotal}")
    
    def search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Rechercher les k documents les plus similaires"""
        # Générer l'embedding de la requête
        query_embedding = self.openai_service.generate_embedding(query)
        
        if not query_embedding:
            return []
        
        # Convertir en numpy array
        query_array = np.array([query_embedding]).astype('float32')
        
        # Rechercher dans l'index
        distances, indices = self.index.search(query_array, k)
        
        # Préparer les résultats
        results = []
        for i, idx in enumerate(indices[0]):
            if idx < len(self.metadata):
                result = {
                    'metadata': self.metadata[idx],
                    'distance': float(distances[0][i]),
                    'similarity': 1 / (1 + float(distances[0][i]))  # Convertir distance en similarité
                }
                results.append(result)
        
        return results
    
    def search_with_filter(self, query: str, filter_fn: callable, k: int = 5) -> List[Dict[str, Any]]:
        """Rechercher avec un filtre sur les métadonnées"""
        # Rechercher plus de résultats pour compenser le filtrage
        raw_results = self.search(query, k * 3)
        
        # Filtrer les résultats
        filtered_results = []
        for result in raw_results:
            if filter_fn(result['metadata']):
                filtered_results.append(result)
                if len(filtered_results) >= k:
                    break
        
        return filtered_results
    
    def get_similar_chunks(self, document_id: int, chunk_index: int, k: int = 3) -> List[Dict[str, Any]]:
        """Obtenir les chunks similaires à un chunk donné"""
        # Trouver l'index du chunk dans les métadonnées
        target_idx = None
        for i, meta in enumerate(self.metadata):
            if meta.get('document_id') == document_id and meta.get('chunk_index') == chunk_index:
                target_idx = i
                break
        
        if target_idx is None:
            return []
        
        # Obtenir l'embedding du chunk cible
        target_embedding = self.index.reconstruct(target_idx)
        
        # Rechercher les chunks similaires
        distances, indices = self.index.search(np.array([target_embedding]), k + 1)
        
        # Exclure le chunk lui-même et préparer les résultats
        results = []
        for i, idx in enumerate(indices[0]):
            if idx != target_idx and idx < len(self.metadata):
                result = {
                    'metadata': self.metadata[idx],
                    'distance': float(distances[0][i]),
                    'similarity': 1 / (1 + float(distances[0][i]))
                }
                results.append(result)
        
        return results[:k]
    
    def save_index(self) -> None:
        """Sauvegarder l'index et les métadonnées sur disque"""
        # Créer le répertoire si nécessaire
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        
        # Sauvegarder l'index FAISS
        faiss.write_index(self.index, self.index_path)
        
        # Sauvegarder les métadonnées
        with open(self.metadata_path, 'wb') as f:
            pickle.dump(self.metadata, f)
        
        print(f"Index sauvegardé: {self.index.ntotal} vecteurs")
    
    def load_index(self) -> bool:
        """Charger l'index depuis le disque"""
        try:
            if os.path.exists(self.index_path) and os.path.exists(self.metadata_path):
                # Charger l'index FAISS
                self.index = faiss.read_index(self.index_path)
                
                # Charger les métadonnées
                with open(self.metadata_path, 'rb') as f:
                    self.metadata = pickle.load(f)
                
                print(f"Index chargé: {self.index.ntotal} vecteurs")
                return True
        except Exception as e:
            print(f"Erreur lors du chargement de l'index: {e}")
        
        return False
    
    def clear_index(self) -> None:
        """Vider l'index"""
        self.index = faiss.IndexFlatL2(self.dimension)
        self.metadata = []
        print("Index vidé")
    
    def remove_document(self, document_id: int) -> None:
        """Supprimer tous les chunks d'un document de l'index"""
        # Identifier les indices à supprimer
        indices_to_remove = []
        for i, meta in enumerate(self.metadata):
            if meta.get('document_id') == document_id:
                indices_to_remove.append(i)
        
        if not indices_to_remove:
            return
        
        # Reconstruire l'index sans les documents supprimés
        new_embeddings = []
        new_metadata = []
        
        for i in range(self.index.ntotal):
            if i not in indices_to_remove:
                embedding = self.index.reconstruct(i)
                new_embeddings.append(embedding)
                new_metadata.append(self.metadata[i])
        
        # Recréer l'index
        self.clear_index()
        if new_embeddings:
            embeddings_array = np.array(new_embeddings).astype('float32')
            self.index.add(embeddings_array)
            self.metadata = new_metadata
        
        print(f"Document {document_id} supprimé. Vecteurs restants: {self.index.ntotal}")
    
    def get_context_for_question(self, question: str, document_id: Optional[int] = None, k: int = 5) -> str:
        """Obtenir le contexte pertinent pour répondre à une question"""
        # Définir le filtre si un document est spécifié
        if document_id:
            filter_fn = lambda meta: meta.get('document_id') == document_id
            results = self.search_with_filter(question, filter_fn, k)
        else:
            results = self.search(question, k)
        
        # Combiner les textes des chunks pertinents
        context_parts = []
        for result in results:
            meta = result['metadata']
            chunk_text = meta.get('chunk_text', '')
            if chunk_text:
                context_parts.append(chunk_text)
        
        return '\n\n'.join(context_parts)
    
    def index_document(self, document_id: int, chunks: List[str]) -> None:
        """Indexer tous les chunks d'un document"""
        # Préparer les métadonnées pour chaque chunk
        metadata_list = []
        for i, chunk in enumerate(chunks):
            metadata_list.append({
                'document_id': document_id,
                'chunk_index': i,
                'chunk_text': chunk
            })
        
        # Ajouter à l'index
        self.add_documents(chunks, metadata_list)
        
        # Sauvegarder automatiquement
        self.save_index() 