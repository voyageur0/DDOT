#!/usr/bin/env python3
"""
Test de la recherche RAG avec le règlement de Lens
"""

from rag import search
import json

def test_rag_lens():
    """Teste la recherche RAG pour Lens"""
    
    print("=== Test RAG avec le règlement de Lens ===")
    print()
    
    # Tests de recherche
    queries = [
        "indice d utilisation",
        "distance limite propriété", 
        "hauteur maximale",
        "places de parc",
        "toiture autorisée"
    ]
    
    for query in queries:
        print(f"🔍 Recherche: '{query}'")
        try:
            results = search("lens", query, limit=2)
            
            if results:
                print(f"✅ {len(results)} résultats trouvés:")
                for i, result in enumerate(results, 1):
                    print(f"  {i}. {result[:150]}...")
            else:
                print("❌ Aucun résultat trouvé")
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
        
        print("-" * 50)
    
    print("\n🎯 Test complet de l'analyse avec RDPPF + RAG")
    print("Test avec Lens, parcelle 5217...")
    
    try:
        from rdppf import fetch_rdppf
        from llm import extract_rules, generate_report
        
        # Récupérer les données RDPPF
        rdppf_data = fetch_rdppf("Lens", "5217")
        print("✅ Données RDPPF récupérées")
        
        # Extraire les règles du règlement
        rules = extract_rules("lens")
        print(f"✅ Règles extraites: {rules}")
        
        # Générer le rapport complet
        report = generate_report("Lens", rdppf_data, rules)
        print("✅ Rapport généré:")
        print(report[:500] + "..." if len(report) > 500 else report)
        
    except Exception as e:
        print(f"❌ Erreur lors du test complet: {e}")

if __name__ == "__main__":
    test_rag_lens() 