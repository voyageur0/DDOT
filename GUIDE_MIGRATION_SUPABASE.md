# 🚀 Guide de Migration : SQLite → Supabase PostgreSQL

## 📋 Vue d'ensemble

Ce guide vous accompagne dans la migration de votre application DDOT de SQLite vers PostgreSQL hébergé sur Supabase, avec Row Level Security (RLS) pour une sécurité maximale.

## 🎯 Avantages de la migration

### ✅ Bénéfices de PostgreSQL/Supabase
- **Performance** : Gestion optimisée de grandes quantités de données
- **Scalabilité** : Capacité à supporter plus d'utilisateurs simultanés
- **Sécurité** : Row Level Security (RLS) au niveau base de données
- **Backup** : Sauvegardes automatiques et point-in-time recovery
- **Monitoring** : Tableaux de bord et métriques intégrés
- **API temps réel** : WebSockets et subscriptions automatiques
- **Types avancés** : JSONB avec indexation et requêtes optimisées

### 🔒 Sécurité renforcée
- **RLS activé** : Chaque utilisateur ne voit que ses propres données
- **Authentification intégrée** : Gestion d'utilisateurs native Supabase
- **Politiques granulaires** : Contrôle d'accès au niveau des lignes
- **SSL obligatoire** : Toutes les connexions chiffrées

## 📚 Prérequis

### 1. Compte Supabase
- ✅ Projet créé : `https://firujzfswtatpjilgdry.supabase.co`
- ✅ Clé API fournie : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2. Informations nécessaires
Vous devez récupérer le **mot de passe de la base de données** :
1. Aller sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionner votre projet : `firujzfswtatpjilgdry`
3. Aller dans **Settings** → **Database**
4. Copier le **Database password** 

## 🔧 Étapes de migration

### Étape 1 : Configuration des variables d'environnement

Créez ou modifiez votre fichier `.env` :

```bash
# === CONFIGURATION SUPABASE ===
SUPABASE_URL=https://firujzfswtatpjilgdry.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcnVqemZzd3RhdHBqaWxnZHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNzk4NTMsImV4cCI6MjA2NzY1NTg1M30.PvAl1J6ndKwosJjnAm_ph1kWKqBBI0xXoVCIl4YOjlo
SUPABASE_DB_PASSWORD=VOTRE_MOT_DE_PASSE_DB_ICI

# === AUTRES VARIABLES EXISTANTES ===
OPENAI_API_KEY=sk-votre-cle-openai
SESSION_SECRET=votre-secret-session-securise
NODE_ENV=production
```

### Étape 2 : Créer les tables dans Supabase

1. **Via l'interface Supabase** :
   - Aller dans **SQL Editor** de votre projet Supabase
   - Copier le contenu du fichier `migrations/supabase_initial_migration.sql`
   - Coller et exécuter le script SQL

2. **Ou via le script de migration** :
   ```bash
   # Avec le mot de passe configuré dans .env
   node scripts/migrate-to-supabase.js
   ```

### Étape 3 : Vérification des tables

Après exécution, vérifiez dans **Table Editor** de Supabase que vous avez :
- ✅ `Users` - Utilisateurs
- ✅ `Documents` - Documents uploadés
- ✅ `DocumentEmbeddings` - Embeddings vectoriels
- ✅ `Analyses` - Analyses IA
- ✅ **RLS activé** sur toutes les tables

### Étape 4 : Migration des données (si existantes)

Si vous avez déjà des données dans SQLite :

```bash
# Exécuter le script de migration
node scripts/migrate-to-supabase.js
```

Le script va :
1. ✅ Connecter SQLite (source) et PostgreSQL (destination)
2. ✅ Migrer tous les utilisateurs
3. ✅ Migrer tous les documents
4. ✅ Migrer tous les embeddings (conversion BLOB → TEXT)
5. ✅ Migrer toutes les analyses
6. ✅ Vérifier l'intégrité des données

### Étape 5 : Activation de PostgreSQL

Une fois la migration réussie, modifiez `config/supabase.js` :

```javascript
// Dans getPostgreSQLConfig(), remplacer le fallback SQLite par :
return {
  dialect: 'postgres',
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  username: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  },
  // ... autres options
};
```

### Étape 6 : Test de l'application

```bash
# Redémarrer l'application
npm start
```

Vous devriez voir :
```
✅ Supabase connecté avec succès
✅ Base de données synchronisée (POSTGRES)
🐘 PostgreSQL/Supabase activé avec Row Level Security
```

## 🔍 Vérification post-migration

### 1. Test des fonctionnalités principales
- ✅ Inscription/Connexion utilisateur
- ✅ Upload de documents
- ✅ Analyses IA
- ✅ Recherche vectorielle

### 2. Vérification RLS
- ✅ Chaque utilisateur voit seulement ses propres données
- ✅ Impossible d'accéder aux données d'autres utilisateurs

### 3. Performance
- ✅ Requêtes plus rapides (index PostgreSQL)
- ✅ Recherche JSONB optimisée

## 🚨 Dépannage

### Problème : "SUPABASE_DB_PASSWORD manquant"
**Solution** : Récupérer le mot de passe dans Settings > Database de Supabase

### Problème : "Connection refused"
**Solution** : Vérifier que l'IP est autorisée dans Supabase (Settings > Database > Connection pooling)

### Problème : "RLS policy violation"
**Solution** : Vérifier que les politiques RLS sont correctement configurées

### Problème : Migration partielle
**Solution** : Relancer le script de migration (il utilise `upsert` donc sans risque)

## 📊 Monitoring Supabase

### Tableaux de bord disponibles
- **Performance** : Temps de réponse des requêtes
- **Usage** : Nombre de connexions, requêtes/seconde
- **Storage** : Taille de la base de données
- **Auth** : Connexions utilisateurs

### Métriques importantes
- **API calls** : Surveiller les limites du plan
- **Database size** : Prévoir l'upgrade si nécessaire
- **Realtime connections** : Pour les fonctionnalités temps réel

## 🔄 Rollback (si nécessaire)

En cas de problème, retour à SQLite :

1. **Modifier** `config/supabase.js` pour forcer SQLite :
   ```javascript
   return {
     dialect: 'sqlite',
     storage: './urban_analysis.db'
   };
   ```

2. **Redémarrer** l'application
3. **Analyser** les logs d'erreur
4. **Corriger** et relancer la migration

## 🎉 Félicitations !

Votre application DDOT utilise maintenant PostgreSQL avec Supabase ! 

### Prochaines étapes recommandées
1. **Monitoring** : Configurer des alertes Supabase
2. **Backup** : Vérifier la configuration des sauvegardes
3. **Performance** : Analyser les requêtes lentes
4. **Scale** : Prévoir l'évolution selon l'usage

### Support
- 📚 [Documentation Supabase](https://supabase.com/docs)
- 🐘 [Documentation PostgreSQL](https://www.postgresql.org/docs/)
- 🔒 [Guide Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

**Note** : Cette migration préserve 100% des fonctionnalités existantes tout en ajoutant la robustesse et la sécurité de PostgreSQL/Supabase. 