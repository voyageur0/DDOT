"""
Script de diagnostic des métadonnées ChromaDB
Pour comprendre comment optimiser les requêtes
"""
import chromadb
from pprint import pprint

def analyze_metadata():
    """Analyse les métadonnées stockées dans ChromaDB."""
    print("🔍 ANALYSE DES MÉTADONNÉES CHROMADB")
    print("=" * 50)
    
    # Initialiser ChromaDB
    client = chromadb.PersistentClient(path="chroma_db")
    collection = client.get_or_create_collection("reglements")
    
    # Récupérer tous les documents pour Lens
    results = collection.get(
        where={"commune": "lens"},
        include=["metadatas", "documents"]
    )
    
    print(f"📊 Total documents pour Lens : {len(results['documents'])}")
    print()
    
    # Analyser les métadonnées uniques
    zones_found = set()
    concepts_found = set()
    types_found = set()
    articles_found = set()
    
    for i, metadata in enumerate(results['metadatas']):
        if metadata.get('zone'):
            zones_found.add(metadata['zone'])
        if metadata.get('concepts'):
            concepts_found.add(metadata['concepts'])
        if metadata.get('type'):
            types_found.add(metadata['type'])
        if metadata.get('article'):
            articles_found.add(metadata['article'])
    
    print("🎯 ZONES TROUVÉES :")
    for zone in sorted(zones_found):
        print(f"  - {zone}")
    
    print(f"\n📝 TYPES TROUVÉS :")
    for type_found in sorted(types_found):
        print(f"  - {type_found}")
    
    print(f"\n🧩 CONCEPTS TROUVÉS :")
    for concept in sorted(concepts_found):
        print(f"  - {concept}")
    
    print(f"\n📖 ARTICLES TROUVÉS (échantillon) :")
    for article in sorted(list(articles_found))[:10]:
        print(f"  - Article {article}")
    
    # Rechercher spécifiquement la zone 18/3
    print(f"\n🎯 RECHERCHE SPÉCIFIQUE ZONE 18/3 :")
    print("-" * 40)
    
    # Test 1: Recherche exacte
    zone_18_3_exact = collection.get(
        where={"$and": [{"commune": "lens"}, {"zone": "18/3"}]},
        include=["metadatas", "documents"]
    )
    print(f"Zone exacte '18/3' : {len(zone_18_3_exact['documents'])} documents")
    
    # Test 2: Recherche avec variations
    variations = ["18/3", "ZONE 18/3", "Zone 18/3", "zone 18/3"]
    for variation in variations:
        try:
            results_var = collection.get(
                where={"$and": [{"commune": "lens"}, {"zone": variation}]},
                include=["metadatas", "documents"]
            )
            print(f"Zone '{variation}' : {len(results_var['documents'])} documents")
        except Exception as e:
            print(f"Zone '{variation}' : Erreur - {e}")
    
    # Test 3: Recherche par contenu avec "18/3"
    print(f"\n🔍 RECHERCHE PAR CONTENU '18/3' :")
    print("-" * 40)
    
    documents_with_18_3 = []
    for i, doc in enumerate(results['documents']):
        if "18/3" in doc:
            metadata = results['metadatas'][i]
            documents_with_18_3.append({
                'metadata': metadata,
                'preview': doc[:200]
            })
    
    print(f"Documents contenant '18/3' : {len(documents_with_18_3)}")
    for i, doc_info in enumerate(documents_with_18_3[:3]):  # Afficher les 3 premiers
        print(f"\nDocument {i+1} :")
        print(f"  Métadonnées : {doc_info['metadata']}")
        print(f"  Aperçu : {doc_info['preview']}...")
    
    # Test 4: Recherche des concepts d'indice d'utilisation (correction)
    print(f"\n🎯 RECHERCHE CONCEPTS 'INDICE' :")
    print("-" * 40)
    
    # Chercher tous les documents avec concepts
    docs_with_concepts = []
    for i, metadata in enumerate(results['metadatas']):
        concepts = metadata.get('concepts', '')
        if 'indice' in concepts:
            docs_with_concepts.append({
                'metadata': metadata,
                'preview': results['documents'][i][:200]
            })
    
    print(f"Documents avec concept 'indice' : {len(docs_with_concepts)}")
    
    for i, doc_info in enumerate(docs_with_concepts[:3]):
        metadata = doc_info['metadata']
        print(f"  {i+1}. Zone: {metadata.get('zone', 'Non spécifiée')} | "
              f"Article: {metadata.get('article', 'Non spécifié')} | "
              f"Concepts: {metadata.get('concepts', 'Aucun')}")
        
    # Test 5: Chercher la zone 18 (sans /3)
    print(f"\n🎯 RECHERCHE ZONE 18 (sans /3) :")
    print("-" * 40)
    
    zone_18_docs = []
    for i, metadata in enumerate(results['metadatas']):
        zone = metadata.get('zone', '')
        if zone == '18':
            zone_18_docs.append({
                'metadata': metadata,
                'preview': results['documents'][i][:300]
            })
    
    print(f"Documents zone 18 : {len(zone_18_docs)}")
    
    for i, doc_info in enumerate(zone_18_docs[:2]):
        metadata = doc_info['metadata']
        print(f"\nDocument {i+1} zone 18 :")
        print(f"  Métadonnées : {metadata}")
        print(f"  Aperçu : {doc_info['preview']}...")
        
    # Test 6: Rechercher tous les documents mentionnant "villa"
    print(f"\n🏠 DOCUMENTS MENTIONNANT 'VILLA' :")
    print("-" * 40)
    
    villa_docs = []
    for i, doc in enumerate(results['documents']):
        if 'villa' in doc.lower():
            metadata = results['metadatas'][i]
            villa_docs.append({
                'metadata': metadata,
                'preview': doc[:300]
            })
    
    print(f"Documents mentionnant 'villa' : {len(villa_docs)}")
    
    for i, doc_info in enumerate(villa_docs[:2]):
        metadata = doc_info['metadata']
        print(f"\nDocument villa {i+1} :")
        print(f"  Zone: {metadata.get('zone', 'Non spécifiée')}")
        print(f"  Article: {metadata.get('article', 'Non spécifié')}")
        print(f"  Aperçu : {doc_info['preview']}...")

if __name__ == "__main__":
    analyze_metadata() 