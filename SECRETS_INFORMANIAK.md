# 🔐 Configuration des secrets GitHub pour ddot.iconeo.ch

## Secrets à configurer dans GitHub

Allez sur : https://github.com/voyageur0/DDOT/settings/secrets/actions

### 1. INFORMANIAK_HOST
```
ddot.iconeo.ch
```
*ou l'adresse SSH fournie par Informaniak*

### 2. INFORMANIAK_USERNAME
```
votre-nom-utilisateur-informaniak
```
*Nom d'utilisateur SSH de votre hébergement*

### 3. INFORMANIAK_PRIVATE_KEY
```
-----BEGIN PRIVATE KEY-----
[votre-clé-privée-ssh-complète]
-----END PRIVATE KEY-----
```

### 4. INFORMANIAK_PROJECT_PATH
```
/srv/customer/sites/ddot.iconeo.ch
```

### 5. INFORMANIAK_PORT (optionnel)
```
22
```

## 🔑 Générer une clé SSH pour Informaniak

### Sur votre machine locale :
```bash
ssh-keygen -t rsa -b 4096 -C "ddot@iconeo.ch"
```

### Ajouter la clé publique à Informaniak :
1. Copiez votre clé publique :
   ```bash
   cat ~/.ssh/id_rsa.pub
   ```

2. Dans le panel Informaniak :
   - **Hébergement** → **SSH** → **Clés SSH**
   - Ajoutez votre clé publique

3. Copiez votre clé privée pour GitHub :
   ```bash
   cat ~/.ssh/id_rsa
   ```

## 🚀 Test du déploiement automatique

Une fois les secrets configurés, **chaque push sur main** déclenchera automatiquement le déploiement !

### Pour tester :
```bash
# Depuis votre machine locale
git add .
git commit -m "Test déploiement automatique"
git push origin main
```

### Vérifiez dans GitHub :
- **Actions** → Voir le workflow en cours
- Une fois terminé, votre site sera automatiquement mis à jour !

## 📱 Informations de votre hébergement

- **Domaine** : ddot.iconeo.ch
- **Chemin probable** : /srv/customer/sites/ddot.iconeo.ch
- **Port Node.js** : 3001 (déjà configuré)
- **Commande** : npm start (déjà configurée) 