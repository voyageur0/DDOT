# Configuration Google OAuth pour DDOT

## Problème actuel
L'erreur "redirect_uri_mismatch" indique que l'URL de callback n'est pas correctement configurée.

## Configuration requise dans Google Cloud Console

1. **Accédez à** : https://console.cloud.google.com/
2. **Sélectionnez votre projet**
3. **APIs & Services → Credentials**
4. **Cliquez sur votre OAuth 2.0 Client ID**

## URLs à configurer

### Authorized JavaScript origins
```
http://localhost:3001
http://127.0.0.1:3001
```

### Authorized redirect URIs
Ajoutez ces DEUX URLs :
```
http://localhost:3001/api/auth/callback
http://127.0.0.1:3001/api/auth/callback
```

## Important
- Les URLs doivent être EXACTEMENT identiques (pas de slash final)
- Incluez les deux versions (localhost et 127.0.0.1)
- Sauvegardez les changements dans Google Cloud Console
- Attendez 5-10 minutes pour la propagation

## Test
Après configuration, l'authentification Google devrait fonctionner en cliquant sur "Se connecter avec Google".