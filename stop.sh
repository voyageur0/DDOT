#!/bin/bash
# Script d'arrêt pour DDOT sur Informaniak

echo "🛑 Arrêt de l'application DDOT..."

# Arrêter tous les processus PM2
echo "🔄 Arrêt des processus PM2..."
pm2 stop all

# Afficher le statut
echo "📊 Statut des processus:"
pm2 status

# Optionnel : supprimer les processus de PM2
read -p "Voulez-vous supprimer les processus de PM2 ? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️ Suppression des processus PM2..."
    pm2 delete all
    echo "✅ Processus supprimés"
else
    echo "💾 Processus conservés (utilisez 'pm2 start ecosystem.config.js --env production' pour redémarrer)"
fi

echo "✅ Application DDOT arrêtée avec succès!" 