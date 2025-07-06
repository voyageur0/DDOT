#!/bin/bash
# Script de réparation automatique pour DDOT sur Informaniak

echo "🔧 Réparation automatique DDOT - Informaniak"
echo "============================================="

# Vérifier où nous sommes
echo "📍 Répertoire actuel: $(pwd)"

# Vérifier si nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Fichier package.json non trouvé"
    echo "⚠️  Essayez de naviguer vers le répertoire du projet:"
    echo "   cd /srv/customer/sites/ddot.iconeo.ch"
    echo "   puis relancez ce script"
    exit 1
fi

echo "✅ Fichier package.json trouvé"

# Arrêter les processus existants
echo "🛑 Arrêt des processus existants..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Nettoyer et réinstaller les dépendances Node.js
echo "🧹 Nettoyage et réinstallation des dépendances Node.js..."
rm -rf node_modules package-lock.json
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'installation des dépendances Node.js"
    exit 1
fi

echo "✅ Dépendances Node.js installées"

# Créer le fichier .env si nécessaire
if [ ! -f ".env" ]; then
    echo "📝 Création du fichier .env..."
    cp env.production.template .env
    echo "⚠️  IMPORTANT: Configurez vos clés API dans le fichier .env"
    echo "   Éditez le fichier .env avec vos vraies clés:"
    echo "   nano .env"
else
    echo "✅ Fichier .env existe déjà"
fi

# Créer les dossiers nécessaires
echo "📁 Création des dossiers nécessaires..."
mkdir -p logs uploads temp-ocr cache/parcels

# Vérifier et configurer Python
echo "🐍 Configuration de l'environnement Python..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'installation des dépendances Python"
    exit 1
fi

echo "✅ Environnement Python configuré"

# Télécharger les données OCR si nécessaire
echo "🔤 Vérification des données OCR..."
if [ ! -f "eng.traineddata" ]; then
    echo "📥 Téléchargement des données OCR anglaises..."
    wget -O eng.traineddata https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata
fi

if [ ! -f "fra.traineddata" ]; then
    echo "📥 Téléchargement des données OCR françaises..."
    wget -O fra.traineddata https://github.com/tesseract-ocr/tessdata/raw/main/fra.traineddata
fi

echo "✅ Données OCR disponibles"

# Initialiser la base de données
echo "🗄️ Initialisation de la base de données..."
if [ -f "migrations/001_create_parcels_cache.sql" ]; then
    sqlite3 urban_analysis.db < migrations/001_create_parcels_cache.sql 2>/dev/null || true
fi

# Vérifier PM2
echo "⚙️ Vérification de PM2..."
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installation de PM2..."
    npm install -g pm2
fi

# Démarrer avec PM2
echo "🚀 Démarrage de l'application..."
pm2 start ecosystem.config.js --env production

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du démarrage avec PM2"
    echo "🔍 Vérifiez les logs: pm2 logs"
    exit 1
fi

# Sauvegarder la configuration PM2
pm2 save

echo ""
echo "✅ Réparation terminée avec succès!"
echo "📊 Statut des processus:"
pm2 status

echo ""
echo "🌐 Votre application devrait maintenant être accessible sur:"
echo "   https://ddot.iconeo.ch"
echo ""
echo "🔍 Pour vérifier les logs:"
echo "   pm2 logs"
echo ""
echo "⚠️  N'oubliez pas de configurer vos clés API dans le fichier .env si ce n'est pas déjà fait!"
echo "   nano .env" 