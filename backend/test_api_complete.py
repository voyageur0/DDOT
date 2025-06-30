#!/usr/bin/env python3
"""
Test complet de l'API améliorée Urban-AI Valais
Teste le système hybride Zone RDPPF + Règlement communal
"""

import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:8000"
TEST_CASES = [
    {
        "name": "Lens - Parcelle 5217 (vraie parcelle)",
        "commune": "Lens",
        "parcelle": "5217",
        "expected_zone": "ZONE 18/3",
        "expected_indice": "0.30"
    }
]

def test_health():
    """Test la santé de l'API"""
    print("🏥 Test de santé de l'API...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            print("✅ API opérationnelle")
            return True
        else:
            print(f"❌ API répond avec statut {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Erreur de connexion à l'API: {e}")
        return False

def test_ia_constraints():
    """Test l'endpoint principal avec notre système amélioré"""
    print("\n🤖 Test du système IA amélioré...")
    
    for test_case in TEST_CASES:
        print(f"\n📋 Test: {test_case['name']}")
        print(f"   Commune: {test_case['commune']}, Parcelle: {test_case['parcelle']}")
        
        start_time = time.time()
        
        try:
            response = requests.post(
                f"{BASE_URL}/ia-constraints",
                json={
                    "commune": test_case['commune'],
                    "parcelle": test_case['parcelle']
                },
                timeout=120  # 2 minutes pour les appels RDPPF
            )
            
            duration = time.time() - start_time
            print(f"   ⏱️  Durée: {duration:.2f}s")
            
            if response.status_code == 200:
                data = response.json()
                
                # Affichage des résultats
                print(f"   ✅ Zone extraite: {data.get('zone_info', {}).get('zone_name', 'Non trouvée')}")
                
                if 'constraints' in data:
                    print(f"   📊 Contraintes trouvées: {len(data['constraints'])}")
                    
                    for constraint in data['constraints']:
                        indice = constraint.get('indice_utilisation_sol')
                        hauteur = constraint.get('hauteur_max_batiment')
                        source = constraint.get('source_info', 'Non spécifiée')
                        
                        print(f"      • Indice: {indice} (source: {source})")
                        print(f"      • Hauteur: {hauteur}")
                
                # Vérification des attentes
                if test_case['expected_zone']:
                    zone_found = data.get('zone_info', {}).get('zone_name', '')
                    if test_case['expected_zone'] in zone_found:
                        print(f"   ✅ Zone attendue trouvée")
                    else:
                        print(f"   ⚠️  Zone attendue '{test_case['expected_zone']}' vs trouvée '{zone_found}'")
                
                if test_case['expected_indice']:
                    indices_found = [c.get('indice_utilisation_sol') for c in data.get('constraints', [])]
                    if test_case['expected_indice'] in str(indices_found):
                        print(f"   ✅ Indice attendu trouvé")
                    else:
                        print(f"   ⚠️  Indice attendu '{test_case['expected_indice']}' vs trouvés {indices_found}")
                
                # Affichage des métadonnées de performance
                if 'metadata' in data:
                    meta = data['metadata']
                    print(f"   📈 Performance:")
                    print(f"      - Docs RAG trouvés: {meta.get('rag_documents_found', 0)}")
                    print(f"      - Stratégies utilisées: {meta.get('search_strategies_used', 0)}")
                    print(f"      - Extraction hybride: {meta.get('hybrid_extraction_used', False)}")
                
            else:
                print(f"   ❌ Erreur HTTP {response.status_code}")
                print(f"   📄 Réponse: {response.text}")
                
        except requests.exceptions.Timeout:
            print(f"   ⏰ Timeout après 2 minutes")
        except Exception as e:
            print(f"   ❌ Erreur: {e}")

def test_rag_direct():
    """Test direct du système RAG amélioré"""
    print("\n🔍 Test direct du système RAG...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/test-rag",
            json={
                "commune": "Lens",
                "query": "zone 18/3 villa indice utilisation"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Documents trouvés: {len(data.get('documents', []))}")
            
            for i, doc in enumerate(data.get('documents', [])[:3]):  # Affiche les 3 premiers
                print(f"   📄 Doc {i+1}: {doc.get('content', '')[:100]}...")
                print(f"      Métadonnées: {doc.get('metadata', {})}")
        else:
            print(f"   ❌ Erreur RAG: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Erreur test RAG: {e}")

def main():
    """Exécute tous les tests"""
    print("🚀 TESTS COMPLETS - URBAN-AI VALAIS AMÉLIORÉ")
    print("=" * 50)
    
    # Test de santé
    if not test_health():
        print("❌ L'API n'est pas accessible. Vérifiez que le serveur est lancé.")
        return
    
    # Test du système principal
    test_ia_constraints()
    
    # Test RAG direct
    test_rag_direct()
    
    print("\n" + "=" * 50)
    print("�� Tests terminés!")
    print("\n💡 Pour tester d'autres communes, ajoutez leurs règlements à ChromaDB d'abord !")

if __name__ == "__main__":
    main() 