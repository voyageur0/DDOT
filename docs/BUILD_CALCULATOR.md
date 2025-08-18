# Module de Calcul des Indicateurs de Constructibilité

## Vue d'ensemble

Le module `buildCalculator` est responsable du calcul déterministe et reproductible des indicateurs de constructibilité à partir des règles consolidées et de la surface d'une parcelle. Il produit les métriques essentielles pour l'évaluation de faisabilité : surface utile (SU), surface brute (IBUS), emprise au sol maximale, nombre de niveaux estimé, et un score de fiabilité.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Règles          │────▶│ buildCalculator  │────▶│ Résultats       │
│ Consolidées     │     │                  │     │ - SU, IBUS      │
│ + Surface       │     │ • Extraction     │     │ - Emprise       │
└─────────────────┘     │ • Conversion     │     │ - Niveaux       │
                        │ • Calculs        │     │ - Fiabilité     │
                        │ • Contrôles      │     │ - Contrôles     │
                        └──────────────────┘     └─────────────────┘
```

## Formules de Calcul

### 1. Surface Utile (SU)
```
SU = indice_u × surface_parcelle
```
- **indice_u** : Indice d'utilisation du sol (parties chauffées)
- Arrondi à 1 décimale

### 2. Surface Brute (IBUS)
```
IBUS = ibus × surface_parcelle
```
- **ibus** : Indice brut d'utilisation du sol (toutes surfaces)
- Si IBUS manquant, conversion depuis indice_u selon table du Valais

### 3. Emprise au Sol Maximale
```
Emprise = emprise_max × surface_parcelle
```
- **emprise_max** : Coefficient d'emprise au sol (0-1)

### 4. Nombre de Niveaux Estimé
```
Niveaux = floor(IBUS_m² / Emprise_m²)
```
- Limité par `niveaux_max` réglementaire si défini
- Non calculé si emprise = 0

## Table de Conversion Indice U → IBUS (Valais)

| Indice U | IBUS  | Indice U | IBUS  |
|----------|-------|----------|-------|
| ≤ 0.35   | 0.50  | 0.65     | 0.87  |
| 0.40     | 0.53  | 0.70     | 0.93  |
| 0.45     | 0.60  | 0.75     | 1.00  |
| 0.50     | 0.67  | 0.80     | 1.07  |
| 0.55     | 0.73  | 0.85     | 1.13  |
| 0.60     | 0.80  |          |       |

**Formule générale** : `IBUS = indice_u × 1.333` (minimum 0.5)

## Contrôles Automatiques

### Erreurs (bloquantes)

| Code | Message | Condition |
|------|---------|-----------|
| `INVALID_AREA` | Surface de parcelle invalide ou nulle | area ≤ 0 |
| `IBUS_INCOHERENT` | IBUS inférieur à SU - incohérence | IBUS < SU |

### Avertissements

| Code | Message | Condition |
|------|---------|-----------|
| `MISSING_INDICE_U` | Indice d'utilisation (U) non défini | indice_u absent |
| `MISSING_IBUS` | IBUS non défini et impossible à calculer | ibus absent et indice_u absent |
| `INDICE_U_RANGE` | Indice U hors plage habituelle (0-2) | indice_u ≤ 0 ou > 2 |
| `EMPRISE_RANGE` | Emprise max hors plage habituelle (0-1) | emprise ≤ 0 ou > 1 |

### Informations

| Code | Message | Condition |
|------|---------|-----------|
| `MISSING_EMPRISE` | Emprise au sol maximale non définie | emprise_max absent |
| `IBUS_CONVERTED` | IBUS calculé depuis indice U | Conversion appliquée |
| `NIVEAUX_LIMITED` | Nombre de niveaux limité par le règlement | niveaux > niveaux_max |

## Score de Fiabilité

Le score de fiabilité reflète la complétude des données :

```
Fiabilité = 1.0 - (0.25 × nombre_valeurs_manquantes)
```

- **Base** : 100% (1.0) avec toutes les valeurs
- **Pénalité** : -25% par valeur manquante
- **Minimum** : 25% (0.25)

Valeurs considérées :
- `indice_u` (ou IBUS converti)
- `ibus` 
- `emprise_max`

## Utilisation

### API TypeScript

```typescript
import { computeBuildIndicators, CalcInput } from './buildCalculator';

const input: CalcInput = {
  parcelAreaM2: 1500,
  rules: consolidatedRules // Depuis RuleResolver
};

const result = computeBuildIndicators(input);

console.log(`Surface utile: ${result.suM2} m²`);
console.log(`IBUS: ${result.ibusM2} m²`);
console.log(`Fiabilité: ${result.reliability * 100}%`);
```

### CLI - Calcul Unique

```bash
# Calcul pour une parcelle
npm run calc:parcel -- 10135

# Avec options
npm run calc:parcel -- 10135 --area 1500 --format table --save

# Aide
npm run calc:parcel -- --help
```

### CLI - Calcul en Batch

```bash
# Traiter un fichier CSV
npm run calc:batch -- parcels.csv --save

# Avec limite
npm run calc:batch -- parcels.csv --limit 100 --output results.csv
```

Format CSV attendu :
```csv
id,area_m2,zone_id
10135,1500,223e4567-e89b-12d3-a456-426614174000
10136,2000,223e4567-e89b-12d3-a456-426614174001
```

## Exemple de Résultat

```json
{
  "suM2": 900,
  "ibusM2": 1200,
  "empriseM2": 600,
  "niveauxMaxEst": 2,
  "reliability": 1.0,
  "controls": [
    {
      "code": "IBUS_CONVERTED",
      "level": "info",
      "message": "IBUS calculé depuis indice U (0.6) selon table de conversion: 0.8"
    }
  ],
  "details": {
    "indice_u": 0.6,
    "ibus": 0.8,
    "ibus_calculated": 0.8,
    "emprise_max": 0.4,
    "conversion_applied": true,
    "formulas": {
      "su": "0.6 × 1500 = 900 m²",
      "ibus": "0.8 × 1500 = 1200 m²",
      "emprise": "0.4 × 1500 = 600 m²",
      "niveaux": "floor(1200 / 600) = 2"
    },
    "missing_values": []
  }
}
```

## Cache des Résultats

Les résultats peuvent être stockés dans la table `feasibility_cache` :

```sql
-- Structure du cache
feasibility_cache (
  parcel_id,
  zone_id,
  calc_date,
  su_m2,
  ibus_m2,
  emprise_m2,
  niveaux_max_est,
  reliability,
  controls,
  consolidated_rules
)
```

## Tests

Le module est couvert à >90% par les tests Vitest :

```bash
# Tous les tests
npm run test:engine

# Tests spécifiques
npx vitest tests/engine/calc_basic.test.ts
npx vitest tests/engine/ibus_missing.test.ts
npx vitest tests/engine/control_error.test.ts
npx vitest tests/engine/reliability_score.test.ts
```

## Limitations et Considérations

1. **Arrondis** : Tous les résultats sont arrondis à 1 décimale
2. **Conversion IBUS** : Utilise la table officielle du Valais
3. **Niveaux** : Estimation basique, ne remplace pas une étude architecturale
4. **Fiabilité** : Reflète uniquement la complétude des données, pas leur exactitude

## Évolutions Futures

- [ ] Support multi-zones pour parcelles chevauchantes
- [ ] Prise en compte des contraintes environnementales
- [ ] Calcul du COS (Coefficient d'Occupation du Sol)
- [ ] Intégration avec les servitudes géométriques