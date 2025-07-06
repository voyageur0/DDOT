# 🛠️ Dépannage Informaniak - DDOT

Guide de résolution des problèmes courants lors du déploiement sur Informaniak.

## ❌ Erreur : "Cannot find module 'dotenv'"

### Cause
Les dépendances Node.js ne sont pas installées sur le serveur Informaniak.

### Solution rapide

1. **Connexion SSH** :
```bash
ssh votre-utilisateur@ddot.iconeo.ch
```

2. **Aller dans le répertoire du projet** :
```bash
cd /srv/customer/sites/ddot.iconeo.ch
```

3. **Vérifier les fichiers** :
```bash
ls -la
# Vérifiez que package.json est présent
cat package.json
```

4. **Installer les dépendances** :
```bash
npm install
```

5. **Créer le fichier .env** :
```bash
cp env.production.template .env
nano .env
```

6. **Configurer les variables d'environnement** :
```env
# Variables OBLIGATOIRES à configurer
OPENAI_API_KEY=sk-votre-clé-openai-réelle
FRONTEND_URL=https://ddot.iconeo.ch
CORS_ORIGIN=https://ddot.iconeo.ch
SESSION_SECRET=générez-une-clé-secrète-très-forte
```

7. **Installer PM2 globalement** :
```bash
npm install -g pm2
```

8. **Démarrer l'application** :
```bash
chmod +x start.sh
./start.sh
```

### Vérification
```bash
# Vérifier que les processus tournent
pm2 status

# Vérifier les logs
pm2 logs

# Tester l'application
curl http://localhost:3001
```

## 🔧 Commandes de dépannage complètes

### Script de réparation automatique

Créez un fichier `fix.sh` :
```bash
#!/bin/bash
echo "🔧 Réparation automatique DDOT..."

# Aller dans le bon répertoire
cd /srv/customer/sites/ddot.iconeo.ch

# Arrêter les processus existants
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Nettoyer et réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install

# Créer le .env si nécessaire
if [ ! -f .env ]; then
    cp env.production.template .env
    echo "⚠️  ATTENTION: Configurez vos clés API dans .env"
fi

# Créer les dossiers nécessaires
mkdir -p logs uploads temp-ocr cache/parcels

# Vérifier Python
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate
pip install -r requirements.txt

# Télécharger les données OCR
if [ ! -f "eng.traineddata" ]; then
    wget -O eng.traineddata https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata
fi
if [ ! -f "fra.traineddata" ]; then
    wget -O fra.traineddata https://github.com/tesseract-ocr/tessdata/raw/main/fra.traineddata
fi

# Initialiser la base de données
sqlite3 urban_analysis.db < migrations/001_create_parcels_cache.sql 2>/dev/null || true

# Démarrer avec PM2
pm2 start ecosystem.config.js --env production
pm2 save

echo "✅ Réparation terminée!"
pm2 status
```

### Utilisation du script de réparation
```bash
chmod +x fix.sh
./fix.sh
```

## 📋 Checklist de vérification

- [ ] Fichier `package.json` présent
- [ ] Dépendances installées (`node_modules/` existe)
- [ ] Fichier `.env` configuré
- [ ] PM2 installé globalement
- [ ] Ports 3001 et 5000 disponibles
- [ ] Base de données SQLite créée
- [ ] Données OCR téléchargées

## 🐛 Autres erreurs courantes

### Erreur : "Permission denied"
```bash
# Fixer les permissions
chmod 755 /srv/customer/sites/ddot.iconeo.ch
chmod +x start.sh stop.sh
```

### Erreur : "Port already in use"
```bash
# Trouver les processus utilisant les ports
lsof -i :3001
lsof -i :5000

# Arrêter les processus
pm2 stop all
```

### Erreur : "Python module not found"
```bash
# Réinstaller les dépendances Python
source venv/bin/activate
pip install -r requirements.txt
```

### Erreur : "Database locked"
```bash
# Redémarrer la base de données
pm2 restart all
```

## 📞 Support Informaniak

### Informations système
```bash
# Version Node.js
node --version

# Version npm
npm --version

# Espace disque
df -h

# Mémoire
free -h

# Processus en cours
pm2 monit
```

### Logs utiles
```bash
# Logs de l'application
pm2 logs

# Logs système
tail -f /var/log/syslog

# Logs Apache (si applicable)
tail -f /var/log/apache2/error.log
```

## 🚀 Redémarrage complet

Si rien ne fonctionne, redémarrage complet :
```bash
# Arrêter tout
pm2 stop all
pm2 delete all

# Nettoyer
rm -rf node_modules venv

# Relancer le script de démarrage
./start.sh
```

---

**Si le problème persiste, contactez le support Informaniak avec les logs d'erreur.** 📞 