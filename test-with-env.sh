#!/bin/bash

# Charger les variables d'environnement
export $(cat .env | grep -v '^#' | xargs)

# Lancer le test
npx ts-node test-expert-analysis.js