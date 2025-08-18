# Normalisation Linguistique et Internationalisation DDOT

## Vue d'ensemble

Le système de normalisation linguistique DDOT garantit l'uniformité et la concision de tous les libellés affichés, tout en préparant l'application pour une utilisation multilingue (FR/DE/EN).

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Codes techniques│────▶│ Label Dictionary │────▶│ Libellés courts │
│ (R1, DS_III)   │     │ (Multilingue)    │     │ (≤12 mots)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │                       │                         │
    • Zones                 • FR/DE/EN              • Uniformes
    • Contraintes          • Court/Long            • Hiérarchisés
    • Champs               • Sévérité              • Traduits
```

## Structure du Dictionnaire

### Table `label_dictionary`

| Colonne | Type | Description |
|---------|------|-------------|
| code | text | Code technique immuable (ex: 'R1', 'opb_noise_DS_III') |
| type | text | Type de label: 'zone', 'constraint', 'field', 'message' |
| label_fr_short | text | Label court français (≤12 mots) |
| label_fr_long | text | Label long français (optionnel) |
| label_de_short | text | Label court allemand |
| label_en_short | text | Label court anglais |
| severity | int | 1=INFO, 2=WARNING, 3=CRITICAL (contraintes uniquement) |
| category | text | Catégorie pour regroupement |

### Types de Labels

#### 1. **Zones** (`type = 'zone'`)
Libellés des zones d'affectation.

```
Code: R1
FR: Hab. collectives
DE: Mehrfamilienhäuser
EN: Multi-family housing
```

#### 2. **Contraintes** (`type = 'constraint'`)
Messages de contraintes environnementales avec sévérité.

```
Code: opb_noise_DS_III
FR: Bruit DS III - Isolation requise
DE: Lärm ES III - Isolation nötig
EN: Noise DS III - Insulation required
Severity: 2 (WARNING)
```

#### 3. **Champs** (`type = 'field'`)
Noms des champs de règles.

```
Code: indice_u
FR: Indice U
DE: Nutzungsziffer
EN: Land use index
```

## Convention de Sévérité

### Niveaux
1. **INFO (1)** - Information contextuelle sans impact majeur
2. **WARNING (2)** - Contrainte importante nécessitant attention
3. **CRITICAL (3)** - Contrainte critique pouvant bloquer le projet

### Exemples par Catégorie

| Catégorie | INFO | WARNING | CRITICAL |
|-----------|------|---------|----------|
| Bruit | DS I, DS II | DS III | DS IV |
| Pente | 0-30% | 30-45% | >45% |
| Dangers | Faible | Moyen | Fort |
| Routes | 25-100m | <25m | - |

## API d'Utilisation

### Service labelService

```typescript
import { getLabel, getSeverity, Lang } from '../i18n/labelService';

// Récupérer un label
const zoneLabel = await getLabel('R1', 'zone', 'fr', false);
// => "Hab. collectives"

// Version longue
const zoneLabelLong = await getLabel('R1', 'zone', 'fr', true);
// => "Zone d'habitations collectives (R1)"

// Autre langue
const zoneLabelDe = await getLabel('R1', 'zone', 'de');
// => "Mehrfamilienhäuser"

// Sévérité d'une contrainte
const severity = await getSeverity('opb_noise_DS_III');
// => 2
```

### Utilitaire summarizer

```typescript
import { truncateSentence, formatConstraintMessage } from '../i18n/summarizer';

// Tronquer à 12 mots
const short = truncateSentence(longText, 12);

// Formater une contrainte
const message = formatConstraintMessage('Zone bruit', 'isolation requise');
// => "Zone bruit - isolation requise"
```

## Processus d'Ajout de Traductions

### 1. Ajouter une Nouvelle Zone

```sql
INSERT INTO label_dictionary (code, type, label_fr_short, label_fr_long, label_de_short, label_en_short)
VALUES (
  'NEW_ZONE',
  'zone',
  'Nouvelle zone',
  'Zone de développement nouvelle',
  'Neue Zone',
  'New zone'
);
```

### 2. Ajouter une Nouvelle Contrainte

```sql
INSERT INTO label_dictionary (code, type, label_fr_short, severity, category)
VALUES (
  'new_constraint',
  'constraint',
  'Nouvelle contrainte - Action requise',
  2,
  'new_category'
);
```

### 3. Import en Masse

Utiliser les scripts d'ingestion :

```bash
# Zones
npm run labels:zones

# Contraintes
npm run labels:constraints

# Champs
npm run labels:fields

# Tout
npm run ingest:labels
```

## Exemples Avant/Après

### Zones

**Avant:**
```
R1
Zone résidentielle de forte densité avec habitations collectives
```

**Après:**
```
Hab. collectives
Zone d'habitations collectives (R1)
```

### Contraintes

**Avant:**
```
La parcelle se trouve dans une zone de bruit de degré de sensibilité III selon l'ordonnance sur la protection contre le bruit
```

**Après:**
```
Bruit DS III - Isolation requise
```

### Champs

**Avant:**
```
indice_u
Indice d'utilisation du sol selon règlement communal
```

**Après:**
```
Indice U
```

## Règles de Rédaction

### Labels Courts (≤12 mots)

1. **Privilégier les abréviations connues** : DS, IBUS, max, min
2. **Omettre les articles** : "Hab. collectives" au lieu de "Zone d'habitations collectives"
3. **Utiliser des tirets** : "Bruit DS III - Isolation requise"
4. **Éviter la redondance** : "Pente 35%" au lieu de "Pente de 35 pourcent"

### Hiérarchisation des Messages

1. **Critique d'abord** : Les messages de sévérité 3
2. **Puis avertissements** : Les messages de sévérité 2
3. **Enfin informations** : Les messages de sévérité 1
4. **Maximum 5 messages** : Limitation pour la lisibilité

### Traductions

1. **Cohérence terminologique** : Utiliser les termes officiels
2. **Adaptation culturelle** : OFAC → BAZL → FOCA
3. **Fallback intelligent** : DE/EN → FR → Code

## Intégration dans l'Application

### feasibilityCalculator

```typescript
// Avant
result.zone = "R1";
result.height_label = "Hauteur maximale à la corniche";

// Après
result.zone = await getLabel('R1', 'zone', lang, true);
result.height_label = await getLabel('h_max_m', 'field', lang);
```

### contextFormatter

```typescript
// Utilise automatiquement les labels normalisés
const messages = await summarizeContext(flags, 'fr', 5);
// => ["Danger fort - Construction interdite", "Bruit DS III - Isolation requise", ...]
```

## Statistiques et Monitoring

### Vue de Couverture

```sql
SELECT * FROM v_translation_coverage;
```

| type | total_labels | fr_short | de_short | en_short | de_coverage_pct | en_coverage_pct |
|------|--------------|----------|----------|----------|-----------------|-----------------|
| zone | 20 | 20 | 18 | 16 | 90.0 | 80.0 |
| constraint | 25 | 25 | 20 | 22 | 80.0 | 88.0 |
| field | 30 | 30 | 25 | 28 | 83.3 | 93.3 |

### Vérification de Longueur

```sql
-- Labels trop longs
SELECT code, label_fr_short, 
       array_length(string_to_array(label_fr_short, ' '), 1) as word_count
FROM label_dictionary
WHERE array_length(string_to_array(label_fr_short, ' '), 1) > 12;
```

## Maintenance

### Mise à Jour des Labels

```sql
-- Modifier un label existant
UPDATE label_dictionary
SET label_fr_short = 'Nouveau libellé court',
    updated_at = now()
WHERE code = 'R1' AND type = 'zone';
```

### Ajout de Langue

Pour ajouter une nouvelle langue (ex: italien) :

1. Ajouter les colonnes dans la migration
2. Mettre à jour le type `Lang` dans labelService
3. Ajouter les traductions progressivement
4. Tester le fallback

### Performance

- **Cache en mémoire** : 5 minutes TTL
- **Requêtes groupées** : `getLabels()` pour plusieurs labels
- **Préchargement** : `preloadCommonLabels()` au démarrage

## Limitations et Évolutions

### Limitations Actuelles

1. **3 langues maximum** : FR, DE, EN
2. **12 mots par message** : Contrainte stricte
3. **Pas de pluriels** : Gestion manuelle
4. **Pas de contexte** : Labels statiques

### Évolutions Futures

- [ ] Support des variantes régionales (FR-CH, DE-CH)
- [ ] Gestion automatique des pluriels
- [ ] Labels contextuels (selon utilisateur)
- [ ] Interface de gestion des traductions
- [ ] Export/Import CSV des labels