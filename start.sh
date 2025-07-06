#!/bin/bash
# Script de démarrage pour DDOT sur Informaniak

echo "🚀 Démarrage de l'application DDOT..."

# Vérifier la présence du fichier .env
if [ ! -f .env ]; then
    echo "❌ Fichier .env manquant. Créez-le à partir de .env.production"
    exit 1
fi

# Créer le dossier logs s'il n'existe pas
mkdir -p logs

# Créer le dossier uploads s'il n'existe pas
mkdir -p uploads

# Créer le dossier temp-ocr s'il n'existe pas
mkdir -p temp-ocr

# Créer le dossier cache s'il n'existe pas
mkdir -p cache/parcels

# Installer les dépendances Node.js si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances Node.js..."
    npm install
fi

# Installer les dépendances Python si nécessaire
if [ ! -f "venv/bin/activate" ]; then
    echo "🐍 Création de l'environnement virtuel Python..."
    python3 -m venv venv
fi

echo "🐍 Activation de l'environnement virtuel Python..."
source venv/bin/activate

echo "📦 Installation des dépendances Python..."
pip install -r requirements.txt

# Télécharger les données OCR si nécessaire
if [ ! -f "eng.traineddata" ]; then
    echo "🔤 Téléchargement des données OCR anglaises..."
    wget -O eng.traineddata https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata
fi

if [ ! -f "fra.traineddata" ]; then
    echo "🔤 Téléchargement des données OCR françaises..."
    wget -O fra.traineddata https://github.com/tesseract-ocr/tessdata/raw/main/fra.traineddata
fi

# Exécuter les migrations de base de données
echo "🗄️ Exécution des migrations de base de données..."
if [ -f "migrations/001_create_parcels_cache.sql" ]; then
    sqlite3 urban_analysis.db < migrations/001_create_parcels_cache.sql 2>/dev/null || true
fi

# Démarrer avec PM2
echo "🚀 Démarrage avec PM2..."
pm2 start ecosystem.config.js --env production

# Afficher le statut
echo "📊 Statut des processus:"
pm2 status

echo "✅ Application DDOT démarrée avec succès!"
echo "🌐 L'application est accessible sur votre domaine Informaniak"
echo "📱 Vous pouvez maintenant accéder à l'interface web"

# Sauvegarder la configuration PM2
pm2 save

# Configurer PM2 pour démarrer automatiquement au redémarrage
pm2 startup
echo "💾 Configuration PM2 sauvegardée pour démarrage automatique" 