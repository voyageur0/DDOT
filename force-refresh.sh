#!/bin/bash

echo "🧹 DDOT - Forçage du rafraîchissement complet"
echo "============================================"

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Arrêter le serveur s'il tourne
echo -e "${YELLOW}📋 Arrêt du serveur...${NC}"
pkill -f "node.*server.js" || true
pkill -f "nodemon" || true
sleep 2

# Nettoyer les caches NPM
echo -e "${YELLOW}🗑️  Nettoyage des caches NPM...${NC}"
npm cache clean --force

# Supprimer les anciens fichiers de log
echo -e "${YELLOW}📄 Suppression des logs...${NC}"
rm -f *.log

# Créer des backups des fichiers statiques avec timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
echo -e "${YELLOW}💾 Création de backups avec timestamp: ${TIMESTAMP}${NC}"

# Ajouter un timestamp aux fichiers JS pour forcer le rechargement
echo -e "${YELLOW}🔄 Mise à jour des timestamps dans les fichiers...${NC}"

# Modifier temporairement les fichiers pour forcer un changement de date
find public/js -name "*.js" -exec touch {} \;
find public/css -name "*.css" -exec touch {} \;

# Afficher les versions actuelles des fichiers
echo -e "${GREEN}📊 Versions des fichiers:${NC}"
for file in public/js/search-system.js public/js/auth.js public/js/ai-analysis-enhanced.js; do
    if [ -f "$file" ]; then
        HASH=$(md5sum "$file" | cut -d' ' -f1 | cut -c1-8)
        SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        echo -e "  ✅ $file - Hash: $HASH - Taille: $((SIZE/1024))KB"
    else
        echo -e "  ${RED}❌ $file - Non trouvé${NC}"
    fi
done

# Vérifier la présence des thèmes de jeux
echo -e "${YELLOW}🎮 Vérification des thèmes de jeux...${NC}"
if grep -q "gameThemes" public/js/search-system.js 2>/dev/null; then
    THEME_COUNT=$(grep -o "Simulateur" public/js/search-system.js | wc -l)
    echo -e "${GREEN}  ✅ Thèmes de jeux trouvés (au moins $THEME_COUNT occurrences)${NC}"
else
    echo -e "${RED}  ❌ Aucun thème de jeu trouvé!${NC}"
fi

# Instructions pour l'utilisateur
echo ""
echo -e "${GREEN}✨ Nettoyage terminé!${NC}"
echo ""
echo -e "${YELLOW}📝 Instructions pour forcer le rechargement complet:${NC}"
echo "1. Ouvrez votre navigateur en mode privé/incognito"
echo "2. Ou utilisez ces raccourcis pour vider le cache:"
echo "   - Chrome/Firefox: Ctrl+Shift+R (Windows/Linux) ou Cmd+Shift+R (Mac)"
echo "   - Safari: Cmd+Option+E puis Cmd+R"
echo ""
echo "3. Visitez la page de diagnostic: http://localhost:3001/diagnostic-cache.html"
echo ""
echo -e "${YELLOW}🚀 Démarrage du serveur...${NC}"
echo ""

# Démarrer le serveur avec des variables d'environnement pour désactiver le cache
NODE_ENV=development NO_CACHE=true npm run dev