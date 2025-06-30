"""
Module de base de données SQLite pour Urban-AI Valais
Stockage des analyses, métriques et historique des requêtes
"""

import sqlite3
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

class Database:
    def __init__(self, db_path: str = "urban_ai.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialise la base de données avec les tables nécessaires."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Table des analyses
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS analyses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    commune TEXT NOT NULL,
                    parcelle TEXT NOT NULL,
                    rdppf_data TEXT,
                    rules_data TEXT,
                    report_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    execution_time REAL,
                    success BOOLEAN DEFAULT 1,
                    error_message TEXT
                )
            """)
            
            # Table des métriques de performance
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS performance_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    function_name TEXT NOT NULL,
                    execution_time REAL NOT NULL,
                    success BOOLEAN DEFAULT 1,
                    error_message TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    commune TEXT,
                    parcelle TEXT
                )
            """)
            
            # Table des requêtes API
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS api_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    endpoint TEXT NOT NULL,
                    commune TEXT,
                    parcelle TEXT,
                    duration REAL NOT NULL,
                    success BOOLEAN DEFAULT 1,
                    error_message TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    user_agent TEXT,
                    ip_address TEXT
                )
            """)
            
            # Table des utilisateurs (pour future authentification)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1
                )
            """)
            
            # Table des rapports PDF générés
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pdf_reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    analysis_id INTEGER,
                    filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    file_size INTEGER,
                    FOREIGN KEY (analysis_id) REFERENCES analyses (id)
                )
            """)
            
            conn.commit()
    
    def save_analysis(self, commune: str, parcelle: str, rdppf_data: Dict, 
                     rules_data: Dict, report_data: str, execution_time: float, 
                     success: bool = True, error_message: str = None) -> int:
        """Sauvegarde une analyse complète."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO analyses (commune, parcelle, rdppf_data, rules_data, 
                                    report_data, execution_time, success, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                commune, parcelle, 
                json.dumps(rdppf_data, ensure_ascii=False),
                json.dumps(rules_data, ensure_ascii=False),
                report_data, execution_time, success, error_message
            ))
            conn.commit()
            return cursor.lastrowid
    
    def save_performance_metric(self, function_name: str, execution_time: float,
                              success: bool = True, error_message: str = None,
                              commune: str = None, parcelle: str = None):
        """Sauvegarde une métrique de performance."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO performance_metrics (function_name, execution_time, 
                                               success, error_message, commune, parcelle)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (function_name, execution_time, success, error_message, commune, parcelle))
            conn.commit()
    
    def save_api_request(self, endpoint: str, duration: float, success: bool = True,
                        error_message: str = None, commune: str = None, 
                        parcelle: str = None, user_agent: str = None, 
                        ip_address: str = None):
        """Sauvegarde une requête API."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO api_requests (endpoint, commune, parcelle, duration, 
                                        success, error_message, user_agent, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (endpoint, commune, parcelle, duration, success, 
                  error_message, user_agent, ip_address))
            conn.commit()
    
    def save_pdf_report(self, analysis_id: int, filename: str, file_path: str, 
                       file_size: int = None) -> int:
        """Sauvegarde les informations d'un rapport PDF généré."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO pdf_reports (analysis_id, filename, file_path, file_size)
                VALUES (?, ?, ?, ?)
            """, (analysis_id, filename, file_path, file_size))
            conn.commit()
            return cursor.lastrowid
    
    def get_analysis_by_id(self, analysis_id: int) -> Optional[Dict]:
        """Récupère une analyse par son ID."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM analyses WHERE id = ?
            """, (analysis_id,))
            row = cursor.fetchone()
            
            if row:
                return {
                    'id': row[0],
                    'commune': row[1],
                    'parcelle': row[2],
                    'rdppf_data': json.loads(row[3]) if row[3] else None,
                    'rules_data': json.loads(row[4]) if row[4] else None,
                    'report_data': row[5],
                    'created_at': row[6],
                    'execution_time': row[7],
                    'success': bool(row[8]),
                    'error_message': row[9]
                }
            return None
    
    def get_analysis_by_commune_parcelle(self, commune: str, parcelle: str) -> Optional[Dict]:
        """Récupère la dernière analyse pour une commune/parcelle."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM analyses 
                WHERE commune = ? AND parcelle = ? AND success = 1
                ORDER BY created_at DESC 
                LIMIT 1
            """, (commune, parcelle))
            row = cursor.fetchone()
            
            if row:
                return {
                    'id': row[0],
                    'commune': row[1],
                    'parcelle': row[2],
                    'rdppf_data': json.loads(row[3]) if row[3] else None,
                    'rules_data': json.loads(row[4]) if row[4] else None,
                    'report_data': row[5],
                    'created_at': row[6],
                    'execution_time': row[7],
                    'success': bool(row[8]),
                    'error_message': row[9]
                }
            return None
    
    def get_recent_analyses(self, limit: int = 10) -> List[Dict]:
        """Récupère les analyses récentes."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, commune, parcelle, created_at, execution_time, success
                FROM analyses 
                ORDER BY created_at DESC 
                LIMIT ?
            """, (limit,))
            
            return [
                {
                    'id': row[0],
                    'commune': row[1],
                    'parcelle': row[2],
                    'created_at': row[3],
                    'execution_time': row[4],
                    'success': bool(row[5])
                }
                for row in cursor.fetchall()
            ]
    
    def get_performance_stats(self, days: int = 7) -> Dict[str, Any]:
        """Récupère les statistiques de performance."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Statistiques générales
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_requests,
                    AVG(duration) as avg_duration,
                    MAX(duration) as max_duration,
                    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests
                FROM api_requests 
                WHERE timestamp >= datetime('now', '-{} days')
            """.format(days))
            
            stats_row = cursor.fetchone()
            
            # Statistiques par fonction
            cursor.execute("""
                SELECT 
                    function_name,
                    COUNT(*) as calls,
                    AVG(execution_time) as avg_time,
                    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count
                FROM performance_metrics 
                WHERE timestamp >= datetime('now', '-{} days')
                GROUP BY function_name
            """.format(days))
            
            function_stats = [
                {
                    'function_name': row[0],
                    'calls': row[1],
                    'avg_time': row[2],
                    'success_count': row[3],
                    'success_rate': (row[3] / row[1]) * 100 if row[1] > 0 else 0
                }
                for row in cursor.fetchall()
            ]
            
            return {
                'total_requests': stats_row[0],
                'avg_duration': stats_row[1],
                'max_duration': stats_row[2],
                'successful_requests': stats_row[3],
                'success_rate': (stats_row[3] / stats_row[0]) * 100 if stats_row[0] > 0 else 0,
                'function_stats': function_stats
            }
    
    def get_database_stats(self) -> Dict[str, Any]:
        """Récupère les statistiques de la base de données."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Compter les enregistrements dans chaque table
            tables = ['analyses', 'performance_metrics', 'api_requests', 'pdf_reports']
            stats = {}
            
            for table in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                stats[f'{table}_count'] = cursor.fetchone()[0]
            
            # Taille de la base de données
            db_size = Path(self.db_path).stat().st_size if Path(self.db_path).exists() else 0
            
            return {
                **stats,
                'database_size_bytes': db_size,
                'database_size_mb': round(db_size / (1024 * 1024), 2)
            }

# Instance globale de la base de données
db = Database() 