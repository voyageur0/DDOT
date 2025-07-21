#!/bin/bash

echo "🧹 Nettoyage des processus existants..."
pkill -f "node.*server" 2>/dev/null || true
sleep 1

echo "🚀 Démarrage du serveur DDOT..."
echo ""

# Démarrer avec nodemon pour le rechargement automatique
npx nodemon server-simple.js