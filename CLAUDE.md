# CLAUDE.md

Ce fichier fournit des directives à Claude Code (claude.ai/code) lors du travail avec le code de ce dépôt.

## Commandes de Développement Courantes

### Exécution de l'Application
```bash
# Développement avec rechargement automatique
npm run dev

# Serveur de production
npm start

# Serveur de développement TypeScript (alternatif)
npm run ts-dev
```

### Tests
```bash
# Exécuter tous les tests
npm test

# Exécuter les tests avec couverture (seuil de 80% requis)
npm run test:coverage

# Exécuter un fichier de test spécifique
npx vitest tests/buildConstraintTable.test.ts

# Exécuter les tests en mode surveillance
npx vitest --watch
```

### Configuration de l'Environnement
```bash
# Copier le fichier d'environnement d'exemple
cp env.example .env

# Variables d'environnement requises :
# OPENAI_API_KEY - Pour les fonctionnalités d'analyse IA
# SESSION_SECRET - Pour les sessions sécurisées
# Optionnel : SUPABASE_URL, SUPABASE_ANON_KEY, STRIPE_SECRET_KEY
```

## Vue d'Ensemble de l'Architecture

### Architecture à Double Serveur
Le projet a évolué pour utiliser une **configuration à double serveur** :

1. **Serveur Express Hérité** (`server.js`) : Basé sur CommonJS avec fonctionnalités complètes d'application web
   - Modèles EJS, authentification, téléchargements de fichiers
   - Paiements Stripe, traitement PDF
   - SQLite/PostgreSQL avec ORM Sequelize
   - Middleware de sécurité complet

2. **Serveur TypeScript Moderne** (`src/server.ts`) : Serveur API basé sur ESM
   - Points de terminaison API purs pour l'analyse de propriétés
   - Proxy GeoAdmin pour les problèmes CORS
   - Optimisé pour les intégrations externes

Les deux serveurs peuvent fonctionner indépendamment sur des ports différents (3001 vs 3000).

### Pipeline d'Analyse Principal
Le cœur de l'application est l'**orchestrateur d'analyse de parcelles** (`src/lib/parcelAnalysisOrchestrator.ts`) :

```
Requête Utilisateur → Géocodage → Recherche Parcelle → Collecte Données Multi-sources → Analyse IA → Réponse Formatée
```

**Sources de Données Clés :**
- **API GeoAdmin** : Données géographiques fédérales suisses
- **Cadastre PLR** : Restrictions légales et zonage
- **Règlements Communaux** : Règles de construction locales (analyse PDF)
- **RDPPF** : Plans de développement régionaux
- **OpenAI** : Extraction et synthèse des contraintes

### Hybride TypeScript/CommonJS
- **src/** : Modules TypeScript modernes (ESM)
- **routes-node/, models-node/, services-node/** : Modules CommonJS hérités
- **ts-node** avec `transpileOnly: true` fait le pont
- Les deux architectures coexistent et peuvent s'importer mutuellement

### Architecture de Sécurité
L'implémentation de sécurité complète inclut :
- **Politique de Sécurité de Contenu** avec APIs externes autorisées
- **Limitation de débit multi-niveaux** : Général (1000/15min), Auth (5/15min), Upload (10/heure), IA (50/heure)
- **Sécurité de téléchargement de fichiers** : Validation MIME, vérification de signature, scan de malware
- **Protection CSRF** pour les opérations modifiant l'état
- **Sécurité de session** avec cookies httpOnly et application HTTPS

### Modèles d'Intégration IA
Deux modes d'analyse sont supportés :

1. **Analyse Complète** (`performComprehensiveAnalysis`) :
   - Collecte de données multi-API
   - Analyse de règlements PDF
   - Extraction structurée de contraintes
   - Synthèse GPT-4 avec prompts formatés

2. **Analyse Rapide** (`performQuickAnalysis`) :
   - Collecte de données de base
   - Temps de réponse plus rapides
   - Adapté pour les évaluations initiales

## Détails d'Implémentation Clés

### Stratégie de Base de Données
- **Principal** : PostgreSQL (Supabase) avec Sécurité au Niveau des Lignes
- **Secours** : SQLite pour le développement
- **Modèles** : ORM Sequelize avec support des deux environnements
- Test de connexion et logique de basculement automatique

### Modèles d'Intégration API
- **GeoAdmin** : APIs fédérales suisses pour recherche de parcelles et données cadastrales
- **PLR** : Données de restrictions légales avec analyseurs spécialisés
- **Règlements Communaux** : Analyse PDF avec secours OCR
- **OpenAI** : Ingénierie de prompts structurés pour l'analyse d'urbanisme

### Stratégie de Gestion d'Erreurs
- **Dégradation gracieuse** : Les sources de données manquantes ne cassent pas l'analyse
- **Score de complétude** : Suivi des taux de succès de collecte de données
- **Journalisation complète** : Suivi d'erreurs avec préservation du contexte
- **Erreurs conviviales** : Détails techniques cachés aux utilisateurs finaux

### Pipeline de Traitement de Fichiers
- **Téléchargements sécurisés** : Validation multi-couches (MIME, signature, taille)
- **Extraction PDF** : Extraction de texte avec analyse de données structurées
- **Intégration OCR** : Tesseract.js pour documents scannés
- **Nettoyage automatique** : Les téléchargements échoués sont immédiatement supprimés

### Logique Métier Spécifique au Valais
- **Calculs de densité** : Règles d'urbanisme spécifiques au canton
- **Cartographie communale** : Normalisation et recherche de noms de municipalités
- **Analyse de règlements** : Compréhension de la structure des documents d'urbanisme suisses
- **Extraction d'indices** : IBUS (densité de construction) et autres métriques de planification suisses

## Notes de Développement

### Ajout de Nouvelles Sources de Données
1. Créer un nouveau module dans `src/lib/`
2. Ajouter au pipeline orchestrateur dans `parcelAnalysisOrchestrator.ts`
3. Mettre à jour le calcul de complétude
4. Ajouter gestion d'erreurs et logique de secours

### Ingénierie de Prompts OpenAI
- Utiliser des prompts structurés avec sections de données claires
- Implémenter des contrôles de température (0 pour l'analyse factuelle)
- Inclure le contexte spécifique de l'urbanisme suisse
- Formater les contraintes dans une structure standardisée à 9 thèmes

### Stratégie de Tests
- **Tests unitaires** : Modules de sources de données individuelles
- **Tests d'intégration** : Pipeline d'analyse complet
- **Services mockés** : Simulation d'API externes
- **Exigences de couverture** : 80% minimum sur toutes les métriques

### Considérations de Sécurité
- Ne jamais exposer les clés API brutes dans les réponses
- Valider tous les téléchargements de fichiers avec plusieurs vérifications
- Implémenter CORS approprié pour les déploiements de production
- Utiliser des cookies HTTPS uniquement en production
- Limiter le débit de tous les appels d'API externes