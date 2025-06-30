"""
Test du croisement amélioré RDPPF ↔ Règlement communal
Version simplifiée sans génération PDF
"""

from rdppf import fetch_rdppf
from llm import extract_zone_from_rdppf, extract_rdppf_constraints, extract_rules
import traceback

def test_extraction_amelioree():
    """Test du système amélioré sans PDF."""
    print("🚀 TEST DU SYSTÈME AMÉLIORÉ (sans PDF)")
    print("=" * 60)
    
    commune = "Lens"
    parcelle = "5217"
    
    try:
        print(f"📍 Test pour {commune} parcelle {parcelle}")
        print("-" * 30)
        
        # 1. Récupération RDPPF
        print("📥 Récupération des données RDPPF...")
        rdppf_data = fetch_rdppf(commune, parcelle)
        print("✅ Données RDPPF récupérées")
        
        # 2. Extraction zone et contraintes
        print("\n🔍 Extraction de la zone...")
        zone = extract_zone_from_rdppf(rdppf_data)
        print(f"📍 Zone détectée : {zone}")
        
        print("\n📋 Extraction des contraintes RDPPF...")
        rdppf_constraints = extract_rdppf_constraints(rdppf_data)
        print(f"📌 Contraintes trouvées ({len(rdppf_constraints)}) :")
        for i, constraint in enumerate(rdppf_constraints, 1):
            print(f"  {i}. {constraint}")
        
        # 3. Extraction améliorée des règles
        print("\n📖 Extraction améliorée des règles...")
        rules = extract_rules(zone, rdppf_constraints, commune)
        
        # 4. Affichage des résultats
        print(f"\n📋 RÈGLES EXTRAITES AVEC VALEURS :")
        print("=" * 50)
        
        for key, value in rules.items():
            if key != "passages_generaux":
                label = key.replace('_', ' ').title()
                print(f"• {label:<20} : {value}")
        
        # 5. Affichage des passages trouvés
        if rules.get("passages_generaux"):
            print(f"\n📄 PASSAGES TROUVÉS ({len(rules['passages_generaux'])}) :")
            print("-" * 40)
            
            for i, passage in enumerate(rules["passages_generaux"][:3], 1):
                print(f"\n{i}. {passage[:200]}...")
        
        # 6. Simulation du rapport final
        print(f"\n📋 SIMULATION DU RAPPORT FINAL :")
        print("=" * 50)
        
        rdppf_summary = ", ".join([c.get('value', '') for c in rdppf_constraints if c.get('type') != 'zone'])
        
        rapport_simulation = f"""📋 ETUDE DE FAISABILITE
Parcelle à {commune.upper()}
==================================================
Commune : {commune.title()}
Surface : 1200 m²
Zone : {zone}

🎯 SYNTHÈSE RAPIDE
------------------------------
• Contraintes RDPPF : {rdppf_summary}

📖 REGLEMENT COMMUNAL
----------------------------------------
Indice d'utilisation : {rules.get('indice_utilisation', '-')}
Distance minimale : {rules.get('distance_minimale', '-')}
Hauteur maximale : {rules.get('hauteur_maximale', '-')}
Surface minimale : {rules.get('surface_minimale', '-')}
Toiture : {rules.get('toiture', '-')}
Places de parc : {rules.get('places_parc', '-')}
Remarques : {rules.get('remarques', '-')}

Fait à Sion, le 30 juin 2025
"""
        
        print(rapport_simulation)
        
        # 7. Sauvegarder le rapport texte
        with open(f"test_ameliore_{commune}_{parcelle}.txt", "w", encoding="utf-8") as f:
            f.write(rapport_simulation)
        print(f"\n💾 Rapport sauvé : test_ameliore_{commune}_{parcelle}.txt")
        
        # 8. Métriques de performance
        print(f"\n📊 MÉTRIQUES DE PERFORMANCE :")
        print("-" * 30)
        
        rules_found = sum(1 for v in rules.values() if v != "-" and v != [])
        print(f"• Règles avec valeurs : {rules_found}/6")
        print(f"• Passages trouvés : {len(rules.get('passages_generaux', []))}")
        print(f"• Contraintes RDPPF : {len(rdppf_constraints)}")
        
        success_rate = (rules_found / 6) * 100
        print(f"• Taux de succès : {success_rate:.1f}%")
        
        return True
        
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
        },
        {
            "passages": ["Surface minimale de 800 m² requise"],
            "constraint_type": "surface",
            "expected": "800 m²"
        }
    ]
    
    success_count = 0
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📝 Test {i} : {test_case['constraint_type']}")
        
        value = extract_numerical_values(
            test_case["passages"], 
            test_case["constraint_type"]
        )
        
        print(f"  Passage : {test_case['passages'][0]}")
        print(f"  Valeur extraite : {value}")
        print(f"  Attendu : {test_case['expected']}")
        
        is_success = value == test_case['expected']
        print(f"  Résultat : {'✅ OK' if is_success else '❌ KO'}")
        
        if is_success:
            success_count += 1
    
    print(f"\n📊 Résultat des tests : {success_count}/{len(test_cases)} ({(success_count/len(test_cases)*100):.1f}%)")

if __name__ == "__main__":
    print("🧪 TESTS DU SYSTÈME AMÉLIORÉ (VERSION SIMPLIFIÉE)")
    print("=" * 60)
    
    # Test principal
    success = test_extraction_amelioree()
    
    # Test d'extraction de valeurs
    test_extraction_valeurs()
    
    print(f"\n{'🎉 Tests terminés avec succès !' if success else '❌ Échec des tests'}")
    print("=" * 60) 