from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import time
import os
import re
from rdppf import fetch_rdppf
from dotenv import load_dotenv
from llm import extract_rules, generate_report, extract_index_from_zone_name, extract_height_from_zone_name, generate_feasibility_report, extract_rdppf_constraints
from utils.logger import performance_monitor, log_api_request
from rag import get_collection_stats, get_cache_stats, clear_cache, search_with_multiple_strategies
from database import db
from pdf_generator import pdf_generator

load_dotenv()

app = FastAPI(
    title="Urban-AI Valais",
    description="API d'analyse urbaine pour les parcelles valaisannes",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuration CORS pour permettre l'accès depuis le frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, spécifiez les domaines autorisés
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyseResponse(BaseModel):
    commune: str
    parcelle: str
    rdppf: dict
    success: bool
    message: str

class RapportResponse(BaseModel):
    commune: str
    parcelle: str
    rdppf: dict
    rules: dict
    report: str
    success: bool
    message: str

class PDFResponse(BaseModel):
    commune: str
    parcelle: str
    pdf_url: str
    filename: str
    success: bool
    message: str

class IAConstraintsRequest(BaseModel):
    commune: str
    parcelle: str

class ConstraintInfo(BaseModel):
    type: str
    indice_utilisation_sol: Optional[str] = None
    hauteur_max_batiment: Optional[str] = None
    distance_limite: Optional[str] = None
    surface_min: Optional[str] = None
    places_stationnement: Optional[str] = None
    source_info: str
    confidence: float
    remarques: str

class IAConstraintsResponse(BaseModel):
    commune: str
    parcelle: str
    zone_info: dict
    constraints: List[ConstraintInfo]
    metadata: dict
    success: bool
    message: str

class TestRAGRequest(BaseModel):
    commune: str
    query: str

class TestRAGResponse(BaseModel):
    documents: List[dict]
    success: bool
    message: str

@app.get("/health", tags=["Système"])
def health_check():
    """Vérifie l'état de santé de l'API."""
    return {
        "status": "healthy",
        "service": "Urban-AI Valais",
        "version": "1.0.0",
        "timestamp": time.time()
    }

@app.get("/metrics", tags=["Monitoring"])
def get_metrics():
    """Retourne les métriques de performance du système."""
    return {
        "performance": performance_monitor.get_average_performance(),
        "rag_stats": get_collection_stats(),
        "cache_stats": get_cache_stats(),
        "database_stats": db.get_database_stats(),
        "performance_stats": db.get_performance_stats(),
        "timestamp": time.time()
    }

@app.delete("/cache", tags=["Monitoring"])
def clear_search_cache():
    """Vide le cache de recherche RAG."""
    clear_cache()
    return {
        "message": "Cache vidé avec succès",
        "timestamp": time.time()
    }

@app.get("/analyses/recent", tags=["Analyses"])
def get_recent_analyses(limit: int = Query(10, ge=1, le=50)):
    """Récupère les analyses récentes."""
    return {
        "analyses": db.get_recent_analyses(limit),
        "total": len(db.get_recent_analyses(limit))
    }

@app.get("/analyse", response_model=AnalyseResponse, tags=["Analyse"])
def analyse(
    commune: str = Query(..., description="Nom de la commune (ex: Lens)"),
    parcelle: str = Query(..., description="Numéro de parcelle (ex: 5217)"),
    request: Request = None
):
    """Retourne le JSON RDPPF brut pour une parcelle."""
    start_time = time.time()
    user_agent = request.headers.get("user-agent", "") if request else ""
    ip_address = request.client.host if request else ""
    
    try:
        rdppf_data = fetch_rdppf(commune, parcelle)
        duration = time.time() - start_time
        
        # Log de la requête
        log_api_request(commune, parcelle, "/analyse", duration, True)
        
        # Sauvegarde en base de données
        db.save_api_request(
            endpoint="/analyse",
            duration=duration,
            success=True,
            commune=commune,
            parcelle=parcelle,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        return AnalyseResponse(
            commune=commune,
            parcelle=parcelle,
            rdppf=rdppf_data,
            success=True,
            message="Données RDPPF récupérées avec succès"
        )
    except Exception as err:
        duration = time.time() - start_time
        log_api_request(commune, parcelle, "/analyse", duration, False, str(err))
        
        # Sauvegarde de l'erreur en base
        db.save_api_request(
            endpoint="/analyse",
            duration=duration,
            success=False,
            error_message=str(err),
            commune=commune,
            parcelle=parcelle,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        raise HTTPException(status_code=400, detail=str(err))

@app.get("/rapport", response_model=RapportResponse, tags=["Rapport"])
def rapport(
    commune: str = Query(..., description="Nom de la commune (ex: Lens)"),
    parcelle: str = Query(..., description="Numéro de parcelle (ex: 5217)"),
    request: Request = None
):
    """Génère un rapport d'analyse complet pour une parcelle."""
    start_time = time.time()
    user_agent = request.headers.get("user-agent", "") if request else ""
    ip_address = request.client.host if request else ""
    
    try:
        # Vérifier si une analyse récente existe en cache
        cached_analysis = db.get_analysis_by_commune_parcelle(commune, parcelle)
        
        if cached_analysis:
            # Utiliser l'analyse en cache si elle date de moins de 24h
            from datetime import datetime, timedelta
            cache_time = datetime.fromisoformat(cached_analysis['created_at'].replace('Z', '+00:00'))
            if datetime.now(cache_time.tzinfo) - cache_time < timedelta(hours=24):
                duration = time.time() - start_time
                log_api_request(commune, parcelle, "/rapport", duration, True)
                
                return RapportResponse(
                    commune=commune,
                    parcelle=parcelle,
                    rdppf=cached_analysis['rdppf_data'],
                    rules=cached_analysis['rules_data'],
                    report=cached_analysis['report_data'],
                    success=True,
                    message="Rapport récupéré depuis le cache"
                )
        
        # Récupérer les données RDPPF
        rdppf_data = fetch_rdppf(commune, parcelle)
        
        # Extraire les règles de la commune avec les données RDPPF
        rules = extract_rules(commune, rdppf_data)
        
        # Générer le rapport avec GPT
        report = generate_report(commune, rdppf_data, rules)
        
        duration = time.time() - start_time
        
        # Sauvegarder l'analyse en base de données
        analysis_id = db.save_analysis(
            commune=commune,
            parcelle=parcelle,
            rdppf_data=rdppf_data,
            rules_data=rules,
            report_data=report,
            execution_time=duration,
            success=True
        )
        
        # Log de la requête
        log_api_request(commune, parcelle, "/rapport", duration, True)
        
        # Sauvegarde de la requête API
        db.save_api_request(
            endpoint="/rapport",
            duration=duration,
            success=True,
            commune=commune,
            parcelle=parcelle,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        return RapportResponse(
            commune=commune,
            parcelle=parcelle,
            rdppf=rdppf_data,
            rules=rules,
            report=report,
            success=True,
            message="Rapport généré avec succès"
        )
        
    except Exception as err:
        duration = time.time() - start_time
        log_api_request(commune, parcelle, "/rapport", duration, False, str(err))
        
        # Sauvegarder l'erreur en base
        db.save_analysis(
            commune=commune,
            parcelle=parcelle,
            rdppf_data={},
            rules_data={},
            report_data="",
            execution_time=duration,
            success=False,
            error_message=str(err)
        )
        
        # Sauvegarde de la requête API
        db.save_api_request(
            endpoint="/rapport",
            duration=duration,
            success=False,
            error_message=str(err),
            commune=commune,
            parcelle=parcelle,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        raise HTTPException(status_code=400, detail=str(err))

@app.get("/pdf", response_model=PDFResponse, tags=["PDF"])
def generate_pdf(
    commune: str = Query(..., description="Nom de la commune (ex: Lens)"),
    parcelle: str = Query(..., description="Numéro de parcelle (ex: 5217)"),
    request: Request = None
):
    """Génère un rapport PDF pour une parcelle."""
    start_time = time.time()
    user_agent = request.headers.get("user-agent", "") if request else ""
    ip_address = request.client.host if request else ""
    
    try:
        # Récupérer ou générer l'analyse
        cached_analysis = db.get_analysis_by_commune_parcelle(commune, parcelle)
        
        if not cached_analysis:
            # Générer une nouvelle analyse
            rdppf_data = fetch_rdppf(commune, parcelle)
            rules = extract_rules(commune, rdppf_data)
            report = generate_report(commune, rdppf_data, rules)
            
            analysis_data = {
                'commune': commune,
                'parcelle': parcelle,
                'rdppf': rdppf_data,
                'rules': rules,
                'report': report
            }
        else:
            # Utiliser l'analyse en cache
            analysis_data = {
                'commune': commune,
                'parcelle': parcelle,
                'rdppf': cached_analysis['rdppf_data'],
                'rules': cached_analysis['rules_data'],
                'report': cached_analysis['report_data']
            }
        
        # Générer le PDF
        pdf_path = pdf_generator.generate_report(analysis_data)
        filename = os.path.basename(pdf_path)
        
        # Sauvegarder les informations du PDF en base
        if cached_analysis:
            db.save_pdf_report(
                analysis_id=cached_analysis['id'],
                filename=filename,
                file_path=pdf_path,
                file_size=os.path.getsize(pdf_path)
            )
        
        duration = time.time() - start_time
        
        # Log de la requête
        log_api_request(commune, parcelle, "/pdf", duration, True)
        
        # Sauvegarde de la requête API
        db.save_api_request(
            endpoint="/pdf",
            duration=duration,
            success=True,
            commune=commune,
            parcelle=parcelle,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        return PDFResponse(
            commune=commune,
            parcelle=parcelle,
            pdf_url=f"/download/{filename}",
            filename=filename,
            success=True,
            message="PDF généré avec succès"
        )
        
    except Exception as err:
        duration = time.time() - start_time
        log_api_request(commune, parcelle, "/pdf", duration, False, str(err))
        
        # Sauvegarde de la requête API
        db.save_api_request(
            endpoint="/pdf",
            duration=duration,
            success=False,
            error_message=str(err),
            commune=commune,
            parcelle=parcelle,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        raise HTTPException(status_code=400, detail=str(err))

@app.get("/download/{filename}", tags=["Téléchargement"])
def download_pdf(filename: str):
    """Télécharge un fichier PDF généré."""
    pdf_path = os.path.join("reports", filename)
    
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="Fichier PDF non trouvé")
    
    return FileResponse(
        pdf_path,
        media_type='application/pdf',
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/", tags=["Accueil"])
def root():
    """Page d'accueil de l'API avec documentation des endpoints."""
    return {
        "message": "Urban-AI Valais API",
        "version": "1.0.0",
        "endpoints": {
            "/health": "Vérification de l'état de santé",
            "/metrics": "Métriques de performance du système",
            "/cache": "Gestion du cache de recherche",
            "/analyses/recent": "Analyses récentes",
            "/analyse": "Récupère les données RDPPF pour une parcelle",
            "/rapport": "Génère un rapport complet d'analyse",
            "/pdf": "Génère un rapport PDF",
            "/download/{filename}": "Télécharge un PDF généré",
            "/ia-constraints": "Analyse IA améliorée",
            "/test-rag": "Test RAG amélioré"
        },
        "exemples": {
            "analyse": "/analyse?commune=Lens&parcelle=5217",
            "rapport": "/rapport?commune=Lens&parcelle=5217",
            "pdf": "/pdf?commune=Lens&parcelle=5217"
        },
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc"
        }
    }

@app.post("/ia-constraints", response_model=IAConstraintsResponse, tags=["IA"])
def ia_constraints(
    request_data: IAConstraintsRequest,
    request: Request = None
):
    """
    Endpoint principal utilisant le système IA amélioré.
    Combine données RDPPF officielles + règlements communaux via RAG.
    """
    start_time = time.time()
    user_agent = request.headers.get("user-agent", "") if request else ""
    ip_address = request.client.host if request else ""
    
    commune = request_data.commune
    parcelle = request_data.parcelle
    
    try:
        print(f"[IA-CONSTRAINTS] Début analyse pour {commune} parcelle {parcelle}")
        
        # 1. Récupération des données RDPPF officielles
        rdppf_data = fetch_rdppf(commune, parcelle)
        
        # 2. Extraction de la zone depuis RDPPF
        zone_info = {}
        zone_name = None
        constraints = []
        metadata = {
            "rag_documents_found": 0,
            "search_strategies_used": 0,
            "hybrid_extraction_used": False,
            "rdppf_extraction_success": False,
            "regulation_search_success": False
        }
        
        # Extraction de la zone depuis RDPPF (structure Extract)
        if 'Extract' in rdppf_data:
            extract_data = rdppf_data['Extract']
            
            # Méthode 1: Chercher dans RealEstate -> RestrictionOnLandownership
            real_estate = extract_data.get('RealEstate', {})
            restrictions = real_estate.get('RestrictionOnLandownership', [])
            
            for restriction in restrictions:
                # Chercher les restrictions avec 100% de couverture
                part = restriction.get('PartInPercent', restriction.get('Part', 0))
                if part == 100 or (isinstance(part, str) and "100" in part):
                    legend_texts = restriction.get('LegendText', [])
                    for legend in legend_texts:
                        if legend.get('Language') == 'fr':
                            zone_text = legend.get('Text', '').strip()
                            if any(keyword in zone_text.lower() for keyword in ['zone', 'affectation', 'secteur']):
                                zone_name = zone_text
                                zone_info = {
                                    "zone_name": zone_name,
                                    "source": "RDPPF",
                                    "restriction_data": restriction
                                }
                                break
                    if zone_name:
                        break
            
            # Méthode 2: Si pas trouvé, chercher dans ConcernedTheme
            if not zone_name:
                themes = extract_data.get('ConcernedTheme', [])
                for theme in themes:
                    for text_item in theme.get('Text', []):
                        if text_item.get('Language') == 'fr':
                            theme_text = text_item.get('Text', '').strip()
                            if any(keyword in theme_text.lower() for keyword in ['zone', 'plan']):
                                zone_name = theme_text
                                zone_info = {
                                    "zone_name": zone_name,
                                    "source": "RDPPF",
                                    "theme_data": theme
                                }
                                break
                        if zone_name:
                            break
                    if zone_name:
                        break
        
        print(f"[IA-CONSTRAINTS] Zone extraite: {zone_name}")
        
        # 3. Extraction hybride des contraintes
        if zone_name:
            metadata["hybrid_extraction_used"] = True
            
            # STRATÉGIE PRIORITAIRE: Recherche SPÉCIFIQUE sur le nom de zone dans les règlements
            try:
                print(f"[IA-CONSTRAINTS] Recherche spécifique pour la zone: {zone_name}")
                
                # Extraire les mots-clés de recherche depuis le nom de zone
                zone_keywords = []
                
                # 1. Nom complet de zone
                zone_keywords.append(zone_name)
                
                # 2. Extraire le numéro de zone (ex: "ZONE 18/3" -> "18/3", "ZONE 18")
                zone_number_match = re.search(r'ZONE\s+(\d+(?:[/\\.-]\d+)?)', zone_name, re.IGNORECASE)
                if zone_number_match:
                    zone_number = zone_number_match.group(1)
                    zone_keywords.append(f"ZONE {zone_number}")
                    zone_keywords.append(zone_number)
                    
                    # Ajouter aussi la zone parent (ex: "18/3" -> "18")
                    parent_zone = zone_number.split('/')[0].split('\\')[0].split('.')[0].split('-')[0]
                    if parent_zone != zone_number:
                        zone_keywords.append(f"ZONE {parent_zone}")
                        zone_keywords.append(parent_zone)
                
                # 3. Extraire le type de zone (ex: "villas familliales")
                zone_type_match = re.search(r'zone\s+(?:des?\s+)?([a-zàâäéèêëïîôöùûüÿç\s]+)', zone_name, re.IGNORECASE)
                if zone_type_match:
                    zone_type = zone_type_match.group(1).strip()
                    if len(zone_type) > 3:  # Éviter les mots trop courts
                        zone_keywords.append(zone_type)
                
                print(f"[IA-CONSTRAINTS] Mots-clés de recherche: {zone_keywords}")
                
                # Rechercher spécifiquement ces mots-clés dans le règlement
                all_search_results = []
                for keyword in zone_keywords:
                    if keyword.strip():
                        print(f"[IA-CONSTRAINTS] Recherche pour: '{keyword}'")
                        results = search_with_multiple_strategies(commune, keyword, "zone_specific")
                        all_search_results.extend(results)
                        print(f"[IA-CONSTRAINTS] Trouvé {len(results)} résultats pour '{keyword}'")
                
                # Dédupliquer les résultats
                search_results = list(dict.fromkeys(all_search_results))  # Garde l'ordre et supprime les doublons
                
                metadata["rag_documents_found"] = len(search_results)
                metadata["search_strategies_used"] = len(zone_keywords)  # Nombre de mots-clés utilisés
                metadata["regulation_search_success"] = len(search_results) > 0
                
                print(f"[IA-CONSTRAINTS] Documents RAG trouvés: {metadata['rag_documents_found']}")
                
                if search_results:
                    # Créer la structure de documents pour generate_feasibility_report
                    documents_for_feasibility = [{"content": doc} for doc in search_results]
                    
                    # Utiliser le nouveau système de génération de rapport
                    feasibility_report = generate_feasibility_report(commune, zone_name, documents_for_feasibility)
                    
                    # Extraire les contraintes du rapport
                    if feasibility_report.get("constraints"):
                        for constraint_data in feasibility_report["constraints"]:
                            # Extraire toutes les contraintes du règlement
                            if constraint_data.get("indice_utilisation_sol"):
                                constraints.append(ConstraintInfo(
                                    type="Indice d'utilisation du sol",
                                    indice_utilisation_sol=constraint_data["indice_utilisation_sol"],
                                    source_info="Règlement communal",
                                    confidence=constraint_data.get("confidence", 0.8),
                                    remarques=constraint_data.get("remarques", "Extrait du règlement communal")
                                ))
                            
                            if constraint_data.get("hauteur_max_batiment"):
                                constraints.append(ConstraintInfo(
                                    type="Hauteur maximale",
                                    hauteur_max_batiment=constraint_data["hauteur_max_batiment"],
                                    source_info="Règlement communal",
                                    confidence=constraint_data.get("confidence", 0.8),
                                    remarques=constraint_data.get("remarques", "Extrait du règlement communal")
                                ))
                            
                            # Autres contraintes toujours depuis le règlement
                            for field, label in [
                                ("distance_limite", "Distance aux limites"),
                                ("surface_min", "Surface minimale"),
                                ("places_stationnement", "Places de stationnement")
                            ]:
                                if constraint_data.get(field):
                                    constraints.append(ConstraintInfo(
                                        type=label,
                                        **{field: constraint_data[field]},
                                        source_info="Règlement communal",
                                        confidence=constraint_data.get("confidence", 0.7),
                                        remarques=constraint_data.get("remarques", f"{label} selon règlement")
                                    ))
                
            except Exception as e:
                print(f"[IA-CONSTRAINTS] Erreur recherche RAG: {e}")
                metadata["regulation_search_success"] = False
            
            # STRATÉGIE DE FALLBACK: Extraction COMPLÈTE depuis RDPPF (seulement si RAG n'a rien trouvé)
            if not constraints:
                print(f"[IA-CONSTRAINTS] FALLBACK: Extraction complète depuis JSON RDPPF")
                
                # 1. Extraire TOUTES les contraintes du JSON RDPPF complet
                rdppf_constraints = extract_rdppf_constraints(rdppf_data)
                print(f"[IA-CONSTRAINTS] Contraintes RDPPF trouvées: {len(rdppf_constraints)}")
                
                # 2. Extraction depuis le nom de zone (comme avant)
                indice_rdppf = extract_index_from_zone_name(zone_name)
                hauteur_rdppf = extract_height_from_zone_name(zone_name)
                
                # 3. Analyser les contraintes RDPPF pour extraire plus d'informations
                for rdppf_constraint in rdppf_constraints:
                    constraint_value = rdppf_constraint.get('value', '')
                    constraint_type = rdppf_constraint.get('type', 'général')
                    
                    print(f"[IA-CONSTRAINTS] Analyse contrainte RDPPF: {constraint_type} = {constraint_value[:100]}...")
                    
                    # Extraire indice d'utilisation depuis contraintes RDPPF
                    if not indice_rdppf and constraint_type in ['indice d\'utilisation', 'général']:
                        indice_match = re.search(r'(\d+[.,]\d+).*(?:indice|utilisation|densité|IU)', constraint_value, re.IGNORECASE)
                        if indice_match:
                            indice_rdppf = indice_match.group(1).replace(',', '.')
                            print(f"[IA-CONSTRAINTS] Indice extrait des contraintes RDPPF: {indice_rdppf}")
                    
                    # Extraire hauteur depuis contraintes RDPPF
                    if not hauteur_rdppf and constraint_type in ['hauteur', 'général']:
                        hauteur_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:m|mètre).*(?:hauteur|max|limite)', constraint_value, re.IGNORECASE)
                        if hauteur_match:
                            hauteur_rdppf = f"{hauteur_match.group(1)} m"
                            print(f"[IA-CONSTRAINTS] Hauteur extraite des contraintes RDPPF: {hauteur_rdppf}")
                    
                    # Extraire distances
                    if constraint_type in ['distance', 'général']:
                        distance_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:m|mètre).*(?:distance|recul|marge|limite)', constraint_value, re.IGNORECASE)
                        if distance_match:
                            distance = f"{distance_match.group(1)} m"
                            constraints.append(ConstraintInfo(
                                type="Distance aux limites",
                                distance_limite=distance,
                                source_info="Contraintes RDPPF",
                                confidence=0.8,
                                remarques=f"Extrait des contraintes RDPPF: {constraint_value[:150]}..."
                            ))
                            print(f"[IA-CONSTRAINTS] Distance extraite: {distance}")
                    
                    # Extraire surfaces
                    if constraint_type in ['surface', 'général']:
                        surface_match = re.search(r'(\d+)\s*(?:m[²2]|m2).*(?:surface|terrain|parcelle|minimum)', constraint_value, re.IGNORECASE)
                        if surface_match:
                            surface = f"{surface_match.group(1)} m²"
                            constraints.append(ConstraintInfo(
                                type="Surface minimale",
                                surface_min=surface,
                                source_info="Contraintes RDPPF",
                                confidence=0.8,
                                remarques=f"Extrait des contraintes RDPPF: {constraint_value[:150]}..."
                            ))
                            print(f"[IA-CONSTRAINTS] Surface extraite: {surface}")
                
                # 4. Ajouter l'indice si trouvé
                if indice_rdppf:
                    constraints.append(ConstraintInfo(
                        type="Indice d'utilisation du sol",
                        indice_utilisation_sol=indice_rdppf,
                        source_info="RDPPF (extraction hybride)",
                        confidence=0.8,
                        remarques=f"Extrait des données RDPPF car aucune info dans le règlement: {zone_name}"
                    ))
                    metadata["rdppf_extraction_success"] = True
                    print(f"[IA-CONSTRAINTS] Indice fallback trouvé: {indice_rdppf}")
                
                # 5. Ajouter la hauteur si trouvée
                if hauteur_rdppf:
                    constraints.append(ConstraintInfo(
                        type="Hauteur maximale",
                        hauteur_max_batiment=hauteur_rdppf,
                        source_info="RDPPF (extraction hybride)",
                        confidence=0.8,
                        remarques=f"Extrait des données RDPPF car aucune info dans le règlement: {zone_name}"
                    ))
                    print(f"[IA-CONSTRAINTS] Hauteur fallback trouvée: {hauteur_rdppf}")
                
                # 6. Ajouter toutes les autres contraintes pertinentes comme informations générales
                for rdppf_constraint in rdppf_constraints[:3]:  # Limiter à 3 pour ne pas surcharger
                    if rdppf_constraint.get('type') not in ['zone']:  # Exclure les informations de zone déjà affichées
                        constraints.append(ConstraintInfo(
                            type=f"Information RDPPF: {rdppf_constraint.get('type', 'général').title()}",
                            remarques=rdppf_constraint.get('value', '')[:200] + "..." if len(rdppf_constraint.get('value', '')) > 200 else rdppf_constraint.get('value', ''),
                            source_info="Contraintes RDPPF",
                            confidence=0.6
                        ))
                
                if not constraints:
                    print(f"[IA-CONSTRAINTS] Aucune contrainte trouvée ni dans le règlement ni dans les données RDPPF complètes")
                else:
                    print(f"[IA-CONSTRAINTS] FALLBACK RÉUSSI: {len(constraints)} contraintes extraites du RDPPF")
        
        duration = time.time() - start_time
        
        # Log de la requête
        log_api_request(commune, parcelle, "/ia-constraints", duration, True)
        
        # Sauvegarde en base de données
        db.save_api_request(
            endpoint="/ia-constraints",
            duration=duration,
            success=True,
            commune=commune,
            parcelle=parcelle,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        print(f"[IA-CONSTRAINTS] OK Analyse terminée en {duration:.2f}s - {len(constraints)} contraintes")
        
        return IAConstraintsResponse(
            commune=commune,
            parcelle=parcelle,
            zone_info=zone_info,
            constraints=constraints,
            metadata=metadata,
            success=True,
            message=f"Analyse IA complétée avec succès. {len(constraints)} contraintes trouvées."
        )
        
    except Exception as err:
        duration = time.time() - start_time
        log_api_request(commune, parcelle, "/ia-constraints", duration, False, str(err))
        
        # Sauvegarde de l'erreur en base
        db.save_api_request(
            endpoint="/ia-constraints",
            duration=duration,
            success=False,
            error_message=str(err),
            commune=commune,
            parcelle=parcelle,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        print(f"[IA-CONSTRAINTS] ERREUR: {err}")
        raise HTTPException(status_code=400, detail=str(err))

@app.post("/test-rag", response_model=TestRAGResponse, tags=["Debug"])
def test_rag(request_data: TestRAGRequest):
    """
    Endpoint de test pour le système RAG amélioré.
    Permet de tester directement les recherches multi-stratégies.
    """
    try:
        commune = request_data.commune
        query = request_data.query
        
        print(f"[TEST-RAG] Test pour {commune}: '{query}'")
        
        # Utiliser le système de recherche multi-stratégies
        search_results = search_with_multiple_strategies(commune, query)
        
        # search_results est une List[str], pas un dictionnaire
        documents = [{"content": doc, "metadata": {}} for doc in search_results]
        
        print(f"[TEST-RAG] OK {len(documents)} documents trouvés")
        
        return TestRAGResponse(
            documents=documents,
            success=True,
            message=f"{len(documents)} documents trouvés avec les stratégies multi-recherche"
        )
        
    except Exception as e:
        print(f"[TEST-RAG] ERREUR: {e}")
        raise HTTPException(status_code=400, detail=str(e))