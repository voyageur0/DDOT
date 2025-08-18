# Système de Transparence et Traçabilité DDOT

## Vue d'ensemble

Le système de transparence DDOT trace l'origine et la fiabilité de chaque donnée affichée dans les analyses de parcelles. Cette documentation détaille le fonctionnement de la traçabilité des preuves (evidence tracking) et du scoring de qualité.

## Architecture de la Traçabilité

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Sources de      │────▶│ Evidence Items   │────▶│ Quality Score   │
│ Données         │     │ (Preuves)        │     │ (Score 0-1)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
       │                         │                         │
       │                         │                         │
   • Règlements             • Traçabilité            • Score global
   • Contexte env.          • Fiabilité              • Distribution
   • Calculs                • Commentaires           • Tendances
```

## Niveaux de Fiabilité

### 1. **Direct** (Fiabilité maximale)
- Données extraites directement de sources officielles
- Règlements communaux (RCCZ)
- Cadastre du bruit (OPB)
- Cartes de dangers naturels
- **Poids dans le score**: 1.0

### 2. **Derived** (Fiabilité élevée)
- Données calculées à partir de sources directes
- Conversions standardisées (ex: indice U → IBUS)
- Analyses spatiales (distances, intersections)
- **Poids dans le score**: 0.8

### 3. **Estimated** (Fiabilité modérée)
- Estimations basées sur des hypothèses
- Extrapolations raisonnables
- Valeurs par défaut contextuelles
- **Poids dans le score**: 0.5

### 4. **Missing** (Données manquantes)
- Information non disponible
- Sources inaccessibles
- **Poids dans le score**: 0.0

## Tables de Traçabilité

### evidence_items
Stocke chaque preuve avec son origine et sa fiabilité.

```sql
-- Exemple d'entrée
{
  ref_type: 'regulation',
  ref_id: 'uuid-regulation',
  parcel_id: '12345',
  field: 'indice_u',
  value_num: 0.6,
  reliability: 'direct',
  source_path: 'LEVEL3/RCCZ/indice_u/art.42',
  comment: 'RCCZ art. 42 - Zone H2',
  inserted_by: 'ruleResolver'
}
```

### analysis_quality
Agrège les scores de qualité par analyse.

```sql
-- Exemple de score
{
  parcel_id: '12345',
  score_global: 0.85,        -- 85% de fiabilité
  score_regulations: 0.90,   -- Règles bien documentées
  score_context: 0.75,       -- Contexte partiellement estimé
  score_calculations: 0.88,  -- Calculs principalement dérivés
  direct_count: 8,
  derived_count: 4,
  estimated_count: 2,
  missing_count: 1
}
```

## Calcul du Score de Qualité

### Formule Générale
```
Score = Σ(poids_fiabilité × importance_champ) / Σ(importance_champ)
```

### Importance des Champs

| Champ | Importance | Justification |
|-------|-----------|---------------|
| indice_u | 1.0 | Base du calcul SU |
| ibus | 1.0 | Base du calcul constructibilité |
| ibus_m2 | 0.9 | Surface constructible |
| su_m2 | 0.9 | Surface utile |
| emprise_max | 0.7 | Contrainte importante |
| emprise_m2 | 0.7 | Emprise calculée |
| niveaux_max_est | 0.5 | Estimation secondaire |

### Exemple de Calcul
```
Parcelle avec:
- indice_u: direct (1.0 × 1.0 = 1.0)
- ibus: derived (0.8 × 1.0 = 0.8)
- emprise_max: missing (0.0 × 0.7 = 0.0)

Score = (1.0 + 0.8 + 0.0) / (1.0 + 1.0 + 0.7) = 0.67
```

## API de Consultation

### Récupérer les preuves d'une parcelle
```bash
GET /api/evidence/:parcelId

# Réponse
{
  "parcel_id": "12345",
  "evidence_count": 15,
  "evidence_items": [
    {
      "field": "indice_u",
      "value": 0.6,
      "reliability": "direct",
      "source": {
        "type": "regulation",
        "name": "Sion v2023",
        "path": "LEVEL3/RCCZ/indice_u"
      },
      "comment": "RCCZ art. 42"
    }
  ]
}
```

### Consulter le score de qualité
```bash
GET /api/evidence/:parcelId/quality

# Réponse
{
  "parcel_id": "12345",
  "scores": {
    "global": 0.85,
    "regulations": 0.90,
    "context": 0.75,
    "calculations": 0.88
  },
  "reliability_distribution": {
    "direct": 8,
    "derived": 4,
    "estimated": 2,
    "missing": 1
  }
}
```

### Obtenir un résumé consolidé
```bash
GET /api/evidence/:parcelId/summary

# Réponse
{
  "parcel_id": "12345",
  "quality_score": 0.85,
  "evidence_count": 15,
  "fields": {
    "indice_u": {
      "value": 0.6,
      "reliability": "direct",
      "sources": ["regulation"]
    }
  }
}
```

## Intégration dans les Services

### RuleResolver avec Evidence
```typescript
// Utilisation
import { ruleResolverWithEvidence } from './ruleResolverWithEvidence';

const rules = await ruleResolverWithEvidence.resolveRulesByZone(
  zoneId,
  parcelId  // Active la traçabilité
);
```

### ContextResolver avec Evidence
```typescript
// Utilisation
import { getContextForParcelWithEvidence } from './contextResolverWithEvidence';

const flags = await getContextForParcelWithEvidence(
  parcelId,
  geomWkt
);
```

### BuildCalculator avec Evidence
```typescript
// Utilisation
import { computeBuildIndicatorsWithEvidence } from './buildCalculatorWithEvidence';

const result = await computeBuildIndicatorsWithEvidence(
  input,
  parcelId,
  zoneId
);
```

## Cas d'Usage

### 1. Audit de Conformité
Vérifier que toutes les décisions sont basées sur des sources officielles:
```sql
-- Parcelles avec trop de données estimées
SELECT parcel_id, score_global
FROM analysis_quality
WHERE score_global < 0.7
  AND estimated_count > direct_count;
```

### 2. Amélioration Continue
Identifier les champs souvent manquants:
```sql
-- Champs les plus souvent manquants
SELECT field, COUNT(*) as missing_count
FROM evidence_items
WHERE reliability = 'missing'
GROUP BY field
ORDER BY missing_count DESC;
```

### 3. Reporting Qualité
Suivre l'évolution de la qualité des données:
```sql
-- Évolution mensuelle
SELECT 
  DATE_TRUNC('month', calc_date) as month,
  AVG(score_global) as avg_score
FROM analysis_quality
GROUP BY month
ORDER BY month;
```

## Maintenance et Évolution

### Ajout d'une Nouvelle Source
1. Définir le niveau de fiabilité approprié
2. Implémenter la traçabilité dans le service
3. Documenter le source_path standard
4. Mettre à jour les tests

### Amélioration du Scoring
1. Analyser les distributions actuelles
2. Ajuster les poids si nécessaire
3. Valider avec des cas réels
4. Documenter les changements

### Nettoyage des Données
```bash
# Nettoyer les evidences anciennes
npm run clean:evidence --days=90

# Recalculer les scores
npm run recalc:quality --commune=Sion
```

## Bonnes Pratiques

1. **Toujours tracer l'origine** - Chaque valeur doit avoir une evidence
2. **Commenter les conversions** - Expliquer les calculs dérivés
3. **Préférer direct à estimated** - Chercher les sources officielles
4. **Documenter les hypothèses** - Pour les valeurs estimées
5. **Maintenir la cohérence** - Utiliser les mêmes source_path

## Limitations Connues

1. **Performance** - La traçabilité ajoute ~10-20ms par analyse
2. **Stockage** - ~1KB par parcelle analysée
3. **Rétroactivité** - Pas de traçabilité pour les analyses antérieures
4. **Granularité** - Traçabilité au niveau champ, pas sous-champ

## Évolutions Futures

- [ ] Interface utilisateur pour visualiser les preuves
- [ ] Export PDF du rapport de traçabilité
- [ ] Notifications si score < seuil
- [ ] API GraphQL pour requêtes complexes
- [ ] Blockchain pour immuabilité des preuves