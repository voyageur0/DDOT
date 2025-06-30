"""
Script d'ingestion amélioré pour les règlements communaux
Chunking intelligent avec métadonnées enrichies
"""
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
import chromadb
import pathlib
import re

# Configuration
PDF_PATH = pathlib.Path("data/reglements/reglement_lens.pdf")
COMMUNE = "lens"

def extract_metadata_from_text(text: str, page_num: int) -> dict:
    """Extrait des métadonnées intelligentes du texte."""
    metadata = {
        "commune": COMMUNE,
        "page": page_num,
        "type": "règlement"
    }
    
    # Détecter les articles
    article_match = re.search(r'Article\s+(\d+(?:\.\d+)?)', text, re.IGNORECASE)
    if article_match:
        metadata["article"] = article_match.group(1)
        metadata["type"] = "article"
    
    # Détecter les zones (amélioration pour capturer les sous-zones)
    zone_patterns = [
        r'ZONE\s+(\d+[A-Z]?(?:/\d+)?)',
        r'zone\s+(\d+[A-Z]?(?:/\d+)?)',
        r'Zone\s+(\d+[A-Z]?(?:/\d+)?)',
        r'(\d+/\d+)\s+(?:Zone|zone)',  # Capturer "18/3 Zone..."
        r'ZONE\s+(\d+/\d+)',           # Capturer "ZONE 18/3"
    ]
    for pattern in zone_patterns:
        zone_match = re.search(pattern, text)
        if zone_match:
            metadata["zone"] = zone_match.group(1)
            break
    
    # Détecter les concepts clés
    concepts = []
    concept_patterns = {
        "indice": r"indice.*?utilisation|coefficient.*?utilisation|densité",
        "hauteur": r"hauteur.*?max|hauteur.*?faît|hauteur.*?corniche",
        "distance": r"distance.*?limite|recul|marge",
        "surface": r"surface.*?terrain|superficie.*?min",
        "stationnement": r"place.*?parc|stationnement|parking",
        "toiture": r"toiture|toit|pente|faîte"
    }
    
    for concept, pattern in concept_patterns.items():
        if re.search(pattern, text, re.IGNORECASE):
            concepts.append(concept)
    
    if concepts:
        metadata["concepts"] = ",".join(concepts)  # Convertir la liste en chaîne
    
    return metadata

def smart_chunking(documents):
    """Chunking intelligent qui respecte la structure du document."""
    chunks = []
    
    for doc in documents:
        text = doc.page_content
        page_num = doc.metadata.get('page', 0)
        
        # Diviser par articles d'abord
        article_splits = re.split(r'(?=Article\s+\d+)', text, flags=re.IGNORECASE)
        
        for article_text in article_splits:
            if len(article_text.strip()) < 50:  # Ignorer les fragments trop courts
                continue
            
            # Si l'article est trop long, le subdiviser intelligemment
            if len(article_text) > 2000:
                # Diviser par paragraphes
                paragraphs = re.split(r'\n\s*\n', article_text)
                current_chunk = ""
                
                for paragraph in paragraphs:
                    if len(current_chunk + paragraph) > 1500:
                        if current_chunk:
                            metadata = extract_metadata_from_text(current_chunk, page_num)
                            chunks.append({
                                'text': current_chunk.strip(),
                                'metadata': metadata
                            })
                        current_chunk = paragraph
                    else:
                        current_chunk += "\n\n" + paragraph if current_chunk else paragraph
                
                # Ajouter le dernier chunk
                if current_chunk:
                    metadata = extract_metadata_from_text(current_chunk, page_num)
                    chunks.append({
                        'text': current_chunk.strip(),
                        'metadata': metadata
                    })
            else:
                # Article court, garder en entier
                metadata = extract_metadata_from_text(article_text, page_num)
                chunks.append({
                    'text': article_text.strip(),
                    'metadata': metadata
                })
    
    return chunks

def ingest_with_smart_chunking():
    """Ingestion avec chunking intelligent."""
    print(f"🔄 Ingestion de {PDF_PATH} avec chunking intelligent...")
    
    # Charger le PDF
    loader = PyPDFLoader(str(PDF_PATH))
    pages = loader.load()
    print(f"📄 {len(pages)} pages chargées")
    
    # Chunking intelligent
    chunks = smart_chunking(pages)
    print(f"🧩 {len(chunks)} chunks créés")
    
    # Créer les embeddings
    print("🔗 Création des embeddings...")
    emb = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    # Initialiser ChromaDB
    client = chromadb.PersistentClient(path="chroma_db")
    collection = client.get_or_create_collection("reglements")
    
    # Nettoyer la collection existante pour cette commune
    try:
        collection.delete(where={"commune": COMMUNE})
        print(f"🗑️ Anciens documents de {COMMUNE} supprimés")
    except:
        pass
    
    # Préparer les données
    texts = [chunk['text'] for chunk in chunks]
    metadatas = [chunk['metadata'] for chunk in chunks]
    vectors = emb.embed_documents(texts)
    ids = [f"{COMMUNE}_{i}" for i in range(len(texts))]
    
    # Ajouter à ChromaDB
    collection.add(
        documents=texts,
        embeddings=vectors,
        metadatas=metadatas,
        ids=ids
    )
    
    print(f"✅ Ingestion terminée : {len(texts)} chunks indexés")
    
    # Afficher quelques statistiques
    zone_chunks = [c for c in chunks if 'zone' in c['metadata']]
    article_chunks = [c for c in chunks if c['metadata'].get('type') == 'article']
    concept_chunks = [c for c in chunks if 'concepts' in c['metadata']]
    
    print(f"📊 Statistiques :")
    print(f"  - Chunks avec zone : {len(zone_chunks)}")
    print(f"  - Articles : {len(article_chunks)}")
    print(f"  - Chunks avec concepts : {len(concept_chunks)}")

if __name__ == "__main__":
    ingest_with_smart_chunking()
