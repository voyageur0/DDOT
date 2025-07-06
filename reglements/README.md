# Ajout Manuel de Règlements Communaux

Ce dossier est destiné à stocker les PDFs de règlements communaux que vous souhaitez ajouter à la base de données.

## 📁 Organisation

Placez vos fichiers PDF dans ce dossier avec des noms descriptifs :
- `geneve_reglement_urbanisme.pdf`
- `lausanne_reglement_zones.pdf`
- `montreux_plan_amenagement.pdf`

## 🚀 Comment ajouter un règlement

### 1. Placer le PDF
Copiez votre fichier PDF dans ce dossier `reglements/`

### 2. Exécuter le script
Depuis la racine du projet, utilisez la commande :

```bash
node scripts/add-reglement.js ./reglements/nom-du-fichier.pdf "Nom de la Commune" "type-document"
```

### 3. Exemples d'utilisation

```bash
# Ajouter un règlement d'urbanisme pour Genève
node scripts/add-reglement.js ./reglements/geneve_reglement.pdf "Genève" "reglement"

# Ajouter un plan d'aménagement pour Lausanne
node scripts/add-reglement.js ./reglements/lausanne_plan.pdf "Lausanne" "plan_amenagement"

# Ajouter un règlement de zone pour Montreux (type par défaut = reglement)
node scripts/add-reglement.js ./reglements/montreux_zones.pdf "Montreux"
```

## 📋 Types de documents supportés

- `reglement` : Règlement d'urbanisme (par défaut)
- `plan_amenagement` : Plan d'aménagement
- `zone_affectation` : Plan de zones d'affectation
- `cadastre` : Extrait de cadastre
- `autre` : Autre type de document

## ✅ Ce qui se passe lors de l'ajout

1. **Vérification** : Le script vérifie que le fichier PDF existe
2. **Copie** : Le PDF est copié dans le dossier `uploads/`
3. **Base de données** : Une entrée est créée dans la base de données
4. **Extraction** : Le contenu du PDF est extrait automatiquement
5. **Indexation** : Le document est indexé pour la recherche sémantique
6. **Analyse** : Les données d'urbanisme sont extraites (IBUS, hauteurs, etc.)

## 📊 Résultat

Après l'ajout, le règlement sera :
- ✅ Visible dans l'interface web
- ✅ Searchable via la recherche sémantique
- ✅ Analysable avec les fonctionnalités IA
- ✅ Accessible à tous les utilisateurs

## 🔍 Verification

Pour vérifier que le règlement a été ajouté :
1. Lancez l'application : `npm start`
2. Connectez-vous avec un compte utilisateur
3. Le document devrait apparaître dans la liste des documents

## ⚠️ Notes importantes

- Les PDFs doivent être lisibles (pas seulement des images scannées)
- Pour les PDFs scannés, l'OCR sera utilisé automatiquement
- La taille maximale recommandée est de 50 MB
- Les noms de commune doivent être en français

## 🆘 En cas d'erreur

Si le script échoue :
1. Vérifiez que le chemin du fichier est correct
2. Assurez-vous que le PDF n'est pas corrompu
3. Vérifiez que la base de données est accessible
4. Consultez les logs d'erreur pour plus de détails 