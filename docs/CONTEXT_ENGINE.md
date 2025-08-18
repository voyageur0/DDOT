# Moteur de Contexte Environnemental DDOT

## Vue d'ensemble

Le moteur de contexte enrichit chaque analyse de parcelle avec des contraintes environnementales et réglementaires externes provenant de sources officielles suisses. Il analyse automatiquement les intersections spatiales avec des couches de données géoréférencées (bruit, aéroport, risques naturels, pente, proximité routes) et synthétise ces informations en points hiérarchisés.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Parcelle        │────▶│ contextResolver  │────▶│ Flags contexte  │
│ (ID + Géométrie)│     │                  │     │ - Layer         │
└─────────────────┘     │ • Check spatial  │     │ - Severity      │
                        │ • Cache lookup   │     │ - Message       │
                        │ • Format results │     └─────────────────┘
                        └──────────────────┘              │
                                 │                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │ context_layers   │     │ contextFormatter│
                        │ (PostGIS)        │     │ → Notes (≤5)    │
                        └──────────────────┘     └─────────────────┘
```

## Sources de Données

### 1. Zones de Bruit (OPB)
- **Source** : [GeoAdmin - Cadastre du bruit](https://map.geo.admin.ch/?topic=bafu&layers=ch.bafu.laerm-strassenlaerm_tag)
- **Licence** : Données publiques de la Confédération
- **Mise à jour** : Annuelle
- **Couches** : `opb_noise`, `opb_noise_ds_*`

### 2. Surfaces Aéroportuaires (OFAC)
- **Source** : [Office fédéral de l'aviation civile](https://www.bazl.admin.ch/)
- **Licence** : PSIA (Plan sectoriel de l'infrastructure aéronautique)
- **Mise à jour** : Selon révisions PSIA
- **Couches** : `ofac_airport`, `ofac_airport_*`

### 3. Dangers Naturels
- **Source** : [SIT Valais - Cartes des dangers](https://sitonline.vs.ch/dangers-naturels)
- **Licence** : Canton du Valais
- **Mise à jour** : Continue (par commune)
- **Couches** : `risk_nat`, `risk_nat_*`

### 4. Routes Cantonales
- **Source** : [SIT Valais - Réseau routier](https://sitonline.vs.ch/reseau-routier)
- **Licence** : Canton du Valais
- **Mise à jour** : Trimestrielle
- **Couches** : `roads_cantonal`

### 5. Modèle Numérique de Terrain (Pente)
- **Source** : [swissALTI3D](https://www.swisstopo.admin.ch/fr/geodata/height/alti3d.html)
- **Licence** : Swisstopo
- **Mise à jour** : Cycle 6 ans
- **Couches** : `slope_pct`

## Règles de Calcul de Sévérité

### Niveaux de Sévérité

| Niveau | Code | Description | Couleur UI |
|--------|------|-------------|------------|
| 1 | INFO | Information contextuelle | Bleu |
| 2 | WARNING | Contrainte importante | Orange |
| 3 | CRITICAL | Contrainte critique | Rouge |

### Calcul par Couche

#### Bruit (OPB)
```
DS I, DS II → Severity 1 (INFO)
DS III → Severity 2 (WARNING)
DS IV, DS V → Severity 3 (CRITICAL)
```

#### Aéroport (OFAC)
```
Toute intersection → Severity 2 (WARNING)
```

#### Risques Naturels
```
Danger faible → Severity 1 (INFO)
Danger moyen → Severity 2 (WARNING)
Danger fort/très fort → Severity 3 (CRITICAL)
```

#### Routes Cantonales
```
Distance < 25m → Severity 2 (WARNING)
Distance 25-100m → Severity 1 (INFO)
Distance > 100m → Non reporté
```

#### Pente
```
0-30% → Severity 1 (INFO)
30-45% → Severity 2 (WARNING)
>45% → Severity 3 (CRITICAL)
```

## API

### getContextForParcel

```typescript
async function getContextForParcel(
  parcelId: string,
  geomWkt: string
): Promise<ContextFlag[]>
```

**Paramètres** :
- `parcelId` : Identifiant unique de la parcelle
- `geomWkt` : Géométrie en format WKT (SRID 2056 - LV95)

**Retour** : Array de maximum 5 `ContextFlag` triés par sévérité décroissante

### summarizeContext

```typescript
function summarizeContext(
  flags: ContextFlag[], 
  limit: number = 5
): string[]
```

**Paramètres** :
- `flags` : Tableau de flags contextuels
- `limit` : Nombre maximum de messages (défaut: 5)

**Retour** : Messages formatés en français

## Exemple Complet

### Requête
```typescript
const parcelId = "10135";
const geomWkt = "POLYGON((2594000 1119500, 2594100 1119500, 2594100 1119600, 2594000 1119600, 2594000 1119500))";

const flags = await getContextForParcel(parcelId, geomWkt);
const notes = summarizeContext(flags);
```

### Réponse JSON
```json
{
  "context_flags": [
    {
      "layer": "risk_nat",
      "intersects": true,
      "valueText": "glissement moyen",
      "severity": 3,
      "message": "Zone de danger glissement de terrain élevé - Construction très limitée",
      "metadata": {
        "hazard_type": "glissement",
        "danger_level": "fort"
      }
    },
    {
      "layer": "opb_noise",
      "intersects": true,
      "valueText": "DS III",
      "severity": 2,
      "message": "Zone de bruit DS III - Isolation recommandée"
    },
    {
      "layer": "slope_pct",
      "intersects": true,
      "valueNum": 35,
      "severity": 2,
      "message": "Pente importante (35%) - Terrassements conséquents"
    },
    {
      "layer": "ofac_airport",
      "intersects": true,
      "severity": 2,
      "message": "Zone de sécurité aéroport (OFAC)"
    },
    {
      "layer": "roads_cantonal",
      "intersects": false,
      "distance": 18,
      "severity": 2,
      "message": "À 18m d'une route cantonale - Recul obligatoire"
    }
  ],
  "context_notes": [
    "Zone de danger glissement de terrain élevé - Construction très limitée",
    "Zone de bruit DS III - Isolation recommandée",
    "Pente importante (35%) - Terrassements conséquents",
    "Zone de sécurité aéroport (OFAC)",
    "À 18m d'une route cantonale - Recul obligatoire"
  ]
}
```

## Cache et Performance

### Stratégie de Cache
- **Durée** : 30 jours par défaut
- **Table** : `parcel_context`
- **Clé** : `(parcel_id, layer_id)`
- **Invalidation** : Automatique après expiration

### Optimisations
1. Index spatial GIST sur `context_layers.geom`
2. Cache des résultats par parcelle
3. Requêtes spatiales groupées
4. Limitation à 5 flags maximum

## Procédure de Mise à Jour

### Import Initial
```bash
# Toutes les couches
npm run ingest:context

# Ou individuellement
npm run ingest:opb
npm run ingest:ofac
npm run ingest:risques
npm run ingest:routes
npm run ingest:slope
```

### Rafraîchissement Périodique
1. Télécharger les nouvelles données depuis les sources officielles
2. Placer dans `/data/context/[layer]/`
3. Exécuter le script d'import correspondant
4. Vérifier dans `v_context_layer_stats`

### Nettoyage du Cache
```sql
-- Nettoyer le cache de plus de 30 jours
SELECT clean_parcel_context_cache(30);

-- Forcer le recalcul pour une commune
DELETE FROM parcel_context 
WHERE parcel_id IN (
  SELECT id FROM parcels WHERE commune = 'Sion'
);
```

## Limitations et Considérations

1. **Précision** : Les analyses sont indicatives et ne remplacent pas une étude officielle
2. **Actualité** : Dépend de la fréquence de mise à jour des sources
3. **Couverture** : Limitée au canton du Valais pour certaines couches
4. **Performance** : ~100-200ms par parcelle (avec cache froid)

## Évolutions Futures

- [ ] Intégration zones de protection des eaux
- [ ] Périmètres de protection du patrimoine
- [ ] Servitudes de passage
- [ ] Analyse temporelle (évolution des contraintes)
- [ ] API de notification des changements