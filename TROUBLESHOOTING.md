# Guide de Dépannage DDOT

## Problèmes Courants et Solutions

### 1. Le serveur ne démarre pas

**Symptômes:**
- Erreur de port déjà utilisé
- Modules manquants

**Solutions:**
```bash
# Vérifier les processus sur les ports
lsof -i :3000 -i :3001

# Tuer les processus bloquants
kill -9 <PID>

# Réinstaller les dépendances
npm install
```

### 2. L'analyse IA ne fonctionne pas

**Symptômes:**
- Message "Service temporairement indisponible"
- Erreur 503

**Solutions:**
1. Vérifier la clé OpenAI dans `.env`:
   ```
   OPENAI_API_KEY=sk-...
   ```

2. Tester la configuration:
   ```bash
   npm run check
   ```

3. Vérifier le statut du service:
   ```
   GET http://localhost:3001/api/ia-constraints/health
   ```

### 3. Le téléchargement de règlement ne fonctionne pas

**Symptômes:**
- Bouton non visible
- Erreur 404

**Solutions:**
1. Vérifier que la commune est dans la liste (`public/regulations-vs.json`)
2. Tester directement l'URL: `/api/regulation/NomCommune`

### 4. Rechargement automatique ne fonctionne pas

**Solutions:**
1. Utiliser le script de démarrage amélioré:
   ```bash
   npm run dev:start
   ```

2. Vérifier la configuration nodemon (`nodemon.json`)

### 5. Erreurs après redémarrage

**Symptômes:**
- Services non disponibles après rechargement

**Solutions:**
1. Le serveur inclut maintenant des middlewares de récupération automatique
2. Les clés API sont rechargées automatiquement si nécessaire
3. En cas de problème persistant, redémarrer complètement:
   ```bash
   # Arrêter le serveur (Ctrl+C)
   # Relancer
   npm run dev
   ```

## Configuration Recommandée

### Variables d'Environnement Essentielles
```env
# .env
PORT=3001
NODE_ENV=development
SESSION_SECRET=votre-secret-session
OPENAI_API_KEY=sk-votre-cle-openai

# Optionnel
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
STRIPE_SECRET_KEY=...
```

### Commandes Utiles
```bash
# Développement avec logs détaillés
npm run dev

# Démarrage avec vérifications
npm run dev:start

# Vérifier la configuration
npm run check

# Tests
npm test
```

## Améliorations Implémentées

1. **Rechargement Automatique**: Configuration nodemon optimisée
2. **Gestion des Clés API**: Module de gestion avec rechargement
3. **Route Règlements**: `/api/regulation/:commune` ajoutée
4. **Récupération d'Erreurs**: Middlewares de récupération automatique
5. **Script de Démarrage**: Vérifications et installation automatique

## Support

Pour toute question ou problème non résolu, consulter:
- Les logs dans la console
- Le fichier `CLAUDE.md` pour l'architecture
- Les tests avec `npm test`