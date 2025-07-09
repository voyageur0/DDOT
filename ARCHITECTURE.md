# 🏗️ Architecture DDOT - Backend Node.js Simplifié

## 📋 Vue d'ensemble

**DDOT** utilise une **architecture simple et épurée** avec :
- **Backend unique** : Node.js/TypeScript (Express.js)
- **Base de données** : SQLite (dev) / PostgreSQL (prod) via Sequelize
- **Frontend** : HTML/CSS/JS vanilla avec interface moderne
- **IA** : Intégration OpenAI pour analyses intelligentes

## 🎯 Philosophie architecturale

### ✅ **Avantages de cette approche :**
- **Simplicité maximale** : Un seul serveur, une seule stack
- **Performance** : Node.js optimisé pour les APIs web
- **Maintenabilité** : Code unifié et cohérent
- **Sécurité** : Surface d'attaque minimale
- **Rapidité de développement** : Pas de complexité multi-langages

## 🏛️ Structure du projet simplifiée

```
DDOT/
├── 📦 Backend Node.js (Unique)
│   ├── server.js                 # Serveur Express principal
│   ├── src/                      # Code TypeScript
│   │   ├── routes/              # Routes API TypeScript
│   │   │   ├── iaConstraints.ts # Analyses IA principales
│   │   │   ├── owners.ts        # Gestion propriétaires
│   │   │   └── utils.ts         # Utilitaires routes
│   │   ├── lib/                 # Librairies métier
│   │   │   ├── geoAdmin.ts      # Intégration GeoAdmin
│   │   │   ├── plrCadastre.ts   # Données cadastrales
│   │   │   └── communalRegulations.ts # Règlements communaux
│   │   └── utils/               # Utilitaires
│   │       ├── openai.ts        # Client OpenAI
│   │       └── retry.ts         # Gestion des erreurs
│   ├── routes-node/             # Routes Express JavaScript
│   │   ├── auth.js              # Authentification
│   │   ├── analysis.js          # Analyses générales
│   │   └── documents.js         # Gestion documents
│   ├── services-node/           # Services métier
│   │   ├── openaiService.js     # Service OpenAI principal
│   │   └── vectorService.js     # Recherche sémantique
│   └── models-node/             # Modèles Sequelize
│       ├── index.js             # Configuration DB
│       ├── User.js              # Modèle utilisateur
│       └── Document.js          # Modèle document
│
├── 🌐 Frontend
│   ├── public/                  # Interface utilisateur principale
│   │   └── index.html           # SPA moderne
│   ├── views/                   # Templates EJS
│   └── templates/               # Templates alternatifs
│
├── 📊 Données & Configuration
│   ├── reglements/              # Règlements PDF communaux
│   ├── uploads/                 # Fichiers uploadés (si nécessaire)
│   ├── config/                  # Configuration
│   │   ├── passport.js          # Auth strategies
│   │   └── supabase.js          # DB config
│   └── scripts/                 # Scripts utilitaires
```

## 🔄 Flux de traitement principal

### **1. Analyse de parcelle IA** (Flux principal)
```
Client → Express → iaConstraints.ts → OpenAI → Réponse formatée
```

### **2. Recherche géographique**
```
Client → GeoAdmin API → Parsing → Enrichissement → Client
```

### **3. Authentification** (Optionnelle)
```
Client → Passport.js → Supabase/SQLite → Session → Client
```

## ⚙️ Services principaux

### 🟢 **Services Node.js Core**

| Service | Fichier | Responsabilité |
|---------|---------|----------------|
| **OpenAI** | `services-node/openaiService.js` | Intégrations GPT, embeddings, analyses |
| **IA Constraints** | `src/routes/iaConstraints.ts` | Analyses automatisées de parcelles |
| **GeoAdmin** | `src/lib/geoAdmin.ts` | Données cadastrales officielles |
| **Auth** | `routes-node/auth.js` | Authentification utilisateurs |
| **Vector Search** | `services-node/vectorService.js` | Recherche dans règlements |

### 🎯 **Fonctionnalités principales**

| Fonctionnalité | Endpoint | Description |
|----------------|----------|-------------|
| **Analyse IA automatique** | `POST /api/ia-constraints` | Analyse complète parcelle + IA |
| **Recherche IA dans règlements** | `POST /api/analysis/search` | Questions sur règlements communaux |
| **Téléchargement règlement** | `GET /api/regulation/:commune` | PDF règlement communal |
| **Données cadastrales** | Via GeoAdmin API | Informations officielles |

## 🚀 Déploiement simplifié

### **Installation**
```bash
# Installation unique
npm install

# Configuration
cp .env.example .env
# Éditer .env avec votre clé OpenAI

# Démarrage
npm start
```

### **Aucune dépendance externe**
- ❌ **Pas de Python** requis
- ❌ **Pas d'OCR** ou PDF complexe
- ❌ **Pas de Docker** nécessaire
- ✅ **Seulement Node.js** et une clé OpenAI

## 🔧 Configuration minimale

### **Variables d'environnement (.env)**
```bash
# OpenAI (obligatoire)
OPENAI_API_KEY=sk-proj-votre-cle

# Serveur
NODE_ENV=development
PORT=3001

# Base de données (optionnel - SQLite par défaut)
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...

# Session
SESSION_SECRET=votre-secret-fort
```

## 🔌 APIs essentielles

### **Analyse IA de parcelle** 🤖
```javascript
POST /api/ia-constraints
{
  "searchQuery": "Sion rue du Rhône 12",
  "analysisType": "complete"
}
```

**Réponse :**
```javascript
{
  "constraints": "Analyse IA formatée...",
  "comprehensiveData": {...},
  "completeness": 85,
  "source": "Analyse approfondie multi-étapes + OpenAI"
}
```

### **Recherche IA dans règlements** 🔍
```javascript
POST /api/analysis/search
{
  "query": "Hauteur maximale en zone résidentielle",
  "communeFilter": "Sion"
}
```

### **Téléchargement règlement** 📚
```javascript
GET /api/regulation/sion
// Retourne le PDF du règlement de Sion
```

## 🛡️ Sécurité

### **Mesures en place**
- **Helmet.js** : Headers de sécurité
- **CORS** configuré
- **Rate limiting** : Protection contre spam
- **express-validator** : Validation entrées
- **Sessions sécurisées** : httpOnly, secure

### **Données**
- **APIs publiques** uniquement (GeoAdmin, VSGIS)
- **Règlements publics** (documents officiels)
- **Aucune donnée sensible** stockée

## 📊 Monitoring

### **Logs simplifiés**
```bash
# Démarrage
✅ Serveur Urban IA démarré sur http://localhost:3001

# Analyses IA
🔍 Démarrage analyse automatisée pour: "Sion rue du Rhône 12"
📊 Données collectées (85% complétude) - Envoi à OpenAI...
✅ Analyse automatisée complète terminée en 3200ms

# Authentification
🔑 Utilisateur connecté: user@example.com
```

## 🎯 Différenciation par rapport à avant

### **✅ Supprimé (Simplifications)**
- ❌ Jobs batch Python
- ❌ Extraction PDF/OCR complexe
- ❌ Dépendances Python (pdfplumber, tesseract, etc.)
- ❌ Scripts d'extraction avancés
- ❌ Configuration hybride Node.js/Python

### **✅ Conservé (Fonctionnalités principales)**
- ✅ Analyse IA de parcelles
- ✅ Recherche dans règlements communaux
- ✅ Interface moderne
- ✅ Intégration GeoAdmin
- ✅ Authentification
- ✅ Base de données

### **✅ Amélioré**
- ✅ Architecture plus simple
- ✅ Déploiement plus facile
- ✅ Moins de dépendances
- ✅ Performance optimisée

## 🚀 Roadmap

### **Phase actuelle** ✅
- [x] Architecture simplifiée
- [x] Suppression PDF/OCR
- [x] Backend Node.js pur
- [x] Tests de fonctionnement

### **Prochaines étapes** 🔄
- [ ] Optimisations performance
- [ ] Interface utilisateur améliorée
- [ ] Documentation API complète
- [ ] Monitoring avancé

---

**🎯 Résultat** : Application **ultra-simple**, **performante** et **facile à maintenir** - Focus sur l'essentiel : l'analyse IA de parcelles ! 