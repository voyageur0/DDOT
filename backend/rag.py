"""
Module RAG (Retrieval-Augmented Generation) utilisant ChromaDB
Recherche dans les règlements communaux ingérés
Version améliorée avec requêtes intelligentes
"""

import chromadb
import time
from langchain_community.embeddings import HuggingFaceEmbeddings
from utils.logger import performance_monitor, log_rag_search
from typing import List, Dict, Optional
import hashlib
import json
import re

# Cache simple en mémoire pour éviter les recherches répétées
_search_cache = {}

def _get_cache_key(commune: str, query: str, limit: int) -> str:
    """Génère une clé de cache pour une recherche."""
    cache_data = f"{commune.lower()}:{query.lower()}:{limit}"
    return hashlib.md5(cache_data.encode()).hexdigest()

def _generate_smart_queries(zone: str, constraint_type: str) -> List[str]:
    """
    Génère des requêtes intelligentes basées sur la zone et le type de contrainte.
    """
    queries = []
    
    # Requêtes spécifiques par type de contrainte
    if "indice" in constraint_type.lower() or "utilisation" in constraint_type.lower():
        queries.extend([
            f"indice d'utilisation zone {zone}",
            f"coefficient d'utilisation {zone}",
            f"indice d'occupation {zone}",
            f"densité de construction {zone}",
            f"surface de plancher {zone}"
        ])
    
    elif "distance" in constraint_type.lower():
        queries.extend([
            f"distance de recul {zone}",
            f"marge de recul {zone}",
            f"distance aux limites {zone}",
            f"recul de construction {zone}"
        ])
    
    elif "hauteur" in constraint_type.lower():
        queries.extend([
            f"hauteur maximale {zone}",
            f"nombre d'étages {zone}",
            f"hauteur de construction {zone}",
            f"limitation hauteur {zone}"
        ])
    
    elif "surface" in constraint_type.lower():
        queries.extend([
            f"surface minimale {zone}",
            f"surface de terrain {zone}",
            f"superficie minimale {zone}",
            f"dimension parcelle {zone}"
        ])
    
    # Requêtes génériques pour la zone
    queries.extend([
        f"zone {zone} règlement",
        f"prescriptions zone {zone}",
        f"contraintes zone {zone}",
        f"normes zone {zone}"
    ])
    
    return queries

@performance_monitor.time_function("rag_search")
def search(commune: str, query: str, limit: int = 3, use_cache: bool = True) -> List[str]:
    """
    Recherche des passages pertinents dans les règlements communaux.
    Utilise ChromaDB avec les embeddings HuggingFace.
    
    Args:
        commune: Nom de la commune
        query: Requête de recherche
        limit: Nombre maximum de résultats
        use_cache: Utiliser le cache pour éviter les recherches répétées
    
    Returns:
        Liste des passages trouvés
    """
    start_time = time.time()
    
    # Vérifier le cache
    if use_cache:
        cache_key = _get_cache_key(commune, query, limit)
        if cache_key in _search_cache:
            cached_results = _search_cache[cache_key]
            log_rag_search(commune, query, len(cached_results), 0.01)  # Cache hit
            return cached_results
    
    try:
        # Initialiser ChromaDB et les embeddings
        client = chromadb.PersistentClient(path="chroma_db")
        collection = client.get_or_create_collection("reglements")
        
        # Créer les embeddings pour la requête
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        query_embedding = embeddings.embed_query(query)
        
        # Rechercher dans la collection avec filtre par commune
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where={"commune": commune.lower()}
        )
        
        # Extraire les documents trouvés
        documents = results['documents'][0] if results['documents'] and results['documents'][0] else []
        
        # Si pas de résultats spécifiques à la commune, chercher dans toutes les communes
        if not documents:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=limit
            )
            documents = results['documents'][0] if results['documents'] else []
        
        duration = time.time() - start_time
        log_rag_search(commune, query, len(documents), duration)
        
        # Mettre en cache les résultats
        if use_cache and documents:
            cache_key = _get_cache_key(commune, query, limit)
            _search_cache[cache_key] = documents
        
        return documents
            
    except Exception as e:
        duration = time.time() - start_time
        log_rag_search(commune, query, 0, duration)
        print(f"ERREUR lors de la recherche RAG: {e}")
        return [f"Erreur de recherche pour {commune} - {query}: {str(e)}"]

def search_with_filters(commune: str, query: str, zone: str = None, concept: str = None, limit: int = 3) -> List[str]:
    """
    Recherche avancée avec filtres sur les métadonnées.
    
    Args:
        commune: Nom de la commune
        query: Requête de recherche
        zone: Zone spécifique à rechercher (ex: "18/3")
        concept: Concept spécifique (ex: "indice", "hauteur")
        limit: Nombre maximum de résultats
    
    Returns:
        Liste des passages trouvés
    """
    try:
        client = chromadb.PersistentClient(path="chroma_db")
        collection = client.get_or_create_collection("reglements")
        
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        query_embedding = embeddings.embed_query(query)
        
        # Construire les filtres avec la syntaxe ChromaDB correcte
        where_filter = {"commune": commune.lower()}
        
        if zone and concept:
            # Filtres multiples avec opérateur AND
            where_filter = {
                "$and": [
                    {"commune": commune.lower()},
                    {"zone": zone},
                    {"concepts": {"$contains": concept}}
                ]
            }
        elif zone:
            # Filtre avec zone seulement
            where_filter = {
                "$and": [
                    {"commune": commune.lower()},
                    {"zone": zone}
                ]
            }
        elif concept:
            # Filtre avec concept seulement
            where_filter = {
                "$and": [
                    {"commune": commune.lower()},
                    {"concepts": {"$contains": concept}}
                ]
            }
        
        print(f"🔍 Recherche avec filtres : {where_filter}")
        
        # Rechercher avec filtres
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where=where_filter
        )
        
        documents = results['documents'][0] if results['documents'] and results['documents'][0] else []
        
        # Si pas de résultats avec filtres stricts, essayer sans le filtre zone
        if not documents and zone:
            print("🔄 Recherche élargie sans filtre zone...")
            if concept:
                where_filter_relaxed = {
                    "$and": [
                        {"commune": commune.lower()},
                        {"concepts": {"$contains": concept}}
                    ]
                }
            else:
                where_filter_relaxed = {"commune": commune.lower()}
            
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=limit,
                where=where_filter_relaxed
            )
            documents = results['documents'][0] if results['documents'] else []
        
        # Si toujours pas de résultats, recherche générale
        if not documents:
            print("🔄 Recherche générale sans filtres...")
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=limit,
                where={"commune": commune.lower()}
            )
            documents = results['documents'][0] if results['documents'] else []
        
        print(f"📊 {len(documents)} documents trouvés")
        return documents
        
    except Exception as e:
        print(f"ERREUR lors de la recherche avec filtres: {e}")
        return []

def search_for_constraints(commune: str, zone: str, constraint_type: str, limit: int = 5) -> List[str]:
    """
    Recherche intelligente utilisant les stratégies multiples.
    """
    print(f"🎯 Recherche intelligente pour {constraint_type} dans zone {zone}")
    
    # Utiliser les stratégies multiples
    results = search_with_multiple_strategies(
        commune=commune,
        zone=zone,
        constraint_type=constraint_type,
        limit=limit
    )
    
    return results

def search_multiple(commune: str, queries: List[str], limit: int = 3) -> Dict[str, List[str]]:
    """
    Effectue plusieurs recherches en parallèle pour optimiser les performances.
    
    Args:
        commune: Nom de la commune
        queries: Liste des requêtes à effectuer
        limit: Nombre maximum de résultats par requête
    
    Returns:
        Dictionnaire avec les résultats par requête
    """
    results = {}
    for query in queries:
        results[query] = search(commune, query, limit)
    return results

def get_collection_stats() -> Dict[str, any]:
    """
    Retourne les statistiques de la collection ChromaDB.
    
    Returns:
        Dictionnaire avec les statistiques de la collection
    """
    try:
        client = chromadb.PersistentClient(path="chroma_db")
        collection = client.get_or_create_collection("reglements")
        
        # Compter le nombre total de documents
        count = collection.count()
        
        # Obtenir un échantillon pour analyser la structure
        sample = collection.peek(limit=1)
        
        return {
            "total_documents": count,
            "collection_name": "reglements",
            "has_documents": count > 0,
            "sample_metadata": sample.get('metadatas', []) if sample else []
        }
    except Exception as e:
        return {
            "error": str(e),
            "total_documents": 0,
            "has_documents": False
        }

def clear_cache():
    """Vide le cache de recherche."""
    global _search_cache
    _search_cache.clear()
    print("OK Cache de recherche vidé")

def get_cache_stats() -> Dict[str, any]:
    """Retourne les statistiques du cache."""
    return {
        "cache_size": len(_search_cache),
        "cache_keys": list(_search_cache.keys())[:10]  # Premiers 10 clés
    }

def search_with_multiple_strategies(commune: str, zone: str, constraint_type: str = None, limit: int = 5) -> List[str]:
    """
    Recherche avec stratégies multiples pour maximiser les chances de trouver des informations pertinentes.
    
    Stratégies :
    1. Recherche par zone exacte
    2. Recherche par zone parent (18 pour 18/3)
    3. Recherche par type de zone (villa, village, etc.)
    4. Recherche par concept (indice, hauteur, etc.)
    5. Recherche sémantique générale
    """
    all_results = []
    
    # Nettoyer et analyser la zone
    zone_clean = re.sub(r'ZONE\s+', '', zone, flags=re.IGNORECASE).strip()
    zone_parts = zone_clean.split()
    zone_number = zone_parts[0] if zone_parts else zone_clean
    
    # Extraire zone parent (18/3 -> 18)
    zone_parent = zone_number.split('/')[0] if '/' in zone_number else zone_number
    
    # Déterminer le type de zone d'après la description
    zone_type = None
    if 'villa' in zone.lower():
        zone_type = 'villa'
    elif 'village' in zone.lower():
        zone_type = 'village'
    elif 'centre' in zone.lower():
        zone_type = 'centre'
    elif 'artisan' in zone.lower():
        zone_type = 'artisanal'
    
    print(f"🎯 Stratégies de recherche pour zone: {zone_number} (parent: {zone_parent}, type: {zone_type})")
    
    # Stratégie 1: Recherche par zone exacte avec query()
    print("📍 Stratégie 1: Zone exacte")
    try:
        client = chromadb.PersistentClient(path="chroma_db")
        collection = client.get_or_create_collection("reglements")
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        exact_queries = [
            f"zone {zone_number}",
            f"ZONE {zone_number}",
            zone_number
        ]
        
        for query in exact_queries:
            try:
                query_embedding = embeddings.embed_query(query)
                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=2,
                    where={"commune": commune.lower()}
                )
                all_results.extend(results['documents'][0] if results['documents'] else [])
            except Exception as e:
                                    print(f"  ATTENTION Erreur recherche exacte '{query}': {e}")
                
    except Exception as e:
        print(f"  ERREUR stratégie 1: {e}")
    
    # Stratégie 2: Recherche par zone parent
    if zone_parent != zone_number:
        print(f"📍 Stratégie 2: Zone parent ({zone_parent})")
        try:
            parent_queries = [
                f"zone {zone_parent}",
                f"ZONE {zone_parent}"
            ]
            
            for query in parent_queries:
                try:
                    query_embedding = embeddings.embed_query(query)
                    results = collection.query(
                        query_embeddings=[query_embedding],
                        n_results=2,
                        where={"commune": commune.lower()}
                    )
                    all_results.extend(results['documents'][0] if results['documents'] else [])
                except Exception as e:
                    print(f"  ATTENTION Erreur recherche parent '{query}': {e}")
                    
        except Exception as e:
            print(f"  ERREUR stratégie 2: {e}")
    
    # Stratégie 3: Recherche par type de zone
    if zone_type:
        print(f"📍 Stratégie 3: Type de zone ({zone_type})")
        try:
            type_queries = [
                f"{zone_type} indice utilisation",
                f"{zone_type} hauteur",
                f"{zone_type} distance",
                f"zone {zone_type}"
            ]
            
            for query in type_queries:
                try:
                    query_embedding = embeddings.embed_query(query)
                    results = collection.query(
                        query_embeddings=[query_embedding],
                        n_results=2,
                        where={"commune": commune.lower()}
                    )
                    all_results.extend(results['documents'][0] if results['documents'] else [])
                except Exception as e:
                    print(f"  ATTENTION Erreur recherche type '{query}': {e}")
                    
        except Exception as e:
            print(f"  ERREUR stratégie 3: {e}")
    
    # Stratégie 4: Recherche par concept si spécifié
    if constraint_type:
        print(f"📍 Stratégie 4: Concept ({constraint_type})")
        concept_mapping = {
            "indice d'utilisation": "indice utilisation coefficient",
            "indice": "indice utilisation coefficient",
            "distance": "distance limite recul",
            "hauteur": "hauteur maximale étages",
            "surface": "surface minimale terrain",
            "stationnement": "place parc stationnement",
            "toiture": "toiture toit pente"
        }
        
        concept_key = None
        for key in concept_mapping:
            if key in constraint_type.lower():
                concept_key = key
                break
        
        if concept_key:
            concept_queries = concept_mapping[concept_key].split()
            for query in concept_queries:
                try:
                    query_embedding = embeddings.embed_query(query)
                    results = collection.query(
                        query_embeddings=[query_embedding],
                        n_results=2,
                        where={"commune": commune.lower()}
                    )
                    all_results.extend(results['documents'][0] if results['documents'] else [])
                except Exception as e:
                    print(f"  ATTENTION Erreur recherche concept '{query}': {e}")
    
    # Stratégie 5: Recherche sémantique large
    print("📍 Stratégie 5: Recherche sémantique")
    try:
        semantic_queries = [
            f"indice utilisation",
            f"coefficient utilisation",
            f"hauteur maximum",
            f"distance propriété",
            f"places parking"
        ]
        
        for query in semantic_queries:
            try:
                query_embedding = embeddings.embed_query(query)
                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=1,
                    where={"commune": commune.lower()}
                )
                all_results.extend(results['documents'][0] if results['documents'] else [])
            except Exception as e:
                print(f"  ATTENTION Erreur recherche sémantique '{query}': {e}")
                
    except Exception as e:
        print(f"  ERREUR stratégie 5: {e}")
    
    # Dédupliquer et filtrer
    unique_results = []
    seen = set()
    
    for result in all_results:
        # Utiliser les 100 premiers caractères comme clé de déduplication
        key = result[:100].strip()
        if key not in seen and len(result.strip()) > 50:
            seen.add(key)
            unique_results.append(result)
    
    print(f"📋 Total: {len(all_results)} résultats bruts, {len(unique_results)} uniques")
    return unique_results[:limit] 