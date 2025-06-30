"""
Script de debug pour comprendre les problèmes d'extraction
"""

import re
from llm import extract_numerical_values

def debug_pattern_matching():
    """Debug détaillé du matching des patterns."""
    print("🔬 DEBUG DÉTAILLÉ DES PATTERNS")
    print("=" * 50)
    
    # Test spécifique qui échoue
    test_passage = "L'indice d'utilisation du sol est de 0.30 pour cette zone."
    constraint_type = "indice d'utilisation"
    
    print(f"📝 Passage de test : {test_passage}")
    print(f"🔍 Type : {constraint_type}")
    print(f"📊 Texte en minuscules : {test_passage.lower()}")
    
    # Patterns pour indices d'utilisation
    patterns = [
        r'indice\s+(?:d\'?utilisation\s+)?(?:de\s+)?(?:du\s+sol\s+)?(?:est\s+de\s+)?(\d+[.,]\d+)',
        r'coefficient\s+(?:d\'?utilisation\s+)?(?:de\s+)?(?:du\s+sol\s+)?(?:est\s+de\s+)?(\d+[.,]\d+)',
        r'i\.u\.\s*[=:]\s*(\d+[.,]\d+)',
        r'iu\s*[=:]\s*(\d+[.,]\d+)',
        r'densité\s+(?:de\s+construction\s+)?(?:est\s+de\s+)?(?:autorisée?\s*:\s*)?(?:maximum\s+)?(\d+[.,]\d+)',
        r'taux\s+(?:d\'?occupation\s+)?(?:du\s+sol\s+)?(?:est\s+de\s+)?(?::\s*)?(\d+[.,]\d+)',
        r'(?:ne\s+peut\s+)?dépasser\s+(\d+[.,]\d+)',
        r'(?:maximum|max)\s+(\d+[.,]\d+)',
        r'(\d+[.,]\d+)\s+(?:autorisé|permis|maximum)',
        r'(\d+[.,]\d+)\s*(?:\(\d+\))?(?:\s+zone)?',
        r'zone.*?(\d+[.,]\d+)',
    ]
    
    print(f"\n🔍 Test de chaque pattern individuellement :")
    print("-" * 50)
    
    text = test_passage.lower()
    
    for i, pattern in enumerate(patterns, 1):
        print(f"\nPattern {i}: {pattern}")
        matches = list(re.finditer(pattern, text, re.IGNORECASE))
        print(f"Matches trouvés: {len(matches)}")
        
        for match in matches:
            value = match.group(1).replace(',', '.')
            print(f"  → Valeur extraite: '{value}'")
            print(f"  → Position: {match.start()}-{match.end()}")
            print(f"  → Texte complet: '{match.group(0)}'")
            
            try:
                float_val = float(value)
                if 0.1 <= float_val <= 3.0:
                    print(f"  ✅ Valide (entre 0.1 et 3.0)")
                else:
                    print(f"  ❌ Hors limites ({float_val})")
            except ValueError:
                print(f"  ❌ Pas un nombre valide")
    
    # Test avec la fonction complète
    print(f"\n🧪 Test avec extract_numerical_values() :")
    print("-" * 50)
    result = extract_numerical_values([test_passage], constraint_type)
    print(f"Résultat final: '{result}'")
    
    # Test avec d'autres passages problématiques
    print(f"\n🧪 Test avec autres passages problématiques :")
    print("-" * 50)
    
    problematic_passages = [
        "Le coefficient d'utilisation ne peut dépasser 0.45 dans cette zone.",
        "Densité de construction autorisée: maximum 0.35",
        "Taux d'occupation du sol: 0.25 maximum"
    ]
    
    for passage in problematic_passages:
        print(f"\nPassage: {passage}")
        result = extract_numerical_values([passage], "indice d'utilisation")
        print(f"Résultat: '{result}'")

def test_pattern_fix():
    """Test avec patterns corrigés."""
    print(f"\n\n🔧 TEST AVEC PATTERNS CORRIGÉS")
    print("=" * 50)
    
    def extract_numerical_values_fixed(passages, constraint_type):
        """Version corrigée avec debug."""
        if not passages:
            return "-"
        
        text = " ".join(passages).lower()
        print(f"📝 Texte à analyser: '{text}'")
        
        if "indice" in constraint_type.lower() or "utilisation" in constraint_type.lower():
            patterns = [
                # Patterns plus simples et directs
                r'(\d+[.,]\d+)',  # N'importe quel nombre décimal
            ]
            
            print(f"🔍 Recherche de nombres décimaux...")
            
            candidates = []
            
            for pattern in patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    value = match.group(1).replace(',', '.')
                    print(f"  Nombre trouvé: {value}")
                    try:
                        float_val = float(value)
                        if 0.1 <= float_val <= 3.0:
                            print(f"    ✅ Valide pour indice: {float_val}")
                            candidates.append((value, 100))
                        else:
                            print(f"    ❌ Hors limites pour indice: {float_val}")
                    except ValueError:
                        print(f"    ❌ Pas un nombre: {value}")
            
            if candidates:
                return candidates[0][0]
        
        return "-"
    
    # Test avec passages problématiques
    test_cases = [
        "L'indice d'utilisation du sol est de 0.30 pour cette zone.",
        "Le coefficient d'utilisation ne peut dépasser 0.45 dans cette zone.",
        "Densité de construction autorisée: maximum 0.35",
        "Taux d'occupation du sol: 0.25 maximum"
    ]
    
    for passage in test_cases:
        print(f"\n📝 Test: {passage}")
        result = extract_numerical_values_fixed([passage], "indice d'utilisation")
        print(f"🎯 Résultat: '{result}'")

if __name__ == "__main__":
    debug_pattern_matching()
    test_pattern_fix() 