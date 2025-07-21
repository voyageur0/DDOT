#!/bin/bash

# Script de démarrage stable pour le serveur DDOT
# Usage: ./start-server.sh

echo "🚀 Démarrage du serveur DDOT..."

# Nettoyer les processus existants
echo "🧹 Nettoyage des processus existants..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true

# Attendre que les processus se terminent
sleep 2

# Vérifier que le port 3001 est libre
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️ Port 3001 occupé, libération..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Démarrer le serveur avec nodemon
echo "🔄 Démarrage du serveur avec nodemon..."
npm run dev &

# Attendre que le serveur démarre
echo "⏳ Attente du démarrage du serveur..."
sleep 3

# Vérifier que le serveur est accessible
for i in {1..10}; do
    if curl -s http://localhost:3001 >/dev/null 2>&1; then
        echo "✅ Serveur démarré avec succès!"
        echo "🔗 Accessible sur: http://localhost:3001"
        exit 0
    fi
    echo "⏳ Tentative $i/10..."
    sleep 2
done

echo "❌ Échec du démarrage du serveur"
exit 1