#!/usr/bin/env python3
"""
Script de test automatisé pour l'API Urban-AI Valais
Teste tous les endpoints et valide les réponses
"""

import requests
import json
import time
from typing import Dict, Any

class APITester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.results = []
    
    def test_endpoint(self, endpoint: str, method: str = "GET", params: Dict = None, expected_status: int = 200) -> Dict[str, Any]:
        """Teste un endpoint spécifique."""
        url = f"{self.base_url}{endpoint}"
        start_time = time.time()
        
        try:
            if method == "GET":
                response = self.session.get(url, params=params, timeout=30)
            elif method == "DELETE":
                response = self.session.delete(url, timeout=30)
            else:
                raise ValueError(f"Méthode {method} non supportée")
            
            duration = time.time() - start_time
            success = response.status_code == expected_status
            
            result = {
                "endpoint": endpoint,
                "method": method,
                "params": params,
                "status_code": response.status_code,
                "expected_status": expected_status,
                "success": success,
                "duration": round(duration, 2),
                "response_size": len(response.text)
            }
            
            if success:
                try:
                    result["response_data"] = response.json()
                except:
                    result["response_data"] = response.text[:200]
            else:
                result["error"] = response.text[:200]
            
            print(f"{'✅' if success else '❌'} {method} {endpoint} - {response.status_code} ({duration:.2f}s)")
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            result = {
                "endpoint": endpoint,
                "method": method,
                "params": params,
                "success": False,
                "duration": round(duration, 2),
                "error": str(e)
            }
            print(f"❌ {method} {endpoint} - Erreur: {str(e)}")
            return result
    
    def run_all_tests(self):
        """Exécute tous les tests."""
        print("🚀 Démarrage des tests de l'API Urban-AI Valais")
        print("=" * 60)
        
        # Test de santé
        self.results.append(self.test_endpoint("/health"))
        
        # Test de la page d'accueil
        self.results.append(self.test_endpoint("/"))
        
        # Test des métriques
        self.results.append(self.test_endpoint("/metrics"))
        
        # Test du cache
        self.results.append(self.test_endpoint("/cache", method="DELETE"))
        
        # Test d'analyse avec des données valides
        self.results.append(self.test_endpoint("/analyse", params={
            "commune": "Lens",
            "parcelle": "5217"
        }))
        
        # Test de rapport avec des données valides
        self.results.append(self.test_endpoint("/rapport", params={
            "commune": "Lens",
            "parcelle": "5217"
        }))
        
        # Test avec des paramètres invalides
        self.results.append(self.test_endpoint("/analyse", params={
            "commune": "CommuneInexistante",
            "parcelle": "99999"
        }, expected_status=400))
        
        # Test sans paramètres
        self.results.append(self.test_endpoint("/analyse", expected_status=422))
        
        self.print_summary()
    
    def print_summary(self):
        """Affiche un résumé des tests."""
        print("\n" + "=" * 60)
        print("📊 RÉSUMÉ DES TESTS")
        print("=" * 60)
        
        total_tests = len(self.results)
        successful_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - successful_tests
        
        print(f"Total des tests: {total_tests}")
        print(f"Tests réussis: {successful_tests} ✅")
        print(f"Tests échoués: {failed_tests} ❌")
        print(f"Taux de réussite: {(successful_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ TESTS ÉCHOUÉS:")
            for result in self.results:
                if not result["success"]:
                    print(f"  - {result['method']} {result['endpoint']}: {result.get('error', 'Status code incorrect')}")
        
        # Statistiques de performance
        durations = [r["duration"] for r in self.results if "duration" in r]
        if durations:
            avg_duration = sum(durations) / len(durations)
            max_duration = max(durations)
            print(f"\n⚡ PERFORMANCE:")
            print(f"  Temps moyen: {avg_duration:.2f}s")
            print(f"  Temps max: {max_duration:.2f}s")
        
        # Sauvegarder les résultats
        with open("test_results.json", "w", encoding="utf-8") as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Résultats sauvegardés dans test_results.json")

def main():
    """Fonction principale."""
    tester = APITester()
    tester.run_all_tests()

if __name__ == "__main__":
    main() 