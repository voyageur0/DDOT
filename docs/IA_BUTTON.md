# Bouton **IA**

## Diagramme de séquence (textuel)

```
Utilisateur→UI: clique "IA"
UI→Backend: POST /api/ia-constraints {lat, lon}
Backend→GeoAdmin API: identify(lat, lon)
GeoAdmin API→Backend: zone & communeId
Backend→Site communal: téléchargement PDF
Site communal→Backend: texte règlement
Backend→OpenAI (o3-mini): synthèse contraintes
OpenAI→Backend: réponse
Backend→UI: {constraints, elapsedMs}
UI→Utilisateur: affiche contraintes + ⏱
```

## Ajouter d’autres cantons

1. Adapter `fetchParcelZone` pour la couche cantonale.
2. Mettre l’URL du portail communal dans `fetchCommuneReglement`.
3. Tester avec `vitest`.

## Estimation de coût

| Volume (mois) | µs / appel | Prix $ / 1k | Coût mensuel |
|---------------|-----------|-------------|--------------|
| 10 000        | 2 000     | 0.20        | **2 $**      |