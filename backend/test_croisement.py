#!/usr/bin/env python3
"""
Test du croisement amélioré RDPPF ↔ Règlement communal
Version avec extraction de valeurs numériques et stratégies multiples
"""

from rdppf import fetch_rdppf
from llm import extract_zone_from_rdppf, extract_rdppf_constraints, extract_rules
from report import generate_feasibility_report
import traceback

def test_croisement_ameliore():
    """Test du système amélioré avec nouvelles fonctions."""
    print("🚀 TEST DU SYSTÈME AMÉLIORÉ")
    print("=" * 60)
    
    commune = "Lens"
    parcelle = "5217"
    
    try:
        print(f"📍 Test pour {commune} parcelle {parcelle}")
        print("-" * 30)
        
        # Test de la nouvelle fonction complète
        print("📊 Génération du rapport avec les améliorations...")
        
        result = generate_feasibility_report(
            commune=commune,
            parcelle=parcelle,
            surface="1200"  # Surface exemple
        )
        
        if result["success"]:
            print("✅ Rapport généré avec succès !")
            
            # Afficher les métadonnées
            metadata = result["metadata"]
            print(f"\n📊 MÉTADONNÉES :")
            print(f"  • Commune : {metadata['commune']}")
            print(f"  • Parcelle : {metadata['parcelle']}")
            print(f"  • Surface : {metadata['surface']} m²")
            print(f"  • Zone : {result['zone']}")
            print(f"  • Thèmes RDPPF : {metadata['rdppf_themes']}")
            print(f"  • Règles trouvées : {metadata['rules_found']}")
            print(f"  • Timestamp : {metadata['timestamp']}")
            
            # Afficher les règles extraites
            rules = result["extracted_rules"]
            print(f"\n📋 RÈGLES EXTRAITES :")
            for key, value in rules.items():
                if key != "passages_generaux" and value != "-":
                    print(f"  • {key.replace('_', ' ').title()} : {value}")
            
            # Afficher un aperçu du contenu
            content = result["report_content"]
            lines = content.split('\n')
            print(f"\n📄 APERÇU DU RAPPORT :")
            for line in lines[:15]:  # Afficher les 15 premières lignes
                print(f"  {line}")
            
            print(f"\n💾 PDF généré : {result['pdf_filename']}")
            
            # Sauvegarder aussi en format texte pour débogage
            with open(f"test_ameliore_{commune}_{parcelle}.txt", "w", encoding="utf-8") as f:
                f.write(content)
            print(f"💾 Version texte sauvée : test_ameliore_{commune}_{parcelle}.txt")
            
            return True
            
        else:
            print(f"❌ Erreur : {result['error']}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur inattendue : {e}")
        traceback.print_exc()
        return False

def test_extraction_valeurs():
    """Test spécifique de l'extraction de valeurs numériques."""
    print("\n🔢 TEST D'EXTRACTION DE VALEURS NUMÉRIQUES")
    print("=" * 50)
    
    from llm import extract_numerical_values, extract_specific_rules
    
    # Tests avec différents types de passages
    test_cases = [
        {
            "passages": ["L'indice d'utilisation est de 0.30 pour cette zone"],
            "constraint_type": "indice d'utilisation",
            "expected": "0.30"
        },
        {
            "passages": ["La hauteur maximale est de 12 mètres"],
            "constraint_type": "hauteur",
            "expected": "12 m"
        },
        {
            "passages": ["Distance minimale de 5m à respecter"],
            "constraint_type": "distance",
            "expected": "5 m"
        },
        {
            "passages": ["1 place de parc par logement"],
            "constraint_type": "stationnement",
            "expected": "1"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📝 Test {i} : {test_case['constraint_type']}")
        
        value = extract_numerical_values(
            test_case["passages"], 
            test_case["constraint_type"]
        )
        
        print(f"  Passage : {test_case['passages'][0]}")
        print(f"  Valeur extraite : {value}")
        print(f"  Attendu : {test_case['expected']}")
        print(f"  Résultat : {'✅ OK' if value == test_case['expected'] else '❌ KO'}")

if __name__ == "__main__":
    print("🧪 TESTS DU SYSTÈME AMÉLIORÉ")
    print("=" * 60)
    
    # Test principal
    success = test_croisement_ameliore()
    
    # Test d'extraction de valeurs
    test_extraction_valeurs()
    
    print(f"\n{'✅ Tests terminés avec succès' if success else '❌ Échec des tests'}") 