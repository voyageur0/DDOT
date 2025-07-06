# 📋 Guide d'utilisation - DDOT

## 🎯 Vue d'ensemble

DDOT est un système avancé d'analyse immobilière pour le Valais qui combine :
- **Recherche de parcelles** via les données publiques GeoAdmin
- **Téléchargement de règlements communaux** 
- **Recherche IA** dans les règlements de construction de 23 communes du Valais Romand

## 🔍 1. Recherche de parcelles

### Comment faire une recherche :
1. **Page principale** : Utilisez le champ de recherche en haut
2. **Formats supportés** :
   - Adresse : `Rue du Bourg 12, Sion`
   - Commune + numéro : `Chamoson 435`
   - Coordonnées : `595000 / 125000`

### Que fait la recherche :
- Interroge l'API GeoAdmin pour obtenir les données cadastrales
- Affiche les informations de la parcelle (commune, coordonnées, etc.)
- Propose des actions selon les données disponibles

## 📚 2. Téléchargement de règlements communaux

### Fonctionnement automatique :
- **Où ?** : Après une recherche de parcelle réussie
- **Comment ?** : Le bouton "📚 Règlement Communal" apparaît automatiquement
- **Condition** : La commune doit avoir un règlement disponible dans notre base de données

### Communes supportées :
- Sion, Martigny, Chamoson, Conthey, Vétroz, Ayent, Nendaz, Riddes, Saxon, Sierre, etc.

### Utilisation :
1. Recherchez une parcelle dans une commune supportée
2. Le bouton "Règlement Communal" apparaît dans les actions
3. Cliquez pour télécharger directement le PDF officiel

## 🧠 3. Analyse IA Contraintes (NOUVEAU !)

### Fonctionnalité révolutionnaire :
- **Bouton futuriste** : "🤖 Analyse IA Contraintes" apparaît après sélection d'une parcelle
- **Analyse automatique complète** : Combine RDPPF + règlements communaux + IA
- **Aucune question à poser** : L'IA analyse automatiquement tout

### Comment ça fonctionne :
1. **Recherchez une parcelle** (ex: "Sion rue du Rhône 12")
2. **Cliquez sur le bouton futuriste** "🤖 Analyse IA Contraintes"
3. **L'IA fait tout automatiquement** :
   - 🔍 Consultation des données RDPPF publiques
   - 📚 Lecture du règlement communal
   - 🧠 Analyse des contraintes par IA
   - ⚖️ Classification par sévérité (CRITIQUE/ATTENTION/INFO)

### Résultats obtenus :
- **Résumé de l'analyse** : Vue d'ensemble des contraintes
- **Contraintes détaillées** : Chaque contrainte avec sévérité et source
- **Recommandations** : Conseils pratiques pour votre projet

### Avantages :
- ✅ **Automatique** : Pas besoin de formuler des questions
- ✅ **Complet** : Analyse RDPPF + règlements + contexte local
- ✅ **Visuel** : Interface futuriste avec animations
- ✅ **Pratique** : Contraintes classées par importance

## 🔍 4. Recherche IA dans les règlements (Générale)

### Accès à la recherche IA :
- **Page principale** : Section bleue "Recherche IA dans les règlements communaux"
- **Bouton** : "🔍 Rechercher dans les règlements IA"

### Fonctionnalités :
- **23 communes** du Valais Romand indexées
- **Réponses précises** avec sources citées
- **Pas d'authentification** requise pour la démo

### Communes disponibles pour l'IA :
Arbaz, Ardon, Ayent, Chamoson, Charrat, Conthey, Martigny, Mase, Mollens, Nax, Nendaz, Riddes, Saillon, Saint-Léonard, Salgesch, Savièse, Saxon, Sierre, Sion, Vernamiège, Vérrossaz, Vétroz

### Exemples de questions :
- "Quelle est la hauteur maximale autorisée en zone résidentielle R2 ?"
- "Quel est l'indice d'utilisation du sol pour les zones d'habitation ?"
- "Quelles sont les règles de stationnement à Sion ?"
- "Peut-on construire une piscine en zone villa ?"

### Comment utiliser :
1. Cliquez sur "🔍 Rechercher dans les règlements IA"
2. Tapez votre question dans le champ
3. Appuyez sur "Rechercher" ou la touche Entrée
4. Obtenez une réponse avec les sources citées

## 🎛️ 5. Dashboard (Fonctionnalités Premium)

### Accès :
- **URL** : `/dashboard`
- **Authentification** : Requise
- **Compte** : Créez un compte via "Se connecter / S'inscrire"

### Fonctionnalités :
- **Upload de documents** : Analysez vos propres règlements
- **Historique** : Consultez vos analyses précédentes
- **Recherche avancée** : Dans vos documents personnels
- **Analyses IA** : Résumés, tableaux de faisabilité, questions personnalisées

## 🛠️ 6. Fonctionnalités techniques

### API disponibles :
- `/api/analysis/parcel-constraints` : Analyse IA automatique des contraintes (NOUVEAU)
- `/api/analysis/search` : Recherche IA dans les règlements
- `/api/regulation/:commune` : Téléchargement direct des règlements
- `/api/auth/register` : Création de compte
- `/api/documents` : Gestion des documents (authentifié)

### Technologies utilisées :
- **Backend** : Node.js, Express, SQLite
- **Frontend** : HTML, CSS, JavaScript vanilla
- **IA** : OpenAI GPT pour l'analyse des règlements
- **Recherche** : Recherche vectorielle pour les documents
- **Données** : GeoAdmin API pour les données cadastrales

## 📞 7. Support et développement

### Équipe :
- **Développement** : Blendar Berisha et Oktay Demir
- **Idée et Marketing** : Dylan Taccoz

### État du projet :
- **Version** : Bêta / Développement actif
- **Mises à jour** : Régulières
- **Support** : Via GitHub Issues

## 🚀 8. Démarrage rapide

### Pour tester immédiatement :
1. **Recherche de parcelle** : Tapez "Sion rue du Rhône 12"
2. **Analyse IA automatique** : Cliquez sur le bouton futuriste "🤖 Analyse IA Contraintes" (NOUVEAU !)
3. **Téléchargement** : Cliquez sur "Règlement Communal" si disponible
4. **Recherche IA générale** : Utilisez le bouton bleu en haut, demandez "Quelles sont les règles de construction à Sion ?"

### Pour utiliser les fonctionnalités avancées :
1. Créez un compte via "Se connecter / S'inscrire"
2. Accédez au dashboard via `/dashboard`
3. Uploadez vos propres documents PDF
4. Utilisez les analyses IA personnalisées

## 🔧 9. Troubleshooting

### Problèmes courants :
- **Analyse IA Contraintes ne fonctionne pas** : Vérifiez que le serveur Node.js est démarré et que l'API OpenAI est configurée
- **Bouton futuriste n'apparaît pas** : Assurez-vous d'avoir sélectionné une parcelle valide
- **Erreur RDPPF** : Les données publiques peuvent être temporairement indisponibles
- **Recherche IA générale ne fonctionne pas** : Vérifiez que le serveur Node.js est démarré
- **Règlement non disponible** : Toutes les communes n'ont pas de règlement indexé
- **Erreur de connexion** : Vérifiez l'URL de l'API dans le code

### Solutions :
1. Redémarrez le serveur : `npm start`
2. Vérifiez les logs dans la console pour voir les détails des erreurs
3. Testez l'analyse IA avec des parcelles connues (Sion, Martigny)
4. Pour RDPPF : Vérifiez la connectivité internet et les APIs GeoAdmin
5. Testez avec des exemples connus (Sion, Martigny) 