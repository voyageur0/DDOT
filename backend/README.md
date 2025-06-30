# 🏗️ Urban-AI Valais - API Backend

API d'analyse urbaine pour les parcelles valaisannes, intégrant les données RDPPF et les règlements communaux.

## 🚀 Fonctionnalités

- **Analyse RDPPF** : Récupération des données officielles RDPPF pour les parcelles valaisannes
- **Recherche RAG** : Système de recherche intelligente dans les règlements communaux
- **Génération de rapports** : Rapports structurés croisant RDPPF et règlements
- **Monitoring** : Métriques de performance et logs détaillés
- **Cache intelligent** : Optimisation des performances avec cache RAG
- **Documentation API** : Interface Swagger/OpenAPI complète

## 📋 Prérequis

- Python 3.8+
- ChromaDB
- OpenAI API Key
- Règlements communaux ingérés

## 🛠️ Installation

1. **Cloner le projet**
```bash
cd backend
```

2. **Installer les dépendances**
```bash
pip install -r requirements.txt
```

3. **Configuration des variables d'environnement**
```bash
cp env.example .env
# Éditer .env avec vos clés API
```

4. **Ingestion des règlements** (si pas déjà fait)
```bash
python ingest_reglement.py
```

## 🚀 Démarrage

### Mode développement
```bash
python -c "from main import app; import uvicorn; uvicorn.run(app, host='0.0.0.0', port=8000, reload=True)"
```

### Mode production
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 📚 API Endpoints

### 🔍 Analyse
- `GET /analyse?commune=Lens&parcelle=5217` - Récupère les données RDPPF brutes

### 📄 Rapports
- `GET /rapport?commune=Lens&parcelle=5217` - Génère un rapport complet d'analyse

### 🏥 Système
- `GET /health` - Vérification de l'état de santé
- `GET /metrics` - Métriques de performance
- `DELETE /cache` - Vide le cache de recherche

### 📖 Documentation
- `GET /docs` - Interface Swagger
- `GET /redoc` - Documentation ReDoc

## 🧪 Tests

### Tests automatisés
```bash
python test_api.py
```

### Tests manuels
```bash
# Test de santé
curl http://localhost:8000/health

# Test d'analyse
curl "http://localhost:8000/analyse?commune=Lens&parcelle=5217"

# Test de rapport
curl "http://localhost:8000/rapport?commune=Lens&parcelle=5217"
```

## 📊 Monitoring

### Métriques disponibles
- Temps d'exécution par fonction
- Taux de réussite des requêtes
- Statistiques RAG (nombre de documents, cache)
- Logs détaillés dans `urban_ai.log`

### Visualisation des métriques
```bash
curl http://localhost:8000/metrics | jq
```

## 🔧 Configuration

### Variables d'environnement
```env
OPENAI_API_KEY=your_openai_api_key
CHROMA_DB_PATH=chroma_db
LOG_LEVEL=INFO
```

### Paramètres de performance
- Timeout RDPPF : 60 secondes
- Cache RAG : Activé par défaut
- Logs : Fichier + console

## 📁 Structure du projet

```
backend/
├── main.py              # API FastAPI principale
├── rdppf.py             # Module RDPPF
├── rag.py               # Système RAG
├── llm.py               # Génération de rapports
├── communes_vs.py       # Mapping des communes
├── utils/
│   └── logger.py        # Système de logging
├── test_api.py          # Tests automatisés
├── requirements.txt     # Dépendances
└── README.md           # Documentation
```

## 🔍 Exemples d'utilisation

### Analyse simple
```python
import requests

response = requests.get(
    "http://localhost:8000/analyse",
    params={"commune": "Lens", "parcelle": "5217"}
)
data = response.json()
print(f"Zone: {data['rdppf']['Extract']['RealEstate']['RestrictionOnLandownership']}")
```

### Rapport complet
```python
response = requests.get(
    "http://localhost:8000/rapport",
    params={"commune": "Lens", "parcelle": "5217"}
)
report = response.json()
print(report['report'])
```

## 🐛 Dépannage

### Erreurs communes

1. **Timeout RDPPF**
   - Le service RDPPF peut être lent
   - Vérifier la connectivité réseau
   - Augmenter le timeout si nécessaire

2. **Erreur ChromaDB**
   - Vérifier que les règlements sont ingérés
   - Redémarrer le service
   - Vérifier les permissions sur `chroma_db/`

3. **Erreur OpenAI**
   - Vérifier la clé API dans `.env`
   - Vérifier les quotas OpenAI

### Logs
```bash
tail -f urban_ai.log
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature
3. Commiter les changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT.

## 📞 Support

Pour toute question ou problème :
- Ouvrir une issue sur GitHub
- Consulter la documentation API sur `/docs`
- Vérifier les logs dans `urban_ai.log` 