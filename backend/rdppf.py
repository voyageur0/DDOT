# backend/rdppf.py
import requests
import time
from communes_vs import COMMUNES_VS
from utils.logger import performance_monitor, log_rdppf_request

# ────────────────────────────────────────────────────────────────
# Conversion nom de commune  → IDENTDN (VS + code BFS cadastral)
# ────────────────────────────────────────────────────────────────
@performance_monitor.time_function("name_to_identdn")
def name_to_identdn(commune: str) -> str:
    try:
        return COMMUNES_VS[commune.lower()]
    except KeyError:
        raise ValueError(
            f"Commune «{commune}» introuvable dans la liste locale (Valais)"
        )

# ────────────────────────────────────────────────────────────────
# Récupération JSON RDPPF pour une parcelle
# ────────────────────────────────────────────────────────────────
@performance_monitor.time_function("fetch_rdppf")
def fetch_rdppf(commune: str, parcelle: str) -> dict:
    """
    Récupère le JSON RDPPF officiel pour une parcelle valaisanne.
    Le service peut prendre du temps à répondre, d'où le timeout de 60 secondes.
    """
    start_time = time.time()
    identdn = name_to_identdn(commune)
    url = (
        "https://rdppfvs.geopol.ch/extract/json/"
        f"?IDENTDN={identdn}&NUMBER={parcelle}"
    )
    
    try:
        print(f"[RDPPF] Récupération des données pour {commune} parcelle {parcelle}...")
        resp = requests.get(url, timeout=60)  # Timeout augmenté à 60 secondes
        resp.raise_for_status()
        
        # Debug: afficher le contenu de la réponse
        print(f"[RDPPF] Status: {resp.status_code}")
        print(f"[RDPPF] Content-Type: {resp.headers.get('content-type', 'Non spécifié')}")
        print(f"[RDPPF] Taille réponse: {len(resp.text)} caractères")
        print(f"[RDPPF] Début réponse: {resp.text[:200]}...")
        
        if resp.status_code == 204 or not resp.text.strip():
            raise Exception(f"Aucune donnée RDPPF disponible pour {commune} parcelle {parcelle}")
        
        data = resp.json()
        duration = time.time() - start_time
        log_rdppf_request(commune, parcelle, duration, True)
        print(f"[RDPPF] OK Données récupérées avec succès en {duration:.2f}s")
        return data
        
    except requests.exceptions.Timeout as e:
        duration = time.time() - start_time
        log_rdppf_request(commune, parcelle, duration, False, str(e))
        print(f"[RDPPF] ERREUR Timeout après 60 secondes: {e}")
        raise Exception(f"Le service RDPPF met trop de temps à répondre pour {commune} parcelle {parcelle}")
        
    except requests.exceptions.ConnectionError as e:
        duration = time.time() - start_time
        log_rdppf_request(commune, parcelle, duration, False, str(e))
        print(f"[RDPPF] ERREUR Erreur de connexion: {e}")
        raise Exception(f"Impossible de se connecter au service RDPPF pour {commune} parcelle {parcelle}")
        
    except requests.exceptions.HTTPError as e:
        duration = time.time() - start_time
        log_rdppf_request(commune, parcelle, duration, False, str(e))
        print(f"[RDPPF] ERREUR Erreur HTTP {resp.status_code}: {e}")
        print(f"[RDPPF] Contenu d'erreur: {resp.text}")
        raise Exception(f"Erreur HTTP {resp.status_code} du service RDPPF pour {commune} parcelle {parcelle}")
        
    except ValueError as e:  # Erreur de parsing JSON
        duration = time.time() - start_time
        log_rdppf_request(commune, parcelle, duration, False, str(e))
        print(f"[RDPPF] ERREUR Erreur de parsing JSON: {e}")
        print(f"[RDPPF] Contenu reçu: {resp.text}")
        raise Exception(f"Le service RDPPF a retourné un contenu JSON invalide pour {commune} parcelle {parcelle}")
        
    except Exception as e:
        duration = time.time() - start_time
        log_rdppf_request(commune, parcelle, duration, False, str(e))
        print(f"[RDPPF] ERREUR Erreur inattendue: {e}")
        raise Exception(f"Erreur lors de la récupération des données RDPPF pour {commune} parcelle {parcelle}")
