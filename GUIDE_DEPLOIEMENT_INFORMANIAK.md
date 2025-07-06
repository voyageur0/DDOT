# Guide de déploiement DDOT sur Informaniak

Ce guide vous accompagne pas à pas pour déployer votre application DDOT (Analyse intelligente de documents d'urbanisme) sur l'hébergement Informaniak.

## 📋 Prérequis

### Hébergement Informaniak
- **Hébergement recommandé** : Web Hosting Swiss ou VPS
- **PHP Version** : 8.1 ou supérieure
- **Node.js** : Version 18 ou supérieure
- **Python** : Version 3.8 ou supérieure
- **Base de données** : SQLite (incluse) ou MySQL (optionnel)
- **Espace disque** : Minimum 2 GB (recommandé 5 GB)

### Comptes et clés API nécessaires
- **OpenAI API** : Clé API pour l'intelligence artificielle
- **Stripe** : Clés API pour les paiements (optionnel)
- **Domaine** : Votre domaine hébergé chez Informaniak

## 🚀 Étape 1 : Préparation de l'environnement

### 1.1 Connexion SSH à votre hébergement
```bash
ssh votre-utilisateur@votre-domaine.infomaniak.ch
```

### 1.2 Vérification des versions
```bash
# Vérifier Node.js
node --version

# Vérifier Python
python3 --version

# Vérifier PM2 (gestionnaire de processus)
pm2 --version
```

### 1.3 Installation de PM2 (si nécessaire)
```bash
npm install -g pm2
```

## 📦 Étape 2 : Téléchargement et installation

### 2.1 Téléchargement du code source
```bash
# Cloner le repository ou télécharger les fichiers
git clone https://github.com/votre-compte/ddot.git
cd ddot

# OU si vous uploadez manuellement
# Utilisez FileZilla ou l'interface web d'Informaniak
```

### 2.2 Configuration des variables d'environnement
```bash
# Copier le template des variables d'environnement
cp env.production.template .env

# Éditer le fichier .env
nano .env
```

**Variables obligatoires à configurer :**
```env
OPENAI_API_KEY=sk-votre-clé-openai-réelle
FRONTEND_URL=https://votre-domaine.infomaniak.ch
CORS_ORIGIN=https://votre-domaine.infomaniak.ch
SESSION_SECRET=générez-une-clé-secrète-très-forte
```

### 2.3 Installation des dépendances
```bash
# Rendre le script exécutable
chmod +x start.sh

# Lancer l'installation complète
./start.sh
```

## 🌐 Étape 3 : Configuration Apache

### 3.1 Fichier .htaccess
Le fichier `.htaccess` est déjà configuré pour :
- Rediriger HTTPS
- Proxifier les requêtes vers Node.js
- Servir les fichiers statiques
- Configurer la sécurité

### 3.2 Vérification de la configuration
```bash
# Vérifier que les processus sont actifs
pm2 status

# Vérifier les logs
pm2 logs
```

## 🔧 Étape 4 : Configuration avancée

### 4.1 Base de données
```bash
# Créer la base de données SQLite
sqlite3 urban_analysis.db

# Exécuter les migrations
sqlite3 urban_analysis.db < migrations/001_create_parcels_cache.sql
```

### 4.2 Permissions des dossiers
```bash
# Assurer les bonnes permissions
chmod 755 public/
chmod 755 uploads/
chmod 755 logs/
chmod 755 cache/
chmod 755 temp-ocr/
```

### 4.3 Configuration SSL
Informaniak fournit automatiquement SSL. Vérifiez dans votre panel :
- Certificat SSL activé
- Redirection HTTPS activée

## 📱 Étape 5 : Test et vérification

### 5.1 Tests de base
```bash
# Tester la connexion Node.js
curl http://localhost:3001

# Tester la connexion Python
curl http://localhost:5000

# Vérifier les processus
pm2 monit
```

### 5.2 Test de l'interface web
1. Ouvrir https://votre-domaine.infomaniak.ch
2. Vérifier que la page d'accueil s'affiche
3. Tester l'inscription/connexion
4. Tester l'upload d'un document PDF
5. Tester une analyse de parcelle

## 🔧 Étape 6 : Maintenance et monitoring

### 6.1 Commandes utiles
```bash
# Redémarrer l'application
pm2 restart all

# Arrêter l'application
pm2 stop all

# Voir les logs en temps réel
pm2 logs --lines 50

# Monitorer les performances
pm2 monit
```

### 6.2 Sauvegarde
```bash
# Sauvegarder la base de données
cp urban_analysis.db urban_analysis.db.backup

# Sauvegarder les uploads
tar -czf uploads-backup.tar.gz uploads/
```

### 6.3 Mise à jour de l'application
```bash
# Arrêter les processus
pm2 stop all

# Mettre à jour le code
git pull origin main

# Réinstaller les dépendances si nécessaire
npm install
pip install -r requirements.txt

# Redémarrer
pm2 start ecosystem.config.js --env production
```

## 🛠️ Dépannage

### Erreur "Module non trouvé"
```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Erreur base de données
```bash
# Vérifier les permissions
ls -la urban_analysis.db

# Recréer la base
rm urban_analysis.db
sqlite3 urban_analysis.db < migrations/001_create_parcels_cache.sql
```

### Erreur OCR
```bash
# Vérifier les fichiers OCR
ls -la *.traineddata

# Retélécharger si nécessaire
./start.sh
```

### Erreur mémoire
```bash
# Augmenter la limite mémoire Node.js
pm2 restart ddot-node --node-args="--max-old-space-size=2048"
```

## 📞 Support

### Logs importants
- **Application** : `logs/node-combined.log`
- **Python** : `logs/python-combined.log`
- **Apache** : Panel Informaniak > Logs > Apache

### Informations système
```bash
# Utilisation mémoire
free -h

# Utilisation disque
df -h

# Processus actifs
pm2 status
```

### Contacts
- **Support Informaniak** : https://www.infomaniak.com/fr/support
- **Documentation Node.js** : https://nodejs.org/docs/
- **Documentation PM2** : https://pm2.keymetrics.io/

## 🎯 Conseils de performance

1. **Optimisation mémoire** : Surveillez l'utilisation mémoire via `pm2 monit`
2. **Cache** : Activez le cache pour les analyses répétitives
3. **Compression** : La compression Gzip est activée dans `.htaccess`
4. **Monitoring** : Utilisez PM2 pour surveiller les performances
5. **Sauvegardes** : Sauvegardez régulièrement la base de données

## 🔒 Sécurité

- Changez toutes les clés secrètes par défaut
- Utilisez des mots de passe forts
- Activez HTTPS (déjà configuré)
- Surveillez les logs régulièrement
- Mettez à jour les dépendances régulièrement

---

**Félicitations ! Votre application DDOT est maintenant déployée sur Informaniak.** 🎉

Pour toute question ou problème, consultez les logs ou contactez le support technique. 