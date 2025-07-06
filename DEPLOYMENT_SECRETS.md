# 🔐 Configuration des secrets GitHub pour le déploiement automatique

Ce guide explique comment configurer les secrets GitHub pour le déploiement automatique sur Informaniak.

## 📋 Secrets nécessaires

Allez dans votre repository GitHub : **Settings > Secrets and variables > Actions**

### Secrets obligatoires :

1. **`INFORMANIAK_HOST`** : L'adresse de votre serveur Informaniak
   ```
   Exemple : ssh.infomaniak.com ou votre-domaine.infomaniak.ch
   ```

2. **`INFORMANIAK_USERNAME`** : Votre nom d'utilisateur SSH
   ```
   Exemple : votre-nom-utilisateur
   ```

3. **`INFORMANIAK_PRIVATE_KEY`** : Votre clé privée SSH
   ```
   Générez une paire de clés SSH et ajoutez la clé publique à votre compte Informaniak
   ```

### Secrets optionnels :

4. **`INFORMANIAK_PORT`** : Port SSH (par défaut : 22)
   ```
   Exemple : 22
   ```

5. **`INFORMANIAK_PROJECT_PATH`** : Chemin vers votre projet sur le serveur
   ```
   Exemple : /home/votre-utilisateur/www/DDOT
   ```

## 🔑 Génération des clés SSH

### Sur Windows (PowerShell) :
```powershell
ssh-keygen -t rsa -b 4096 -C "votre-email@example.com"
```

### Sur macOS/Linux :
```bash
ssh-keygen -t rsa -b 4096 -C "votre-email@example.com"
```

### Configuration sur Informaniak :

1. **Copier la clé publique** :
   ```bash
   cat ~/.ssh/id_rsa.pub
   ```

2. **Ajouter la clé publique à Informaniak** :
   - Connectez-vous à votre panel Informaniak
   - Allez dans **Hébergement > SSH > Clés SSH**
   - Ajoutez votre clé publique

3. **Copier la clé privée pour GitHub** :
   ```bash
   cat ~/.ssh/id_rsa
   ```
   
   Copiez tout le contenu (y compris `-----BEGIN PRIVATE KEY-----` et `-----END PRIVATE KEY-----`)

## 🚀 Configuration du déploiement

### Étape 1 : Configurer les secrets GitHub

1. Allez dans votre repository : `https://github.com/voyageur0/DDOT`
2. Cliquez sur **Settings** > **Secrets and variables** > **Actions**
3. Cliquez sur **New repository secret**
4. Ajoutez chaque secret un par un

### Étape 2 : Premier déploiement

1. **Connexion SSH initiale** :
   ```bash
   ssh votre-utilisateur@votre-domaine.infomaniak.ch
   ```

2. **Cloner le repository** :
   ```bash
   cd /path/to/your/web/directory
   git clone https://github.com/voyageur0/DDOT.git
   cd DDOT
   ```

3. **Configuration initiale** :
   ```bash
   cp env.production.template .env
   nano .env
   # Configurer vos clés API
   ```

4. **Premier démarrage** :
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

### Étape 3 : Test du déploiement automatique

1. **Faire un changement** et pusher :
   ```bash
   git add .
   git commit -m "Test déploiement automatique"
   git push origin main
   ```

2. **Vérifier dans GitHub** :
   - Allez dans **Actions** de votre repository
   - Vérifiez que le workflow s'exécute correctement

## 🔧 Dépannage

### Erreur de connexion SSH :
```
Permission denied (publickey)
```
**Solution** : Vérifiez que votre clé publique est bien ajoutée sur Informaniak

### Erreur de chemin :
```
cd: no such file or directory
```
**Solution** : Vérifiez le secret `INFORMANIAK_PROJECT_PATH`

### Erreur PM2 :
```
pm2: command not found
```
**Solution** : Installez PM2 sur votre serveur :
```bash
npm install -g pm2
```

## 📞 Support

- **Documentation Informaniak SSH** : https://www.infomaniak.com/fr/support/faq/2319/
- **GitHub Actions** : https://docs.github.com/en/actions
- **PM2** : https://pm2.keymetrics.io/

---

**Une fois configuré, votre application se déploiera automatiquement à chaque push sur la branche main !** 🎉 