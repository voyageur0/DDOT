from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from pathlib import Path
from math import ceil
from datetime import datetime
from typing import List
import re
from rdppf import fetch_rdppf
from llm import extract_zone_from_rdppf, extract_rdppf_constraints, extract_rules

_env = Environment(loader=FileSystemLoader("backend/templates"))

def assemble(rdppf: dict, rules: dict) -> dict:
    surf = rdppf.get("RealEstate", {}).get("Area", 0)
    zone = " / ".join(
        t["Text"][0]["Text"] for t in rdppf["Extract"]["ConcernedTheme"]
        if "Nutzungsplanung" in t["Code"]
    ) or "Zone inconnue"
    surf_ind = ceil(surf * rules["indice"]) if rules["indice"] else "–"
    return {
        "surface": surf,
        "zone": zone,
        "indice": rules["indice"] or "–",
        "ibus": rules["ibus"] or "–",
        "surface_indice": surf_ind,
        "dist_min": rules["dist_min"] or "–",
        "dist_norm": rules["dist_norm"] or "–",
        "h_pans": rules["h_pans"] or "–",
        "h_plat": rules["h_plat"] or "–",
        "toiture": rules["toiture"] or "–",
        "places": rules["places"] or "–",
        "themes": ", ".join(
            t["Text"][0]["Text"] for t in rdppf["Extract"]["ConcernedTheme"]
        ) or "Aucune"
    }

def build_pdf(commune: str, parcelle: str, data: dict) -> Path:
    tpl = _env.get_template("rapport.html")
    html = tpl.render(commune=commune.title(), parcelle=parcelle, **data)
    out = Path("out")
    out.mkdir(exist_ok=True)
    pdf_path = out / f"{commune}_{parcelle}.pdf"
    HTML(string=html).write_pdf(pdf_path)
    return pdf_path

def generate_feasibility_report(commune: str, parcelle: str, surface: str = None) -> dict:
    """
    Génère un rapport de faisabilité complet avec extraction améliorée.
    
    Args:
        commune: Nom de la commune
        parcelle: Numéro de parcelle  
        surface: Surface de la parcelle (optionnel)
    
    Returns:
        Dictionnaire avec le rapport complet et les métadonnées
    """
    try:
        print(f"📊 Génération du rapport de faisabilité pour {commune} parcelle {parcelle}")
        
        # 1. Récupération des données RDPPF
        rdppf_data = fetch_rdppf(commune, parcelle)
        
        # 2. Extraction de la zone et des contraintes
        zone = extract_zone_from_rdppf(rdppf_data)
        rdppf_constraints = extract_rdppf_constraints(rdppf_data)
        
        # 3. Extraction améliorée des règles avec les nouvelles fonctions
        rules = extract_rules(zone, rdppf_constraints, commune)
        
        # 4. Formatage du contenu du rapport
        report_content = format_report_content(
            commune=commune,
            parcelle=parcelle, 
            surface=surface,
            zone=zone,
            rdppf_constraints=rdppf_constraints,
            rules=rules
        )
        
        # 5. Génération du PDF
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pdf_filename = f"rapport_{commune}_{parcelle}_{timestamp}.pdf"
        pdf_path = generate_pdf_report(report_content, pdf_filename)
        
        # 6. Retour des résultats
        return {
            "success": True,
            "report_content": report_content,
            "pdf_path": pdf_path,
            "pdf_filename": pdf_filename,
            "zone": zone,
            "rdppf_constraints": rdppf_constraints,
            "extracted_rules": rules,
            "metadata": {
                "commune": commune,
                "parcelle": parcelle,
                "surface": surface,
                "timestamp": timestamp,
                "rdppf_themes": len([c for c in rdppf_constraints if c.get('type') == 'thème']),
                "rules_found": sum(1 for v in rules.values() if v != "-" and v != [])
            }
        }
        
    except Exception as e:
        print(f"❌ Erreur lors de la génération du rapport: {e}")
        return {
            "success": False,
            "error": str(e),
            "report_content": "",
            "pdf_path": None
        }

def format_report_content(commune: str, parcelle: str, surface: str, zone: str, 
                         rdppf_constraints: List[dict], rules: dict) -> str:
    """
    Formate le contenu du rapport avec les règles extraites.
    
    Args:
        commune: Nom de la commune
        parcelle: Numéro de parcelle
        surface: Surface de la parcelle
        zone: Zone d'affectation
        rdppf_constraints: Liste des contraintes RDPPF
        rules: Dictionnaire des règles extraites
    
    Returns:
        Contenu formaté du rapport
    """
    
    # Formatage des contraintes RDPPF
    rdppf_list = []
    for constraint in rdppf_constraints:
        if constraint.get('type') != 'zone':  # Exclure la zone (déjà affichée)
            rdppf_list.append(constraint.get('value', ''))
    
    rdppf_summary = ", ".join(rdppf_list) if rdppf_list else "Aucune contrainte particulière"
    
    # Construction du rapport
    content = f"""📋 ETUDE DE FAISABILITE
Parcelle à {commune.upper()}
==================================================
Commune : {commune.title()}
Surface : {surface or '-'} m2
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
Remarques : {rules.get('remarques', '-')}

Places de parc :
{rules.get('places_parc', '-')}

Remarques générales :
"""
    
    # Ajouter les passages généraux
    if rules.get('passages_generaux'):
        for i, passage in enumerate(rules['passages_generaux'][:5], 1):
            # Extraire un titre si possible
            lines = passage.strip().split('\n')
            first_line = lines[0].strip()
            
            # Chercher un article ou numéro
            article_match = re.search(r'Article\s+(\d+(?:\.\d+)?)', first_line, re.IGNORECASE)
            if article_match:
                title = f"Article {article_match.group(1)}"
                content += f"- {title}\n"
            else:
                # Prendre les premiers mots comme titre
                words = first_line.split()[:3]
                title = " ".join(words) if words else f"Règle {i}"
                content += f"- {title}\n"
            
            # Ajouter le contenu (nettoyé et raccourci)
            clean_content = passage.strip()
            if len(clean_content) > 300:
                clean_content = clean_content[:297] + "..."
            
            content += f"{clean_content}\n"
    else:
        content += "-\n"
    
    content += f"\nFait à Sion, le {datetime.now().strftime('%d %B %Y')}\n"
    
    return content
