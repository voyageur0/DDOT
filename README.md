# 🏔️ Application d'Analyse de Parcelles - Valais Romand

Une application web professionnelle permettant l'analyse automatique complète des parcelles dans le Valais Romand avec génération de rapports PDF. Utilise l'API VSGIS.ch et l'API GeoAdmin pour fournir des données précises et actualisées.

## 🚀 **Nouvelles Fonctionnalités Avancées**

### 🔍 **Interface Simplifiée**
- **Barre de recherche Google-style** : Interface épurée et intuitive
- **Suggestions automatiques** : Propositions en temps réel pendant la saisie
- **Recherche intelligente** : Adresses, numéros de parcelles, noms de lieux

### 📊 **Analyse Automatique Complète**
- **Surface constructible estimée** (m²)
- **Coefficient d'utilisation du sol**
- **Hauteur maximale autorisée**
- **Emprise au sol maximale** (%)
- **Distance aux limites** obligatoire
- **Zone d'affectation** (résidentielle, mixte, artisanale, agricole)
- **Potentiel de développement** avec scoring intelligent
- **Disponibilité des réseaux** (eau, électricité, gaz, égouts)

### 📄 **Rapport PDF Professionnel**
- **Génération automatique** de rapports complets
- **Design professionnel** adapté aux études de faisabilité
- **Données détaillées** organisées par sections
- **Prêt pour clients** et dossiers officiels

## 📋 Fonctionnalités Détaillées

### **🏗️ Constructibilité**
- Surface totale de la parcelle
- Surface constructible calculée
- Coefficient d'utilisation du sol (CUS)
- Densité de construction autorisée

### **📏 Contraintes Réglementaires**
- Hauteur maximale des constructions
- Pourcentage d'emprise au sol autorisé
- Distance minimale aux limites de propriété
- Pourcentage d'espace vert obligatoire

### **🌍 Informations Cadastrales**
- Zone d'affectation précise
- Accessibilité de la parcelle
- Disponibilité des réseaux publics
- Coordonnées géographiques

### **⚡ Potentiel de Développement**
- **Scoring automatique** sur 10 points
- **Évaluation globale** : Excellent / Bon / Moyen / Faible
- **Recommandations personnalisées**
- **Surface maximale théorique** constructible

## 🚀 Utilisation

### **1. Recherche Simple**
1. **Tapez votre recherche** dans la barre (comme sur Google)
   - Adresse complète : "Rue de la Gare 15, Sion"
   - Numéro de parcelle : "1234"
   - Nom de lieu : "Martigny centre"

2. **Sélectionnez** une suggestion dans la liste déroulante

3. **L'analyse se lance automatiquement** !

### **2. Consultation des Résultats**
- **Vue d'ensemble** : Informations principales de la parcelle
- **4 sections détaillées** : Constructibilité, contraintes, cadastre, potentiel
- **Scoring visuel** avec codes couleur et émojis

### **3. Génération de Rapport PDF**
- **Cliquez sur "📄 Générer PDF"**
- **Téléchargement automatique** du rapport complet
- **Nom de fichier intelligent** avec date et référence parcelle

## 🌐 APIs et Sources de Données

### **API GeoAdmin (api3.geo.admin.ch)**
- Service de recherche géographique
- Données cadastrales officielles
- Informations communales
- Coordonnées précises

### **Intégration VSGIS.ch**
- Compatible avec le système d'information géographique valaisan
- Données spécifiques au canton du Valais
- Informations de zonage actualisées

### **Données Enrichies**
- Calculs automatiques de constructibilité
- Scoring de potentiel de développement
- Recommandations personnalisées
- Analyse des contraintes réglementaires

## 🎨 Caractéristiques Techniques

### **Frontend Moderne**
- **HTML5** avec CSS3 avancé
- **JavaScript ES6+** (pas de frameworks lourds)
- **Design responsive** mobile-first
- **Interface intuitive** et rapide

### **Fonctionnalités Avancées**
- **Recherche en temps réel** avec debouncing
- **Suggestions intelligentes** avec cache
- **Gestion d'erreurs** robuste
- **Loading states** avec animations

### **Génération PDF**
- **jsPDF** pour génération côté client
- **Mise en page professionnelle**
- **Sections organisées** et lisibles
- **Métadonnées incluses**

## 📱 Compatibilité

- ✅ **Chrome/Chromium** (recommandé)
- ✅ **Firefox** 
- ✅ **Safari** (macOS/iOS)
- ✅ **Edge**
- ✅ **Mobile** (responsive design)

## 🎯 Cas d'Usage

### **Professionnels de l'Immobilier**
- Évaluation rapide de parcelles
- Études de faisabilité préliminaires
- Rapports pour clients

### **Architectes et Urbanistes**
- Analyse de contraintes de construction
- Calcul de potentiel de développement
- Documentation de projets

### **Investisseurs**
- Évaluation de potentiel immobilier
- Due diligence simplifiée
- Rapports de synthèse

### **Particuliers**
- Compréhension des règles de construction
- Évaluation avant achat
- Information sur zonage

## 🔧 Installation et Lancement

### **Installation Locale**
1. **Téléchargez** les fichiers `index.html` et `README.md`
2. **Ouvrez** `index.html` dans votre navigateur
3. **C'est tout !** Aucune installation supplémentaire

### **Hébergement Web**
- **Upload** sur votre serveur web
- **Compatible** avec tous les hébergeurs
- **Fonctionne** en HTTPS (recommandé)

## 🛡️ Sécurité et Confidentialité

- **Aucune donnée stockée** sur des serveurs tiers
- **APIs officielles** suisses sécurisées
- **Traitement local** des données
- **Respect RGPD** complet

## 📊 Exemple de Rapport Généré

Le rapport PDF inclut :

```
📍 INFORMATIONS GÉNÉRALES
• Parcelle et localisation
• Zone d'affectation
• Date d'analyse

🏗️ CONSTRUCTIBILITÉ  
• Surface totale et constructible
• Coefficient d'utilisation
• Densité autorisée

📏 CONTRAINTES RÉGLEMENTAIRES
• Hauteur maximale
• Emprise au sol
• Distances aux limites
• Espace vert minimum

⚡ POTENTIEL DE DÉVELOPPEMENT
• Score de constructibilité /10
• Niveau global (🟢🟡🟠🔴)
• Recommandations personnalisées

🔌 RÉSEAUX DISPONIBLES
• Eau, électricité, gaz, égouts
• Accessibilité de la parcelle
```

## 🔧 Dépannage

### **Problèmes de Recherche**
- Vérifiez votre connexion internet
- Essayez une formulation différente
- Utilisez les suggestions automatiques

### **Erreurs d'API**
- Les APIs publiques peuvent avoir des limites
- Réessayez après quelques minutes
- Vérifiez que votre navigateur autorise les requêtes HTTPS

### **Génération PDF**
- Assurez-vous d'avoir effectué une recherche d'abord
- Vérifiez que votre navigateur autorise les téléchargements
- Testez avec Chrome pour une compatibilité optimale

## 🔮 Développements Futurs

### **Intégrations Prévues**
- API directe VSGIS.ch (quand disponible)
- Données de prix immobiliers
- Cartes interactives
- Photos aériennes

### **Fonctionnalités en Projet**
- Comparaison de parcelles
- Alertes de changement de zonage
- Historique des analyses
- API pour développeurs

## 📄 Licence et Conditions

Cette application utilise exclusivement des **données publiques suisses** et respecte toutes les conditions d'utilisation des APIs officielles.

**Avertissement** : Ce rapport est généré automatiquement à titre informatif. Pour des informations officielles définitives, consultez toujours les services cadastraux et d'urbanisme compétents.

## 🤝 Support et Contribution

- **Suggestions** : N'hésitez pas à proposer des améliorations
- **Bugs** : Signalez les problèmes rencontrés
- **Contributions** : Le code est ouvert aux améliorations

---

**🎯 Application prête à l'emploi pour l'analyse professionnelle de parcelles dans le Valais Romand !**

# DDOT - Système d'analyse cadastrale avec IA pour le Valais

Système avancé d'analyse immobilière pour le Valais avec Intelligence Artificielle.

## 🚀 Fonctionnalités

- **Recherche intelligente** : Suggestions automatiques d'adresses et parcelles
- **Analyse IA** : Contraintes urbanistiques automatisées via OpenAI
- **Données publiques** : Intégration GeoAdmin et règlements communaux
- **Interface moderne** : Design responsive et expérience utilisateur optimisée

## 🛠 Installation locale

```bash
npm install
cp env.example .env
# Configurez votre clé OpenAI dans .env
npm run dev
```

## 🌐 Déploiement Infomaniak

### 1. Préparer le projet
```bash
npm run build
```

### 2. Configurer les variables d'environnement
```bash
NODE_ENV=production
OPENAI_API_KEY=sk-your-key-here
PORT=3000
FRONTEND_URL=https://your-domain.infomaniak.ch
```

### 3. Commandes de déploiement
```bash
npm start  # Lance le serveur en production
```

## 📁 Structure du projet

```
├── src/
│   ├── server.ts          # Serveur Express principal
│   └── routes/            # Routes API
├── public/
│   ├── index.html         # Interface utilisateur
│   └── favicon.ico
├── package.json           # Configuration npm
└── tsconfig.json         # Configuration TypeScript
```

## 🔐 Sécurité

- Helmet.js pour les headers de sécurité
- CORS configuré pour la production
- Variables d'environnement pour les clés API
- HTTPS forcé en production

## 👥 Développé par

Blendar Berisha et Oktay Demir, Idée et Marketing par Dylan Taccoz 

# Urban IA - Analyse Intelligente de Documents d'Urbanisme

Application web Node.js pour l'analyse automatique de documents d'urbanisme (règlements, extraits de cadastre) avec intelligence artificielle.

## Fonctionnalités

### Version Gratuite
- 📄 **Extraction PDF** : Extraction automatique du texte et des tableaux
- 📊 **Données structurées** : Affichage des règles d'urbanisme extraites (IBUS, hauteurs, distances)
- 🔍 **Recherche sémantique** : Recherche intelligente dans vos documents
- 📈 **Analyse de base** : Visualisation des coefficients et contraintes

### Version Premium (19,99€/mois)
- 🤖 **Synthèse IA** : Résumés intelligents générés par GPT
- 📋 **Tableau de faisabilité** : Analyse automatique de conformité
- 💬 **Questions-Réponses** : Posez vos questions à l'IA sur vos documents
- 📑 **Rapports détaillés** : Exportez des analyses complètes

## Technologies utilisées

- **Backend** : Node.js, Express.js
- **Base de données** : SQLite (Sequelize ORM)
- **Authentification** : Passport.js
- **IA** : OpenAI API (GPT-3.5)
- **Recherche vectorielle** : Embeddings OpenAI + recherche en mémoire
- **Extraction PDF** : pdf-parse, Tesseract.js (OCR)
- **Paiements** : Stripe
- **Frontend** : EJS, Bootstrap 5

## Installation

### Prérequis
- Node.js 18+
- npm ou yarn
- Clé API OpenAI
- Compte Stripe (pour les paiements)

### Configuration

1. Cloner le projet
```bash
git clone https://github.com/votre-repo/urban-ia.git
cd urban-ia
```

2. Installer les dépendances
```bash
npm install
```

3. Créer un fichier `.env` à partir de l'exemple
```bash
cp .env.example .env
```

4. Configurer les variables d'environnement dans `.env`
```env
# Configuration Node.js
NODE_ENV=development
PORT=5000

# Session Secret
SESSION_SECRET=votre-secret-de-session-très-sécurisé

# OpenAI API Key
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_votre_clé_stripe_secrète
STRIPE_WEBHOOK_SECRET=whsec_votre_secret_webhook_stripe

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:5000
```

### Lancement

En développement :
```bash
npm run dev
```

En production :
```bash
npm start
```

L'application sera accessible sur http://localhost:5000

## Structure du projet

```
urban-ia/
├── config/             # Configuration (Passport)
├── data/               # Stockage de l'index vectoriel
├── models-node/        # Modèles Sequelize
├── routes-node/        # Routes Express
│   ├── auth.js         # Authentification
│   ├── documents.js    # Gestion des documents
│   ├── analysis.js     # Analyses IA (premium)
│   └── payment.js      # Paiements Stripe
├── services-node/      # Services métier
│   ├── pdfService.js   # Extraction PDF
│   ├── openaiService.js # Intégration OpenAI
│   └── vectorService.js # Recherche vectorielle
├── uploads/            # Stockage des PDFs uploadés
├── views/              # Templates EJS
├── server.js           # Serveur principal
└── package.json
```

## API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/status` - Statut de connexion

### Documents
- `GET /api/documents` - Liste des documents
- `GET /api/documents/:id` - Détails d'un document
- `DELETE /api/documents/:id` - Supprimer un document
- `POST /api/documents/search` - Recherche sémantique
- `POST /api/upload` - Upload d'un document

### Analyses (Premium)
- `POST /api/analysis/summary` - Générer un résumé
- `POST /api/analysis/feasibility-table` - Tableau de faisabilité
- `POST /api/analysis/ask-question` - Poser une question
- `GET /api/analysis/history` - Historique des analyses

### Paiements
- `POST /api/payment/create-checkout-session` - Créer une session Stripe
- `POST /api/payment/webhook` - Webhook Stripe
- `GET /api/payment/subscription-status` - Statut de l'abonnement
- `POST /api/payment/cancel-subscription` - Annuler l'abonnement

## Déploiement

### Heroku
1. Créer une application Heroku
2. Ajouter les variables d'environnement
3. Déployer avec Git

### Docker
Un Dockerfile peut être créé pour containeriser l'application.

## Sécurité

- Sessions sécurisées avec express-session
- Mots de passe hashés avec bcrypt
- Protection CSRF
- Validation des entrées utilisateur
- Limitation du taux de requêtes recommandée

## Contribution

Les contributions sont les bienvenues ! Merci de :
1. Fork le projet
2. Créer une branche feature
3. Commiter vos changements
4. Pusher vers la branche
5. Ouvrir une Pull Request

## Licence

Ce projet est sous licence MIT. 