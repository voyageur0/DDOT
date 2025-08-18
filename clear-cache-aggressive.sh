#!/bin/bash

echo "🚀 DDOT - Nettoyage Agressif du Cache"
echo "====================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Fonction pour afficher le hash d'un fichier
get_file_hash() {
    if [ -f "$1" ]; then
        md5sum "$1" 2>/dev/null | cut -d' ' -f1 | cut -c1-8 || md5 -q "$1" 2>/dev/null | cut -c1-8
    else
        echo "NOTFOUND"
    fi
}

# 1. Arrêter tous les processus Node
echo -e "${YELLOW}1. Arrêt des processus Node...${NC}"
pkill -f "node" || true
sleep 1

# 2. Nettoyer les caches NPM
echo -e "${YELLOW}2. Nettoyage du cache NPM...${NC}"
npm cache clean --force 2>/dev/null || true

# 3. Toucher tous les fichiers pour forcer la mise à jour
echo -e "${YELLOW}3. Mise à jour des timestamps...${NC}"
find public -name "*.js" -o -name "*.css" -o -name "*.html" | while read file; do
    touch "$file"
    echo -e "  ${GREEN}✓${NC} $file"
done

# 4. Vérifier la présence des thèmes
echo -e "${YELLOW}4. Vérification des thèmes de jeux...${NC}"
if grep -q "gameThemes" public/js/search-system.js 2>/dev/null; then
    THEME_COUNT=$(grep -o '"Simulateur\|"Construction\|"Course\|"Terra' public/js/search-system.js | wc -l)
    echo -e "  ${GREEN}✅ Thèmes trouvés: $THEME_COUNT occurrences${NC}"
    
    # Afficher les premiers thèmes
    echo -e "  ${BLUE}Exemples de thèmes:${NC}"
    grep -A 2 "gameThemes = \[" public/js/search-system.js | head -5 | sed 's/^/    /'
else
    echo -e "  ${RED}❌ ERREUR: Aucun thème trouvé!${NC}"
fi

# 5. Vérifier les contraintes
echo -e "${YELLOW}5. Vérification des contraintes...${NC}"
if grep -q "constraintThemes" public/js/search-system.js 2>/dev/null; then
    CONSTRAINT_COUNT=$(grep -c "icon:" public/js/search-system.js)
    echo -e "  ${GREEN}✅ Contraintes trouvées: $CONSTRAINT_COUNT thèmes${NC}"
else
    echo -e "  ${RED}❌ ERREUR: Aucune contrainte trouvée!${NC}"
fi

# 6. Afficher les hashes des fichiers
echo -e "${YELLOW}6. Versions des fichiers:${NC}"
for file in public/js/search-system.js public/js/auth.js public/index.html; do
    HASH=$(get_file_hash "$file")
    SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
    SIZE_KB=$((SIZE / 1024))
    if [ "$HASH" != "NOTFOUND" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
        echo -e "    Hash: ${BLUE}$HASH${NC} | Taille: ${BLUE}${SIZE_KB}KB${NC}"
    else
        echo -e "  ${RED}✗${NC} $file - Non trouvé"
    fi
done

# 7. Instructions finales
echo ""
echo -e "${GREEN}✨ Nettoyage terminé!${NC}"
echo ""
echo -e "${YELLOW}📋 Instructions pour tester:${NC}"
echo ""
echo "1. ${BLUE}Ouvrir une fenêtre privée/incognito${NC}"
echo "   • Chrome: Ctrl+Shift+N (Windows/Linux) ou Cmd+Shift+N (Mac)"
echo "   • Firefox: Ctrl+Shift+P (Windows/Linux) ou Cmd+Shift+P (Mac)"
echo "   • Safari: Cmd+Shift+N"
echo ""
echo "2. ${BLUE}Visiter les pages de test:${NC}"
echo "   • http://localhost:3001/test-themes.html (Test des thèmes)"
echo "   • http://localhost:3001/diagnostic-cache.html (Diagnostic complet)"
echo "   • http://localhost:3001/ (Page principale)"
echo ""
echo "3. ${BLUE}Forcer le rechargement si nécessaire:${NC}"
echo "   • Ctrl+Shift+R (Windows/Linux) ou Cmd+Shift+R (Mac)"
echo ""

# 8. Démarrer le serveur
echo -e "${YELLOW}Démarrage du serveur...${NC}"
echo ""
npm run dev