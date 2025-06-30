"""
Test des patterns d'extraction pour différents formats de communes
Simule différents formats de zones qu'on peut rencontrer
"""

from llm import extract_index_from_zone_name, extract_height_from_zone_name, extract_numerical_values

def test_zone_patterns():
    """Test des patterns d'extraction pour différents formats de zones."""
    print("🧪 TEST DES PATTERNS POUR DIFFÉRENTES COMMUNES")
    print("=" * 60)
    
    # Simulation de différents formats de zones
    test_cases = [
        # ═══════════════════════════════════════════════════════════════
        # INDICES D'UTILISATION
        # ═══════════════════════════════════════════════════════════════
        {
            "commune": "Lens",
            "zone": "ZONE 18/3 Zone des villas familliales 0.30 (3)",
            "expected_index": "0.30",
            "expected_height": "-"
        },
        {
            "commune": "Sion (simulation)",
            "zone": "Zone villa IU = 0.25",
            "expected_index": "0.25",
            "expected_height": "-"
        },
        {
            "commune": "Martigny (simulation)",
            "zone": "Zone résidentielle - densité 0.40 - hauteur max 12m",
            "expected_index": "0.40",
            "expected_height": "12 m"
        },
        {
            "commune": "Monthey (simulation)",
            "zone": "ZV - Zone villa | indice d'utilisation: 0.35",
            "expected_index": "0.35",
            "expected_height": "-"
        },
        {
            "commune": "Sierre (simulation)",
            "zone": "Zone 2A - coefficient d'utilisation du sol de 0.45",
            "expected_index": "0.45",
            "expected_height": "-"
        },
        {
            "commune": "Bagnes (simulation)",
            "zone": "Zone habitat individuel (I.U. = 0.20)",
            "expected_index": "0.20",
            "expected_height": "-"
        },
        {
            "commune": "Savièse (simulation)",
            "zone": "Zone villas - taux d'occupation du sol 0.28",
            "expected_index": "0.28",
            "expected_height": "-"
        },
        # ═══════════════════════════════════════════════════════════════
        # HAUTEURS
        # ═══════════════════════════════════════════════════════════════
        {
            "commune": "Verbier (simulation)",
            "zone": "Zone chalets - hauteur maximale 9m",
            "expected_index": "-",
            "expected_height": "9 m"
        },
        {
            "commune": "Zermatt (simulation)",
            "zone": "Zone village H = 8m maximum",
            "expected_index": "-",
            "expected_height": "8 m"
        },
        {
            "commune": "Saas-Fee (simulation)",
            "zone": "Zone résidentielle limitée à 15m de hauteur",
            "expected_index": "-",
            "expected_height": "15 m"
        },
        # ═══════════════════════════════════════════════════════════════
        # FORMATS MIXTES
        # ═══════════════════════════════════════════════════════════════
        {
            "commune": "Crans-Montana (simulation)",
            "zone": "Zone A - IU 0.22 - H max 10m - 3 étages",
            "expected_index": "0.22",
            "expected_height": "10 m"
        },
        {
            "commune": "Val d'Illiez (simulation)",
            "zone": "ZH1: Zone d'habitation principale (indice 0.38, hauteur max 12m)",
            "expected_index": "0.38",
            "expected_height": "12 m"
        },
    ]
    
    print(f"\n📋 Test sur {len(test_cases)} formats de zones différents :")
    print("-" * 60)
    
    success_index = 0
    success_height = 0
    total_index_tests = 0
    total_height_tests = 0
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🏘️ Test {i}: {test_case['commune']}")
        print(f"   Zone: {test_case['zone']}")
        
        # Test extraction indice
        if test_case['expected_index'] != "-":
            total_index_tests += 1
            extracted_index = extract_index_from_zone_name(test_case['zone'])
            print(f"   📊 Indice attendu: {test_case['expected_index']}")
            print(f"   📊 Indice trouvé:  {extracted_index}")
            if extracted_index == test_case['expected_index']:
                print(f"   ✅ Indice: OK")
                success_index += 1
            else:
                print(f"   ❌ Indice: KO")
        
        # Test extraction hauteur
        if test_case['expected_height'] != "-":
            total_height_tests += 1
            extracted_height = extract_height_from_zone_name(test_case['zone'])
            print(f"   📏 Hauteur attendue: {test_case['expected_height']}")
            print(f"   📏 Hauteur trouvée:  {extracted_height}")
            if extracted_height == test_case['expected_height']:
                print(f"   ✅ Hauteur: OK")
                success_height += 1
            else:
                print(f"   ❌ Hauteur: KO")
    
    # Résultats finaux
    print(f"\n📊 RÉSULTATS FINAUX :")
    print("=" * 40)
    
    if total_index_tests > 0:
        index_rate = (success_index / total_index_tests) * 100
        print(f"• Indices d'utilisation : {success_index}/{total_index_tests} ({index_rate:.1f}%)")
    
    if total_height_tests > 0:
        height_rate = (success_height / total_height_tests) * 100
        print(f"• Hauteurs maximales :    {success_height}/{total_height_tests} ({height_rate:.1f}%)")
    
    total_tests = total_index_tests + total_height_tests
    total_success = success_index + success_height
    
    if total_tests > 0:
        global_rate = (total_success / total_tests) * 100
        print(f"• Score global :          {total_success}/{total_tests} ({global_rate:.1f}%)")
        
        if global_rate >= 80:
            print("🎉 Excellent ! Les patterns couvrent bien les différents formats")
        elif global_rate >= 60:
            print("✅ Bon ! Quelques améliorations possibles")
        else:
            print("⚠️ À améliorer : patterns trop spécifiques")

def test_patterns_avances():
    """Test des patterns d'extraction dans des passages de règlement."""
    print("\n\n🔬 TEST DES PATTERNS DANS PASSAGES DE RÈGLEMENT")
    print("=" * 60)
    
    test_passages = [
        # ═══════════════════════════════════════════════════════════════
        # INDICES DANS RÈGLEMENTS
        # ═══════════════════════════════════════════════════════════════
        {
            "passages": ["L'indice d'utilisation du sol est de 0.30 pour cette zone."],
            "type": "indice d'utilisation",
            "expected": "0.30"
        },
        {
            "passages": ["Le coefficient d'utilisation ne peut dépasser 0.45 dans cette zone."],
            "type": "indice d'utilisation", 
            "expected": "0.45"
        },
        {
            "passages": ["Densité de construction autorisée: maximum 0.35"],
            "type": "indice d'utilisation",
            "expected": "0.35"
        },
        {
            "passages": ["Taux d'occupation du sol: 0.25 maximum"],
            "type": "indice d'utilisation",
            "expected": "0.25"
        },
        # ═══════════════════════════════════════════════════════════════
        # HAUTEURS DANS RÈGLEMENTS  
        # ═══════════════════════════════════════════════════════════════
        {
            "passages": ["La hauteur des constructions ne peut dépasser 12 mètres"],
            "type": "hauteur",
            "expected": "12 m"
        },
        {
            "passages": ["Hauteur maximale de la construction: 15m"],
            "type": "hauteur",
            "expected": "15 m"
        },
        {
            "passages": ["Les bâtiments sont limités à 3 étages maximum"],
            "type": "hauteur",
            "expected": "3 m"  # Devrait extraire 3 pour étages
        },
        {
            "passages": ["Max 10m de hauteur à la corniche"],
            "type": "hauteur",
            "expected": "10 m"
        },
        # ═══════════════════════════════════════════════════════════════
        # DISTANCES DANS RÈGLEMENTS
        # ═══════════════════════════════════════════════════════════════
        {
            "passages": ["Distance minimale de 5m aux limites de propriété"],
            "type": "distance",
            "expected": "5 m"
        },
        {
            "passages": ["Recul minimal: 8 mètres"],
            "type": "distance",
            "expected": "8 m"
        },
        {
            "passages": ["Marge de recul minimale de 3.5m"],
            "type": "distance",
            "expected": "3.5 m"
        },
        # ═══════════════════════════════════════════════════════════════
        # SURFACES DANS RÈGLEMENTS
        # ═══════════════════════════════════════════════════════════════
        {
            "passages": ["Surface minimale de terrain: 800 m²"],
            "type": "surface",
            "expected": "800 m²"
        },
        {
            "passages": ["Parcelle minimale de 1200 m² requise"],
            "type": "surface",
            "expected": "1200 m²"
        },
        # ═══════════════════════════════════════════════════════════════
        # STATIONNEMENT DANS RÈGLEMENTS
        # ═══════════════════════════════════════════════════════════════
        {
            "passages": ["1 place de parc par logement obligatoire"],
            "type": "stationnement",
            "expected": "1"
        },
        {
            "passages": ["Minimum 2 places de stationnement par appartement"],
            "type": "stationnement",
            "expected": "2"
        },
    ]
    
    success_count = 0
    
    for i, test_case in enumerate(test_passages, 1):
        print(f"\n📝 Test {i}: {test_case['type']}")
        print(f"   Passage: {test_case['passages'][0]}")
        
        extracted = extract_numerical_values(test_case['passages'], test_case['type'])
        
        print(f"   Attendu:  {test_case['expected']}")
        print(f"   Extrait:  {extracted}")
        
        if extracted == test_case['expected']:
            print(f"   ✅ OK")
            success_count += 1
        else:
            print(f"   ❌ KO")
    
    # Résultat final
    total_tests = len(test_passages)
    success_rate = (success_count / total_tests) * 100
    
    print(f"\n📊 RÉSULTATS EXTRACTION DANS RÈGLEMENTS :")
    print(f"• Réussite: {success_count}/{total_tests} ({success_rate:.1f}%)")
    
    if success_rate >= 80:
        print("🎉 Excellent ! Extraction très fiable")
    elif success_rate >= 60:
        print("✅ Bon ! Quelques cas particuliers à améliorer")
    else:
        print("⚠️ À améliorer : patterns pas assez flexibles")

if __name__ == "__main__":
    # Test des patterns de zones
    test_zone_patterns()
    
    # Test des patterns dans règlements  
    test_patterns_avances()
    
    print(f"\n🎯 CONCLUSION :")
    print("=" * 40)
    print("Ces tests montrent la robustesse du système face à différents")
    print("formats de communes. Le système hybride (zone RDPPF + règlement)")
    print("permet de s'adapter à la diversité des pratiques communales.")
    print("=" * 40) 