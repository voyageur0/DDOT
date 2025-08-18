#!/bin/bash

echo "🔧 Correction des erreurs DDOT"
echo "============================"
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Arrêter les processus
echo -e "${YELLOW}1. Arrêt des processus...${NC}"
pkill -f "node" || true
sleep 1

# 2. Nettoyer le cache navigateur
echo -e "${YELLOW}2. Instructions pour nettoyer le cache navigateur:${NC}"
echo "   • Chrome: Ouvrir DevTools (F12) → Clic droit sur Recharger → 'Vider le cache et effectuer un rechargement forcé'"
echo "   • Firefox: Ctrl+Shift+R (Windows/Linux) ou Cmd+Shift+R (Mac)"
echo "   • Safari: Cmd+Option+E puis Cmd+R"
echo ""

# 3. Démarrer le serveur
echo -e "${YELLOW}3. Démarrage du serveur...${NC}"
echo ""
echo -e "${GREEN}✅ Corrections appliquées:${NC}"
echo "   • SearchSystem chargé une seule fois"
echo "   • Auth 401 traité comme normal"
echo "   • Proxy GeoAdmin pour éviter CORS"
echo ""
echo -e "${GREEN}📋 Pour tester:${NC}"
echo "   1. Ouvrir une fenêtre privée/incognito"
echo "   2. Aller sur http://localhost:3001/"
echo "   3. Taper une adresse dans la recherche"
echo ""

npm run dev