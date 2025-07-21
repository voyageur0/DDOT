#!/bin/bash

# Script de test automatisé pour l'autocomplétion
# Usage: ./test-autocomplete.sh

echo "🔍 Test Automatisé de l'Autocomplétion DDOT"
echo "=========================================="

BASE_URL="http://localhost:3001"
TEST_QUERIES=("sion" "martigny" "chamoson" "sierre")

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les résultats
print_result() {
    local status=$1
    local message=$2
    
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Test 1: Vérification du serveur
echo -e "\n${BLUE}1. Test de connectivité du serveur${NC}"
if curl -s "$BASE_URL" > /dev/null; then
    print_result "SUCCESS" "Serveur accessible sur $BASE_URL"
else
    print_result "ERROR" "Serveur non accessible sur $BASE_URL"
    exit 1
fi

# Test 2: API GeoAdmin
echo -e "\n${BLUE}2. Test de l'API GeoAdmin${NC}"
for query in "${TEST_QUERIES[@]}"; do
    response=$(curl -s "$BASE_URL/api/geoadmin-search?searchText=$query&limit=2")
    if echo "$response" | jq -e '.results' > /dev/null 2>&1; then
        count=$(echo "$response" | jq '.results | length')
        print_result "SUCCESS" "API GeoAdmin OK pour '$query' ($count résultats)"
    else
        print_result "ERROR" "API GeoAdmin échouée pour '$query'"
    fi
done

# Test 3: API Suggestions
echo -e "\n${BLUE}3. Test de l'API Suggestions${NC}"
for query in "${TEST_QUERIES[@]}"; do
    response=$(curl -s "$BASE_URL/api/suggestions?q=$query&limit=2")
    if echo "$response" | jq -e '.suggestions' > /dev/null 2>&1; then
        count=$(echo "$response" | jq '.suggestions | length')
        print_result "SUCCESS" "API Suggestions OK pour '$query' ($count suggestions)"
    else
        print_result "ERROR" "API Suggestions échouée pour '$query'"
    fi
done

# Test 4: API Search
echo -e "\n${BLUE}4. Test de l'API Search${NC}"
for query in "${TEST_QUERIES[@]}"; do
    response=$(curl -s -X POST "$BASE_URL/api/search" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"$query\"}")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        success=$(echo "$response" | jq -r '.success')
        if [ "$success" = "true" ]; then
            print_result "SUCCESS" "API Search OK pour '$query'"
        else
            error=$(echo "$response" | jq -r '.error // "Erreur inconnue"')
            print_result "WARNING" "API Search warning pour '$query': $error"
        fi
    else
        print_result "ERROR" "API Search échouée pour '$query'"
    fi
done

# Test 5: Health Check
echo -e "\n${BLUE}5. Test des Health Checks${NC}"
health_response=$(curl -s "$BASE_URL/api/suggestions/health")
if echo "$health_response" | jq -e '.success' > /dev/null 2>&1; then
    success=$(echo "$health_response" | jq -r '.success')
    if [ "$success" = "true" ]; then
        message=$(echo "$health_response" | jq -r '.message')
        print_result "SUCCESS" "Health Check OK: $message"
    else
        print_result "ERROR" "Health Check échoué"
    fi
else
    print_result "ERROR" "Health Check non accessible"
fi

# Test 6: Pages de test
echo -e "\n${BLUE}6. Test des pages de test${NC}"
for page in "test-autocomplete.html" "diagnostic-autocomplete.html"; do
    if curl -s "$BASE_URL/$page" | grep -q "DOCTYPE html"; then
        print_result "SUCCESS" "Page $page accessible"
    else
        print_result "ERROR" "Page $page non accessible"
    fi
done

# Test 7: Fichiers statiques
echo -e "\n${BLUE}7. Test des fichiers statiques${NC}"
for file in "js/autocomplete.js" "css/modern-ui.css"; do
    if curl -s "$BASE_URL/$file" | head -1 | grep -q -E "(//|\.|css|class)"; then
        print_result "SUCCESS" "Fichier $file accessible"
    else
        print_result "ERROR" "Fichier $file non accessible"
    fi
done

# Résumé
echo -e "\n${BLUE}📊 Résumé des Tests${NC}"
echo "=================="

# Compter les succès et échecs
success_count=0
error_count=0
warning_count=0

# Analyser les résultats (simplifié)
total_tests=$(( ${#TEST_QUERIES[@]} * 3 + 6 )) # 3 APIs * queries + autres tests
print_result "INFO" "Total des tests effectués: $total_tests"

echo -e "\n${GREEN}🎉 Tests terminés !${NC}"
echo -e "${BLUE}Pour tester manuellement l'autocomplétion :${NC}"
echo -e "  • ${YELLOW}http://localhost:3001/test-autocomplete.html${NC}"
echo -e "  • ${YELLOW}http://localhost:3001/diagnostic-autocomplete.html${NC}"
echo -e "  • ${YELLOW}http://localhost:3001/${NC} (application principale)" 