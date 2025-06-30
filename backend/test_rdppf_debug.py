#!/usr/bin/env python3
"""
Test debug pour vérifier l'extraction RDPPF de Lens 5217
"""

from rdppf import fetch_rdppf
import json

def explore_dict(data, path="", max_depth=3, current_depth=0):
    """Explore récursivement une structure de données"""
    if current_depth > max_depth:
        return
    
    if isinstance(data, dict):
        for key, value in data.items():
            new_path = f"{path}.{key}" if path else key
            
            if isinstance(value, str) and len(value) < 200:
                if any(keyword in value.lower() for keyword in ['zone', 'villa', '18', '0.3', 'affectation']):
                    print(f"🎯 TROUVÉ: {new_path} = '{value}'")
            elif isinstance(value, (dict, list)) and current_depth < max_depth:
                if key in ['RestrictionOnLandownership', 'ConcernedTheme', 'LegendText', 'Text']:
                    print(f"📂 Exploration: {new_path} ({type(value).__name__})")
                explore_dict(value, new_path, max_depth, current_depth + 1)
    
    elif isinstance(data, list):
        for i, item in enumerate(data):
            new_path = f"{path}[{i}]"
            explore_dict(item, new_path, max_depth, current_depth + 1)

def test_rdppf_lens_5217():
    print("=== TEST RDPPF LENS 5217 - EXPLORATION COMPLETE ===")
    
    try:
        # Test avec la vraie parcelle connue
        data = fetch_rdppf('Lens', '5217')
        print("✅ RDPPF récupéré avec succès")
        print(f"Taille des données: {len(str(data))} caractères")
        
        # Exploration complète
        print("\n🔍 EXPLORATION COMPLÈTE DE LA STRUCTURE:")
        explore_dict(data)
        
        # Test spécifique de l'extraction avec notre fonction corrigée
        print("\n🧪 TEST DE L'EXTRACTION AVEC LA FONCTION CORRIGÉE:")
        zone_name = None
        zone_info = {}
        
        if 'Extract' in data:
            extract_data = data['Extract']
            
            # Méthode 1: Chercher dans RealEstate -> RestrictionOnLandownership
            real_estate = extract_data.get('RealEstate', {})
            restrictions = real_estate.get('RestrictionOnLandownership', [])
            
            print(f"📋 Nombre de restrictions: {len(restrictions)}")
            
            for i, restriction in enumerate(restrictions):
                print(f"\n--- Restriction {i+1} ---")
                
                # Chercher les restrictions avec 100% de couverture
                part = restriction.get('PartInPercent', restriction.get('Part', 0))
                print(f"Part: {part}")
                
                if part == 100 or (isinstance(part, str) and "100" in part):
                    legend_texts = restriction.get('LegendText', [])
                    print(f"LegendText trouvés: {len(legend_texts)}")
                    
                    for j, legend in enumerate(legend_texts):
                        lang = legend.get('Language', 'unknown')
                        text = legend.get('Text', '').strip()
                        print(f"  Legend {j+1} ({lang}): '{text}'")
                        
                        if legend.get('Language') == 'fr':
                            if any(keyword in text.lower() for keyword in ['zone', 'affectation', 'secteur']):
                                zone_name = text
                                zone_info = {
                                    "zone_name": zone_name,
                                    "source": "RDPPF",
                                    "restriction_data": restriction
                                }
                                print(f"🎯 ZONE TROUVÉE: '{zone_name}'")
                                break
                    if zone_name:
                        break
        
        if zone_name:
            # Test d'extraction d'indice
            from llm import extract_index_from_zone_name
            indice = extract_index_from_zone_name(zone_name)
            print(f"📊 Indice extrait: '{indice}'")
        else:
            print("❌ Aucune zone trouvée avec la méthode corrigée")
    
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_rdppf_lens_5217() 