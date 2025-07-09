# 🔐 Mesures de Sécurité - Projet DDOT

## Vue d'ensemble

Ce document décrit toutes les mesures de sécurité mises en place dans le projet DDOT pour protéger l'application et les données des utilisateurs.

## ✅ Mesures de sécurité implémentées

### 🔒 1. Gestion des secrets et configurations

- **Secrets externalisés** : Toutes les clés API et secrets sont gérés via des variables d'environnement (`.env`)
- **Validation obligatoire** : La clé OpenAI est obligatoire et vérifiée au démarrage
- **Rotation de session** : Secret de session généré cryptographiquement avec `crypto.randomBytes(64)`

### 🛡️ 2. Headers de sécurité (Helmet.js)

- **Content Security Policy (CSP)** : Politique stricte limitant les sources autorisées
- **X-Frame-Options** : Protection contre le clickjacking (DENY)
- **X-Content-Type-Options** : Protection contre le MIME sniffing (nosniff)
- **X-XSS-Protection** : Protection XSS native du navigateur
- **Referrer Policy** : Contrôle des informations de référent (same-origin)
- **HSTS** : HTTPS Strict Transport Security en production (1 an)

### 🔐 3. Protection CSRF

- **Tokens CSRF** : Protection complète contre les attaques Cross-Site Request Forgery
- **Routes protégées** : Toutes les routes sensibles (POST, PUT, DELETE) sont protégées
- **Exceptions contrôlées** : Webhooks et API publiques correctement exemptés
- **SameSite cookies** : Configuration `strict` pour une protection supplémentaire

### 🔑 4. Authentification sécurisée

- **Suppression du système insécurisé** : Élimination du stockage de mots de passe en localStorage
- **Passport.js** : Système d'authentification robuste côté serveur
- **Sessions sécurisées** : Configuration httpOnly, secure, sameSite
- **Validation forte** : Mots de passe avec 8+ caractères, majuscules, minuscules, chiffres et caractères spéciaux

### ✅ 5. Validation des données

- **Express-validator** : Validation stricte de toutes les entrées utilisateur
- **Sanitisation** : Nettoyage des données avec `trim()` et `escape()`
- **Limites de taille** : Contrôle de la longueur des champs (ex: questions 5-500 caractères)
- **Types de données** : Validation des types (emails, entiers, etc.)

### 📁 6. Upload de fichiers sécurisé

- **Types MIME stricts** : Seulement PDF, JPEG, PNG, WebP autorisés
- **Vérification double** : Extension ET type MIME vérifiés
- **Signature de fichier** : Validation des headers/signatures des fichiers
- **Noms sécurisés** : Génération de noms avec timestamps et hash cryptographique
- **Limitations** : 25MB max, 1 fichier à la fois
- **Scan basique** : Détection de fichiers vides et signatures invalides
- **Caractères dangereux** : Filtrage des caractères non autorisés dans les noms

### ⏱️ 7. Rate Limiting

- **Général** : 1000 requêtes/15min par IP (hors assets statiques)
- **Authentification** : 5 tentatives/15min (protection brute force)
- **Uploads** : 10 fichiers/heure maximum
- **Analyses IA** : 50 analyses/heure pour éviter l'abus de l'API
- **Headers standard** : Informations de limitation exposées proprement

### 🚨 8. Gestion d'erreurs sécurisée

- **Logs détaillés** : Journalisation complète côté serveur avec contexte
- **Exposition minimale** : Messages d'erreur génériques pour les clients
- **Gestion spécialisée** : Traitement spécifique par type d'erreur (Multer, Sequelize, etc.)
- **Mode développement** : Stack traces uniquement en développement
- **Nettoyage automatique** : Suppression des fichiers en cas d'erreur d'upload

### 🍪 9. Configuration des sessions

- **Nom personnalisé** : `ddot.sid` pour éviter l'empreinte digitale
- **HttpOnly** : Cookies inaccessibles via JavaScript
- **Secure** : HTTPS uniquement en production
- **SameSite strict** : Protection CSRF supplémentaire
- **Expiration** : 24 heures maximum
- **Pas de sessions inutiles** : `saveUninitialized: false`

### 📦 10. Dépendances sécurisées

- **Audit régulier** : Vérification des vulnérabilités avec `npm audit`
- **Mises à jour** : Corrections de sécurité appliquées quand possible
- **Isolation dev/prod** : Vulnérabilités de dev n'affectent pas la production

## 🔍 Points d'attention

### Vulnérabilités restantes (non critiques)

- **Outils de développement** : Vulnérabilités dans vitest/vite/esbuild (développement uniquement)
- **Impact** : Aucun en production, ces outils ne sont pas utilisés côté serveur

### Recommandations pour le déploiement

1. **Variables d'environnement** : 
   - `OPENAI_API_KEY` : Votre clé API OpenAI
   - `SESSION_SECRET` : Secret cryptographiquement fort (64+ caractères)
   - `NODE_ENV=production` : Activer les protections de production

2. **HTTPS obligatoire** : En production, utiliser uniquement HTTPS

3. **Monitoring** : Surveiller les logs d'erreurs pour détecter les tentatives d'attaque

4. **Sauvegardes** : Sauvegarder régulièrement la base de données SQLite

## 🛠️ Tests de sécurité

Pour vérifier la sécurité de l'application :

```bash
# Vérifier les dépendances
npm audit

# Tester les headers de sécurité
curl -I http://localhost:3001

# Tester le rate limiting
# (faire plusieurs requêtes rapides sur /api/auth/login)

# Tester l'upload de fichiers malveillants
# (essayer d'uploader des fichiers avec de mauvaises extensions)
```

## 📞 Contact sécurité

En cas de découverte d'une vulnérabilité de sécurité, veuillez contacter l'équipe de développement :
- Développeurs : Blendar Berisha et Oktay Demir
- Marketing : Dylan Taccoz

---

**Note** : Cette documentation doit être mise à jour à chaque modification des mesures de sécurité. 