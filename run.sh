#!/bin/bash

# Script de démarrage ultra-rapide
# Usage: ./run.sh

echo "🚀 Démarrage rapide du serveur DDOT..."

# Nettoyer les ports
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Démarrer
npm run dev &

# Attendre 3 secondes
sleep 3

echo "✅ Serveur accessible sur: http://localhost:3001"
echo "🔄 Redémarre automatiquement à chaque modification"
echo "⏹️  Pour arrêter: Ctrl+C"

# Attendre que l'utilisateur arrête
wait