import logging
import time
from functools import wraps
from typing import Callable, Any
import json
from datetime import datetime

# Configuration du logging avec encodage UTF-8 pour éviter les erreurs sur Windows
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('urban_ai.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger('urban_ai')

class PerformanceMonitor:
    """Moniteur de performance pour tracer les temps d'exécution."""
    
    def __init__(self):
        self.metrics = {}
    
    def time_function(self, func_name: str = None):
        """Décorateur pour mesurer le temps d'exécution d'une fonction."""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs) -> Any:
                start_time = time.time()
                try:
                    result = func(*args, **kwargs)
                    execution_time = time.time() - start_time
                    
                    # Log de la performance
                    logger.info(f"OK {func_name or func.__name__} exécuté en {execution_time:.2f}s")
                    
                    # Stockage des métriques
                    if func_name not in self.metrics:
                        self.metrics[func_name or func.__name__] = []
                    self.metrics[func_name or func.__name__].append({
                        'timestamp': datetime.now().isoformat(),
                        'execution_time': execution_time,
                        'success': True
                    })
                    
                    return result
                except Exception as e:
                    execution_time = time.time() - start_time
                    logger.error(f"ERREUR {func_name or func.__name__} échoué en {execution_time:.2f}s: {str(e)}")
                    
                    # Stockage de l'erreur
                    if func_name not in self.metrics:
                        self.metrics[func_name or func.__name__] = []
                    self.metrics[func_name or func.__name__].append({
                        'timestamp': datetime.now().isoformat(),
                        'execution_time': execution_time,
                        'success': False,
                        'error': str(e)
                    })
                    
                    raise
            return wrapper
        return decorator
    
    def get_metrics(self) -> dict:
        """Retourne les métriques de performance."""
        return self.metrics
    
    def get_average_performance(self) -> dict:
        """Calcule les performances moyennes par fonction."""
        averages = {}
        for func_name, metrics in self.metrics.items():
            if metrics:
                successful_runs = [m for m in metrics if m['success']]
                if successful_runs:
                    avg_time = sum(m['execution_time'] for m in successful_runs) / len(successful_runs)
                    success_rate = len(successful_runs) / len(metrics) * 100
                    averages[func_name] = {
                        'avg_execution_time': round(avg_time, 2),
                        'success_rate': round(success_rate, 1),
                        'total_calls': len(metrics)
                    }
        return averages

# Instance globale du moniteur
performance_monitor = PerformanceMonitor()

def log_api_request(commune: str, parcelle: str, endpoint: str, duration: float, success: bool, error: str = None):
    """Log une requête API."""
    log_data = {
        'timestamp': datetime.now().isoformat(),
        'endpoint': endpoint,
        'commune': commune,
        'parcelle': parcelle,
        'duration': round(duration, 2),
        'success': success
    }
    
    if error:
        log_data['error'] = error
        logger.error(f"API Request Failed: {json.dumps(log_data)}")
    else:
        logger.info(f"API Request Success: {json.dumps(log_data)}")

def log_rdppf_request(commune: str, parcelle: str, duration: float, success: bool, error: str = None):
    """Log une requête RDPPF."""
    log_data = {
        'timestamp': datetime.now().isoformat(),
        'service': 'RDPPF',
        'commune': commune,
        'parcelle': parcelle,
        'duration': round(duration, 2),
        'success': success
    }
    
    if error:
        log_data['error'] = error
        logger.error(f"RDPPF Request Failed: {json.dumps(log_data)}")
    else:
        logger.info(f"RDPPF Request Success: {json.dumps(log_data)}")

def log_rag_search(commune: str, query: str, results_count: int, duration: float):
    """Log une recherche RAG."""
    log_data = {
        'timestamp': datetime.now().isoformat(),
        'service': 'RAG',
        'commune': commune,
        'query': query,
        'results_count': results_count,
        'duration': round(duration, 2)
    }
    logger.info(f"RAG Search: {json.dumps(log_data)}") 