import os, openai, textwrap, re
from rag import search
from typing import List

openai.api_key = os.getenv("OPENAI_API_KEY")

def _clean(text):
    return re.sub(r"\s+", " ", text).strip()

def _num(val):
    m = re.search(r"(\d+[.,]?\d*)", val)
    return float(m.group(1).replace(",", ".")) if m else None

def extract_zone_from_rdppf(rdppf_data: dict) -> str:
    """
    Extrait la zone d'affectation principale depuis le JSON RDPPF.
    Version améliorée avec plus de patterns de détection.
    """
    try:
        # Méthode 1: Chercher dans les restrictions avec 100% de couverture
        restrictions = rdppf_data.get("Extract", {}).get("RealEstate", {}).get("RestrictionOnLandownership", [])
        
        for restriction in restrictions:
            part = restriction.get("PartInPercent")
            if part is None:
                part = restriction.get("Part")
                if isinstance(part, str) and "100" in part:
                    part = 100
            
            if part == 100:
                legend_texts = restriction.get("LegendText", [])
                for legend in legend_texts:
                    if legend.get("Language") == "fr":
                        text = legend.get("Text", "").strip()
                        # Patterns améliorés pour détecter les zones
                        if any(pattern in text.lower() for pattern in ["zone", "affectation", "secteur"]):
                            return text
        
        # Méthode 2: Chercher dans les thèmes concernés
        themes = rdppf_data.get("Extract", {}).get("ConcernedTheme", [])
        for theme in themes:
            for t in theme.get("Text", []):
                if t.get("Language") == "fr":
                    text = t.get("Text", "").strip()
                    if any(pattern in text.lower() for pattern in ["zone", "affectation", "secteur", "plan"]):
                        return text
        
        # Méthode 3: Chercher dans les descriptions générales
        if themes:
            for theme in themes:
                for t in theme.get("Text", []):
                    if t.get("Language") == "fr":
                        return t.get("Text", "").strip()
        
        # Méthode 4: Chercher dans les informations de base
        real_estate = rdppf_data.get("Extract", {}).get("RealEstate", {})
        if real_estate:
            # Chercher dans les descriptions de la parcelle
            descriptions = real_estate.get("Description", [])
            for desc in descriptions:
                if desc.get("Language") == "fr":
                    text = desc.get("Text", "").strip()
                    if any(pattern in text.lower() for pattern in ["zone", "affectation"]):
                        return text
        
    except Exception as e:
        print(f"Erreur lors de l'extraction de zone: {e}")
    
    return "(zone inconnue)"

def extract_rules(zone: str, rdppf_constraints: List[dict], commune: str) -> dict:
    """
    Version améliorée avec stratégie hybride : extraction depuis zone RDPPF + recherche dans règlement.
    """
    from rag import search_with_multiple_strategies
    
    print(f"🔍 Recherche de règles pour zone: {zone}")
    print(f"[CONSTRAINTS] RDPPF: {len(rdppf_constraints)} trouvées")
    
    # Structure pour stocker les résultats
    extracted_rules = {
        "indice_utilisation": "-",
        "distance_minimale": "-", 
        "hauteur_maximale": "-",
        "surface_minimale": "-",
        "toiture": "-",
        "places_parc": "-",
        "remarques": "-",
        "passages_generaux": []
    }
    
    # ═══════════════════════════════════════════════════════════════
    # ÉTAPE 1 : Extraction directe depuis la zone RDPPF
    # ═══════════════════════════════════════════════════════════════
    print(f"[ETAPE 1] Extraction directe depuis la zone RDPPF")
    
    # Essayer d'extraire l'indice d'utilisation
    index_from_zone = extract_index_from_zone_name(zone)
    if index_from_zone != "-":
        extracted_rules["indice_utilisation"] = index_from_zone
        print(f"  ✅ Indice trouvé: {index_from_zone}")
    
    # Essayer d'extraire la hauteur
    height_from_zone = extract_height_from_zone_name(zone)
    if height_from_zone != "-":
        extracted_rules["hauteur_maximale"] = height_from_zone
        print(f"  ✅ Hauteur trouvée: {height_from_zone}")
    
    # ═══════════════════════════════════════════════════════════════
    # ÉTAPE 2 : Recherche dans le règlement pour compléter
    # ═══════════════════════════════════════════════════════════════
    print(f"\n📖 ÉTAPE 2 : Recherche dans le règlement communal")
    
    # Types de contraintes à rechercher (seulement celles pas encore trouvées)
    constraint_types = [
        ("indice d'utilisation", "indice_utilisation"),
        ("distance minimale", "distance_minimale"),
        ("hauteur maximale", "hauteur_maximale"), 
        ("surface minimale", "surface_minimale"),
        ("toiture", "toiture"),
        ("places de parc", "places_parc"),
        ("stationnement", "places_parc")
    ]
    
    # Rechercher chaque type de contrainte (seulement si pas déjà trouvé)
    for search_term, field_name in constraint_types:
        # Skip si déjà trouvé dans la zone RDPPF
        if extracted_rules[field_name] != "-":
            print(f"  ⏭️ {search_term}: déjà trouvé dans la zone RDPPF")
            continue
            
        print(f"  🔎 Recherche pour: {search_term}")
        
        try:
            # Utiliser les stratégies multiples
            passages = search_with_multiple_strategies(
                commune=commune,
                zone=zone,
                constraint_type=search_term,
                limit=3
            )
            
            if passages:
                print(f"    OK {len(passages)} passages trouvés")
                
                # Extraire la règle spécifique
                rule = extract_specific_rules(zone, search_term, passages)
                if rule != "-":
                    extracted_rules[field_name] = rule
                    print(f"    📝 Valeur extraite: {rule}")
                
                # Ajouter aux passages généraux si pertinent
                for passage in passages[:1]:  # Garder le meilleur passage
                    if len(passage) > 50 and passage not in extracted_rules["passages_generaux"]:
                        extracted_rules["passages_generaux"].append(passage)
            else:
                print(f"    ATTENTION Aucun passage trouvé")
                
        except Exception as e:
            print(f"    ⚠️ Erreur lors de la recherche '{search_term}': {e}")
    
    # ═══════════════════════════════════════════════════════════════
    # ÉTAPE 3 : Recherche générale pour enrichir les remarques
    # ═══════════════════════════════════════════════════════════════
    print(f"\n📄 ÉTAPE 3 : Recherche générale pour remarques")
    try:
        general_passages = search_with_multiple_strategies(
            commune=commune,
            zone=zone,
            constraint_type="général",
            limit=3
        )
        
        for passage in general_passages:
            if len(passage) > 50 and passage not in extracted_rules["passages_generaux"]:
                extracted_rules["passages_generaux"].append(passage)
                
    except Exception as e:
        print(f"    ⚠️ Erreur lors de la recherche générale: {e}")
    
    # Créer les remarques à partir des passages
    if extracted_rules["passages_generaux"]:
        # Prendre les 3 meilleurs passages pour les remarques
        remarques = []
        for passage in extracted_rules["passages_generaux"][:3]:
            # Nettoyer et raccourcir le passage
            clean_passage = passage.strip()
            if len(clean_passage) > 150:
                clean_passage = clean_passage[:147] + "..."
            remarques.append(clean_passage)
        
        extracted_rules["remarques"] = " | ".join(remarques)
    
    # ═══════════════════════════════════════════════════════════════
    # RÉSUMÉ FINAL
    # ═══════════════════════════════════════════════════════════════
    print(f"\n📋 RÉSUMÉ DES RÈGLES EXTRAITES :")
    print("-" * 50)
    
    zone_found = 0
    reglement_found = 0
    
    for key, value in extracted_rules.items():
        if key != "passages_generaux" and value != "-":
            source = "🏗️ Zone RDPPF" if key in ["indice_utilisation", "hauteur_maximale"] and (
                extract_index_from_zone_name(zone) != "-" or extract_height_from_zone_name(zone) != "-"
            ) else "📖 Règlement"
            
            if "Zone RDPPF" in source:
                zone_found += 1
            else:
                reglement_found += 1
                
            print(f"  • {key.replace('_', ' ').title():<20} : {value} {source}")
    
    print(f"\n📊 Sources: {zone_found} depuis zone RDPPF, {reglement_found} depuis règlement")
    
    return extracted_rules

def extract_rdppf_constraints(rdppf_data: dict) -> list:
    """
    Extrait les contraintes principales du RDPPF pour les croiser avec le règlement.
    Retourne une liste de dictionnaires avec type et valeur.
    """
    constraints = []
    
    try:
        # Extraire les thèmes concernés
        themes = rdppf_data.get("Extract", {}).get("ConcernedTheme", [])
        for theme in themes:
            for t in theme.get("Text", []):
                if t.get("Language") == "fr":
                    text = t.get("Text", "").strip()
                    if text:
                        constraints.append({
                            'type': 'thème',
                            'value': text,
                            'source': 'ConcernedTheme'
                        })
        
        # Extraire les restrictions spécifiques
        restrictions = rdppf_data.get("Extract", {}).get("RealEstate", {}).get("RestrictionOnLandownership", [])
        for restriction in restrictions:
            legend_texts = restriction.get("LegendText", [])
            for legend in legend_texts:
                if legend.get("Language") == "fr":
                    text = legend.get("Text", "").strip()
                    if text:
                        # Détecter le type de contrainte
                        constraint_type = 'général'
                        if any(word in text.lower() for word in ['indice', 'utilisation', 'densité']):
                            constraint_type = 'indice d\'utilisation'
                        elif any(word in text.lower() for word in ['distance', 'recul', 'limite']):
                            constraint_type = 'distance'
                        elif any(word in text.lower() for word in ['hauteur', 'mètre', 'étage']):
                            constraint_type = 'hauteur'
                        elif any(word in text.lower() for word in ['surface', 'superficie', 'terrain']):
                            constraint_type = 'surface'
                        elif any(word in text.lower() for word in ['zone', 'affectation']):
                            constraint_type = 'zone'
                        
                        constraints.append({
                            'type': constraint_type,
                            'value': text,
                            'source': 'RestrictionOnLandownership'
                        })
        
        # Extraire les informations de la parcelle
        real_estate = rdppf_data.get("Extract", {}).get("RealEstate", {})
        if real_estate:
            descriptions = real_estate.get("Description", [])
            for desc in descriptions:
                if desc.get("Language") == "fr":
                    text = desc.get("Text", "").strip()
                    if text:
                        constraints.append({
                            'type': 'description',
                            'value': text,
                            'source': 'RealEstate'
                        })
    
    except Exception as e:
        print(f"Erreur lors de l'extraction des contraintes RDPPF: {e}")
    
    return constraints

def build_prompt(commune: str, rdppf_json: dict, rules: dict) -> str:
    themes = ", ".join(
        t["Text"][0]["Text"] for t in rdppf_json["Extract"]["ConcernedTheme"]
    ) or "Aucune contrainte RDPPF détectée"
    return textwrap.dedent(f"""
        Tu es urbaniste-conseil. Contraintes RDPPF : {themes}.
        Valeurs extraites du règlement de {commune} : {rules}.

        Rédige un résumé concis (max 1 500 car.) :
        - Zone et affectation
        - Indices U / IBUS
        - Distances aux limites
        - Hauteur max à pans et toit plat
        - Toitures admises
        - Places de parc
        Termine par un tableau Possible / Interdit / Sous condition.
    """)

def generate_report(commune: str, rdppf_data: dict, rules: dict) -> str:
    """
    Génère un rapport textuel croisant les données RDPPF et les règles du règlement communal.
    Version améliorée avec croisement intelligent et synthèse formatée.
    """
    rapport = []
    
    # ===== EN-TÊTE =====
    rapport.append(f"📋 ETUDE DE FAISABILITE")
    rapport.append(f"Parcelle à {commune.upper()}")
    rapport.append("=" * 50)
    
    # ===== INFOS PARCELLE =====
    surface = rdppf_data.get('Extract', {}).get('RealEstate', {}).get('Area', '-')
    zone = rules.get('zone', '(zone inconnue)')
    rapport.append(f"Commune : {commune}")
    rapport.append(f"Surface : {surface} m2")
    rapport.append(f"Zone : {zone}")
    rapport.append("")
    
    # ===== SYNTHÈSE RAPIDE =====
    rapport.append("🎯 SYNTHÈSE RAPIDE")
    rapport.append("-" * 30)
    
    # Contraintes RDPPF
    rdppf_constraints = rules.get('rdppf_constraints', [])
    if rdppf_constraints:
        rapport.append(f"• Contraintes RDPPF : {', '.join(c['value'] for c in rdppf_constraints[:3])}")
    else:
        rapport.append("• Contraintes RDPPF : Aucune contrainte spécifique détectée")
    
    # ===== REGLEMENT COMMUNAL =====
    rapport.append("\n📖 REGLEMENT COMMUNAL")
    rapport.append("-" * 40)
    
    # Points clés (format tableau)
    def get_rule(constraint_type):
        d = rules.get('rules_by_constraint', {}).get(constraint_type, {})
        passages = d.get('reglement_passages', [])
        return passages[0] if passages else '-'
    
    rapport.append(f"Indice d'utilisation : {get_rule('indice d\'utilisation')}")
    rapport.append(f"Distance minimale : {get_rule('distance')}")
    rapport.append(f"Hauteur maximale : {get_rule('hauteur')}")
    rapport.append(f"Surface minimale : {get_rule('surface')}")
    rapport.append(f"Toiture : {get_rule('toiture')}")
    rapport.append(f"Remarques : {get_rule('remarque')}")
    
    # Places de parc
    rapport.append("\nPlaces de parc :")
    rapport.append(get_rule('places de parc'))
    
    # Remarques générales
    if rules.get('general_rules'):
        rapport.append("\nRemarques générales :")
        for r in rules['general_rules']:
            rapport.append(f"- {r}")
    
    rapport.append("\nFait à Sion, le 25 juin 2025")
    
    return "\n".join(rapport)

def find_matching_rules(constraint: str, rules_data: dict) -> list:
    """
    Trouve les règles qui correspondent à une contrainte RDPPF donnée.
    """
    matching_rules = []
    constraint_lower = constraint.lower()
    
    # Mots-clés pour faire correspondre les contraintes aux règles
    keywords_mapping = {
        "périmètre": ["périmètre", "protection", "zone"],
        "inondation": ["inondation", "risque", "eau"],
        "pente": ["pente", "terrain", "dénivelé"],
        "protection": ["protection", "périmètre", "zone"],
        "zone": ["zone", "affectation", "secteur"],
        "plan": ["plan", "affectation", "zone"]
    }
    
    # Chercher les mots-clés correspondants
    relevant_keywords = []
    for key, keywords in keywords_mapping.items():
        if key in constraint_lower:
            relevant_keywords.extend(keywords)
    
    # Si pas de mots-clés spécifiques, utiliser des mots génériques
    if not relevant_keywords:
        relevant_keywords = constraint_lower.split()
    
    # Chercher dans les règles
    for theme, passages in rules_data.items():
        theme_lower = theme.lower()
        for passage in passages:
            passage_lower = passage.lower()
            
            # Vérifier si le thème ou le passage contient des mots-clés pertinents
            if any(keyword in theme_lower or keyword in passage_lower for keyword in relevant_keywords):
                matching_rules.append(passage)
    
    return matching_rules[:3]  # Limiter à 3 règles max

def extract_numerical_values(passages: List[str], constraint_type: str) -> str:
    """
    Extrait les valeurs numériques spécifiques des passages selon le type de contrainte.
    Version améliorée avec patterns plus flexibles pour différentes communes.
    
    Args:
        passages: Liste des passages trouvés
        constraint_type: Type de contrainte recherchée
    
    Returns:
        Valeur numérique extraite ou "-" si non trouvée
    """
    if not passages:
        return "-"
    
    # Joindre tous les passages
    text = " ".join(passages).lower()
    
    # Patterns selon le type de contrainte - VERSION ÉTENDUE
    if "indice" in constraint_type.lower() or "utilisation" in constraint_type.lower():
        # Rechercher indices d'utilisation (plus de variantes + meilleur scoring)
        patterns = [
            # Patterns les plus spécifiques en premier (score maximum)
            r'indice\s+(?:d\'?utilisation\s+)?(?:de\s+)?(?:du\s+sol\s+)?(?:est\s+de\s+)?(\d+[.,]\d+)',
            r'coefficient\s+(?:d\'?utilisation\s+)?(?:de\s+)?(?:du\s+sol\s+)?(?:est\s+de\s+)?(\d+[.,]\d+)',
            r'i\.u\.\s*[=:]\s*(\d+[.,]\d+)',  # I.U. = 0.30
            r'iu\s*[=:]\s*(\d+[.,]\d+)',  # IU = 0.30
            
            # Patterns avec contexte
            r'densité\s+(?:de\s+construction\s+)?(?:est\s+de\s+)?(?:autorisée?\s*:\s*)?(?:maximum\s+)?(\d+[.,]\d+)',
            r'taux\s+(?:d\'?occupation\s+)?(?:du\s+sol\s+)?(?:est\s+de\s+)?(?::\s*)?(\d+[.,]\d+)',
            r'emprise\s+(?:au\s+sol\s+)?(?:maximale?\s+)?(?:de\s+)?(?::\s*)?(\d+[.,]\d+)',
            
            # Patterns avec verbes
            r'(?:ne\s+peut\s+)?dépasser\s+(\d+[.,]\d+)',
            r'(?:maximum|max)\s+(\d+[.,]\d+)',  # maximum 0.30
            r'(\d+[.,]\d+)\s+(?:autorisé|permis|maximum)',  # 0.30 autorisé
            
            # Pattern général avec validation forte
            r'(\d+[.,]\d+)\s*(?:\(\d+\))?(?:\s+zone)?',  # Pattern général 0.30 (3)
            r'zone.*?(\d+[.,]\d+)',
        ]
        
    elif "hauteur" in constraint_type.lower():
        # Rechercher hauteurs en mètres (plus de variantes)
        patterns = [
            r'hauteur\s+(?:maximale?\s+)?(?:de\s+)?(?:la\s+construction\s+)?(?:est\s+de\s+)?(\d+(?:[.,]\d+)?)\s*m',
            r'(?:hauteur\s+)?(?:max|maximum)\s+(\d+(?:[.,]\d+)?)\s*m(?:ètres?)?',
            r'(\d+(?:[.,]\d+)?)\s*m(?:ètres?)?\s+(?:de\s+)?hauteur',
            r'hauteur.*?(\d+(?:[.,]\d+)?)\s*m',
            r'(\d+(?:[.,]\d+)?)\s*étages?(?:\s+maximum)?',
            r'(?:ne\s+(?:peut|doit)\s+(?:pas\s+)?dépasser\s+)?(\d+(?:[.,]\d+)?)\s*m',
            r'h\s*[=:]\s*(\d+(?:[.,]\d+)?)',  # H = 12
            r'hauteur\s+(?:à\s+)?(?:la\s+)?corniche\s+(\d+(?:[.,]\d+)?)',
            r'(?:limité|limitée)\s+à\s+(\d+(?:[.,]\d+)?)\s*m',
        ]
        
    elif "distance" in constraint_type.lower() or "recul" in constraint_type.lower():
        # Rechercher distances en mètres (plus de variantes)
        patterns = [
            r'distance\s+(?:minimale?\s+)?(?:de\s+)?(?:recul\s+)?(?:est\s+de\s+)?(\d+(?:[.,]\d+)?)\s*m',
            r'recul\s+(?:minimal\s+)?(?:de\s+)?(\d+(?:[.,]\d+)?)\s*m',
            r'marge\s+(?:de\s+recul\s+)?(?:minimale?\s+)?(?:de\s+)?(\d+(?:[.,]\d+)?)\s*m',
            r'(\d+(?:[.,]\d+)?)\s*m(?:ètres?)?\s+(?:de\s+)?(?:distance|recul|marge)',
            r'(?:minimum|min)\s+(\d+(?:[.,]\d+)?)\s*m',
            r'(?:au\s+moins|minimum)\s+(\d+(?:[.,]\d+)?)\s*m',
            r'd\s*[=:]\s*(\d+(?:[.,]\d+)?)',  # D = 5
            r'espacement\s+(?:minimal\s+)?(?:de\s+)?(\d+(?:[.,]\d+)?)\s*m',
        ]
        
    elif "surface" in constraint_type.lower() or "terrain" in constraint_type.lower():
        # Rechercher surfaces en m² (plus de variantes)
        patterns = [
            r'surface\s+(?:minimale?\s+)?(?:de\s+)?(?:terrain\s+)?(?:est\s+de\s+)?(\d+(?:\s?\d{3})*)\s*m[²2]',
            r'superficie\s+(?:minimale?\s+)?(?:de\s+)?(?:terrain\s+)?(?:est\s+de\s+)?(\d+(?:\s?\d{3})*)\s*m[²2]',
            r'terrain\s+(?:de\s+)?(?:minimum\s+)?(\d+(?:\s?\d{3})*)\s*m[²2]',
            r'(\d+(?:\s?\d{3})*)\s*m[²2]\s+(?:de\s+)?(?:surface|terrain|minimum)',
            r'parcelle\s+(?:minimale?\s+)?(?:de\s+)?(\d+(?:\s?\d{3})*)\s*m[²2]',
            r'(?:minimum|min)\s+(\d+(?:\s?\d{3})*)\s*m[²2]',
            r's\s*[=:]\s*(\d+(?:\s?\d{3})*)',  # S = 800
        ]
        
    elif "stationnement" in constraint_type.lower() or "parking" in constraint_type.lower():
        # Rechercher nombre de places (plus de variantes)
        patterns = [
            r'(\d+)\s+places?\s+(?:de\s+)?(?:parc|stationnement)(?:\s+(?:par|pour)\s+logement)?',
            r'places?\s+(?:de\s+)?(?:parc|stationnement)\s*[=:]\s*(\d+)',
            r'(\d+)\s+places?\s+(?:par|pour)\s+(?:logement|unité|appartement)',
            r'(?:minimum|min)\s+(\d+)\s+places?',
            r'stationnement\s*[=:]\s*(\d+)',
            r'parking\s*[=:]\s*(\d+)',
            r'(\d+)\s+place(?:s)?\s+obligatoire',
            r'au\s+moins\s+(\d+)\s+place',
        ]
        
    else:
        # Pattern général pour nombres avec plus de flexibilité
        patterns = [
            r'(\d+(?:[.,]\d+)?)',
            r'valeur\s*[=:]\s*(\d+(?:[.,]\d+)?)',
            r'(?:égal|égale)\s+(?:à\s+)?(\d+(?:[.,]\d+)?)',
        ]
    
    # Chercher les patterns avec scoring
    candidates = []
    
    for pattern_index, pattern in enumerate(patterns):
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            value = match.group(1).replace(',', '.')
            # Validation basique avec scoring amélioré
            try:
                if constraint_type.lower() in ["indice", "utilisation"]:
                    float_val = float(value)
                    if 0.1 <= float_val <= 3.0:
                        # Score basé sur la position dans le pattern (premiers patterns = plus fiables)
                        score = 100 - pattern_index * 5  # Score plus graduél
                        candidates.append((value, score))
                        
                elif "hauteur" in constraint_type.lower():
                    float_val = float(value)
                    if 3 <= float_val <= 50:
                        score = 100 - pattern_index * 5
                        candidates.append((f"{value} m", score))
                        
                elif "distance" in constraint_type.lower():
                    float_val = float(value)
                    if 0.5 <= float_val <= 50:
                        score = 100 - pattern_index * 5
                        candidates.append((f"{value} m", score))
                        
                elif "surface" in constraint_type.lower():
                    # Nettoyer les espaces dans les nombres
                    clean_value = value.replace(' ', '')
                    float_val = float(clean_value)
                    if float_val >= 100:
                        score = 100 - pattern_index * 5
                        candidates.append((f"{clean_value} m²", score))
                        
                elif "stationnement" in constraint_type.lower():
                    int_val = int(float(value))
                    if 0 < int_val <= 10:
                        score = 100 - pattern_index * 5
                        candidates.append((str(int_val), score))
                        
                elif constraint_type == "général":
                    score = 100 - pattern_index * 5
                    candidates.append((value, score))
                    
            except ValueError:
                continue
    
    # Retourner le candidat avec le meilleur score - CORRECTION ICI
    if candidates:
        # Trier par score décroissant et prendre le premier
        candidates.sort(key=lambda x: x[1], reverse=True)
        best_candidate = candidates[0]
        return best_candidate[0]
    
    return "-"

def extract_specific_rules(zone: str, constraint_type: str, passages: List[str]) -> str:
    """
    Extrait les règles spécifiques selon le type de contrainte.
    
    Args:
        zone: Zone d'affectation
        constraint_type: Type de contrainte
        passages: Passages trouvés
    
    Returns:
        Règle extraite formatée
    """
    if not passages:
        return "-"
    
    # D'abord essayer d'extraire une valeur numérique
    numerical_value = extract_numerical_values(passages, constraint_type)
    
    if numerical_value != "-":
        return numerical_value
    
    # Sinon, chercher des règles textuelles
    text = " ".join(passages).lower()
    
    if "indice" in constraint_type.lower():
        # Chercher des mentions d'indices
        if "0.30" in text or "0,30" in text:
            return "0.30"
        elif "villa" in text and "famille" in text:
            return "Zone villa familiale (voir règlement spécifique)"
    
    elif "toiture" in constraint_type.lower():
        # Chercher des règles de toiture
        if "tuile" in text:
            return "Tuiles obligatoires"
        elif "pente" in text:
            if "30%" in text or "30 %" in text:
                return "Pente minimum 30%"
            else:
                return "Pente réglementée (voir règlement)"
        elif "toit" in text:
            return "Règles de toiture spécifiques"
    
    elif "stationnement" in constraint_type.lower():
        if "logement" in text:
            return "1 place par logement minimum"
        elif "obligatoire" in text:
            return "Stationnement obligatoire"
    
    # Retourner un extrait pertinent si pas de valeur spécifique
    for passage in passages:
        # Prendre le passage le plus court et pertinent
        if len(passage) < 200 and any(word in passage.lower() for word in [constraint_type.lower(), zone.lower()]):
            return passage.strip()[:100] + "..."
    
    return "-"

def extract_index_from_zone_name(zone_text: str) -> str:
    """
    Tente d'extraire l'indice d'utilisation directement du nom de zone RDPPF.
    
    Args:
        zone_text: Texte de la zone (ex: "ZONE 18/3 Zone des villas familliales 0.30 (3)")
    
    Returns:
        Indice d'utilisation trouvé ou "-" si non trouvé
    """
    if not zone_text:
        return "-"
    
    # Patterns pour extraire l'indice du nom de zone
    patterns = [
        # Format Lens: "ZONE 18/3 Zone des villas familliales 0.30 (3)"
        r'(\d+[.,]\d+)\s*\(\d+\)',  # 0.30 (3)
        
        # Autres formats possibles
        r'indice\s+(\d+[.,]\d+)',    # "indice 0.30"
        r'IU\s*[=:]\s*(\d+[.,]\d+)', # "IU = 0.30" ou "IU: 0.30"
        r'(\d+[.,]\d+)\s*IU',        # "0.30 IU"
        r'densité\s+(\d+[.,]\d+)',   # "densité 0.30"
        
        # Format avec séparateurs
        r'-\s*(\d+[.,]\d+)\s*-',     # "- 0.30 -"
        r'\|\s*(\d+[.,]\d+)\s*\|',   # "| 0.30 |"
        
        # À la fin de la description
        r'(\d+[.,]\d+)$',            # "Zone villa 0.30"
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, zone_text, re.IGNORECASE)
        for match in matches:
            value = match.group(1).replace(',', '.')
            try:
                float_val = float(value)
                # Validation: indice d'utilisation typiquement entre 0.1 et 3.0
                if 0.1 <= float_val <= 3.0:
                    print(f"  📍 Indice trouvé dans le nom de zone: {value}")
                    return value
            except ValueError:
                continue
    
    return "-"

def extract_height_from_zone_name(zone_text: str) -> str:
    """
    Tente d'extraire la hauteur maximale du nom de zone RDPPF.
    
    Args:
        zone_text: Texte de la zone
    
    Returns:
        Hauteur trouvée ou "-" si non trouvé
    """
    if not zone_text:
        return "-"
    
    # Patterns pour extraire la hauteur
    patterns = [
        r'(\d+)\s*m(?:ètres?)?\s*max',      # "12m max"
        r'max\s*(\d+)\s*m',                 # "max 12m"
        r'hauteur\s+(\d+)',                 # "hauteur 12"
        r'(\d+)\s*étages?',                 # "3 étages"
        r'H\s*[=:]\s*(\d+)',               # "H = 12"
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, zone_text, re.IGNORECASE)
        for match in matches:
            value = match.group(1)
            try:
                int_val = int(value)
                if 3 <= int_val <= 50:  # Hauteurs raisonnables
                    print(f"  📍 Hauteur trouvée dans le nom de zone: {value} m")
                    return f"{value} m"
            except ValueError:
                continue
    
    return "-"

def generate_feasibility_report(commune: str, zone: str, documents: List[dict]) -> dict:
    """
    Génère un rapport de faisabilité structuré basé sur les documents RAG trouvés.
    Retourne un dictionnaire avec contraintes extraites et métadonnées.
    """
    print(f"[FEASIBILITY] Génération rapport pour {commune}, zone {zone}")
    print(f"[FEASIBILITY] Documents fournis: {len(documents)}")
    
    # Structure de réponse
    report = {
        "commune": commune,
        "zone": zone,
        "constraints": [],
        "summary": "",
        "metadata": {
            "documents_analyzed": len(documents),
            "extraction_confidence": 0.0,
            "sources_used": []
        }
    }
    
    if not documents:
        print(f"[FEASIBILITY] Aucun document fourni")
        report["summary"] = "Aucune information trouvée dans le règlement communal"
        return report
    
    # Combiner le contenu des documents
    combined_text = ""
    for doc in documents:
        content = doc.get("content", "")
        if content:
            combined_text += content + "\n"
            # Tracker les sources
            metadata = doc.get("metadata", {})
            page = metadata.get("page", "inconnue")
            source = f"Page {page}"
            if source not in report["metadata"]["sources_used"]:
                report["metadata"]["sources_used"].append(source)
    
    print(f"[FEASIBILITY] Texte combiné: {len(combined_text)} caractères")
    
    # Types de contraintes à extraire
    constraint_patterns = {
        "indice_utilisation_sol": [
            r"indice.*?d.{0,10}utilisation.*?(\d+[.,]\d+)",
            r"coefficient.*?d.{0,10}occupation.*?(\d+[.,]\d+)",
            r"COS.*?(\d+[.,]\d+)",
            r"taux.*?d.{0,10}occupation.*?(\d+[.,]\d+)"
        ],
        "hauteur_max_batiment": [
            r"hauteur.*?max.*?(\d+(?:[.,]\d+)?)\s*m",
            r"(\d+(?:[.,]\d+)?)\s*m.*?maximum",
            r"ne.*?d[ée]passer.*?(\d+(?:[.,]\d+)?)\s*m",
            r"limit[ée].*?(?:à|de).*?(\d+(?:[.,]\d+)?)\s*m"
        ],
        "distance_limite": [
            r"distance.*?limite.*?(\d+(?:[.,]\d+)?)\s*m",
            r"recul.*?(\d+(?:[.,]\d+)?)\s*m",
            r"marge.*?(\d+(?:[.,]\d+)?)\s*m",
            r"éloignement.*?(\d+(?:[.,]\d+)?)\s*m"
        ],
        "surface_min": [
            r"surface.*?min.*?(\d+)\s*m[²2]",
            r"parcelle.*?min.*?(\d+)\s*m[²2]",
            r"terrain.*?min.*?(\d+)\s*m[²2]"
        ],
        "places_stationnement": [
            r"(\d+)\s*place.*?stationnement",
            r"(\d+)\s*place.*?parc",
            r"stationnement.*?(\d+)",
            r"garage.*?(\d+)"
        ]
    }
    
    # Extraire chaque type de contrainte
    for constraint_type, patterns in constraint_patterns.items():
        print(f"[FEASIBILITY] Recherche {constraint_type}...")
        
        best_value = None
        best_confidence = 0.0
        best_context = ""
        
        for pattern in patterns:
            matches = re.finditer(pattern, combined_text, re.IGNORECASE | re.DOTALL)
            for match in matches:
                try:
                    value = match.group(1).replace(",", ".")
                    
                    # Contexte autour du match (50 caractères avant/après)
                    start = max(0, match.start() - 50)
                    end = min(len(combined_text), match.end() + 50)
                    context = combined_text[start:end].strip()
                    
                    # Calcul de la confiance basé sur le contexte
                    confidence = 0.6  # Base
                    
                    # Bonifications selon le contexte
                    context_lower = context.lower()
                    if zone.lower() in context_lower:
                        confidence += 0.2  # Zone mentionnée
                    if any(word in context_lower for word in ["article", "alinéa", "prescrit", "réglementation"]):
                        confidence += 0.1  # Contexte légal
                    if any(word in context_lower for word in ["maximum", "minimum", "ne pas dépasser", "limité"]):
                        confidence += 0.1  # Langage de contrainte
                    
                    # Garder la meilleure valeur
                    if confidence > best_confidence:
                        best_value = value
                        best_confidence = confidence
                        best_context = context
                        
                except (ValueError, IndexError):
                    continue
        
        # Ajouter la contrainte si trouvée
        if best_value and best_confidence > 0.6:
            constraint_info = {
                "type": constraint_type,
                constraint_type: best_value,
                "confidence": round(best_confidence, 2),
                "remarques": f"Extrait du contexte: ...{best_context}..."
            }
            report["constraints"].append(constraint_info)
            print(f"[FEASIBILITY] OK {constraint_type}: {best_value} (confiance: {best_confidence:.2f})")
    
    # Générer le résumé
    if report["constraints"]:
        constraint_count = len(report["constraints"])
        report["summary"] = f"{constraint_count} contrainte(s) extraite(s) du règlement communal pour la zone {zone}"
        report["metadata"]["extraction_confidence"] = sum(c["confidence"] for c in report["constraints"]) / constraint_count
    else:
        report["summary"] = f"Aucune contrainte spécifique trouvée dans le règlement pour la zone {zone}"
        report["metadata"]["extraction_confidence"] = 0.0
    
    print(f"[FEASIBILITY] OK Rapport généré: {len(report['constraints'])} contraintes")
    return report
