# Pipeline de Standardisation des Données - DDOT

Ce document décrit le pipeline de standardisation des données brutes pour le projet DDOT, conformément à la stratégie qualité définie.

## Vue d'ensemble

Le pipeline standardise les entrées (données brutes) provenant de deux sources principales :
1. **PDFs de règlements communaux** - Extraction et normalisation des règles d'urbanisme
2. **APIs géospatiales** - Import des zones d'affectation depuis GeoAdmin et SIT Valais

## Prérequis

### Environnement
- Node.js >= 18.0.0
- PostgreSQL avec extension PostGIS
- Tesseract OCR (pour les PDFs scannés)

### Installation des dépendances
```bash
npm install
```

### Configuration
Créer un fichier `.env` avec :
```env
# Base de données
DATABASE_URL=postgresql://user:password@host:5432/dbname
POSTGRES_URL=postgresql://user:password@host:5432/dbname

# Logs
LOG_LEVEL=info  # debug | info | warn | error

# Chemins
PDF_DIR=./data/pdfs  # Dossier contenant les PDFs à traiter

# APIs (optionnel)
GA_TOKEN=your_geoadmin_token  # Si nécessaire pour certaines couches
```

## Structure du projet

```
/scripts
  /ingest
    ingest_regulation_pdf.js    # Pipeline PDF → JSON → PostgreSQL
    ingest_regulation_geo.js    # Pipeline API → GeoJSON → PostGIS
  /utils
    ocr.js                      # Wrapper Tesseract pour PDFs scannés
    tableExtractor.js           # Extraction intelligente de tableaux
  /mappings
    zone_dictionary.json        # Dictionnaire de normalisation des zones

/migrations
  V20250722__create_regulations_normalized.sql  # Schema PostgreSQL

/tests
  /scripts
    *.test.js                   # Tests unitaires Vitest
```

## Utilisation

### 1. Créer la base de données

Exécuter la migration SQL :
```bash
psql -U your_user -d your_db -f migrations/V20250722__create_regulations_normalized.sql
```

### 2. Ingestion des PDFs

Placer les PDFs dans le dossier `data/pdfs/` (ou configuré via `PDF_DIR`).

Formats de noms supportés :
- `reglement_commune.pdf`
- `RCCZ_Commune_2024.pdf`
- `PAZ_commune.pdf`
- `commune_reglement.pdf`

Lancer l'ingestion :
```bash
npm run ingest:pdf
```

Le pipeline va :
1. Scanner tous les PDFs du dossier
2. Détecter si OCR nécessaire (PDFs scannés)
3. Extraire les tableaux et données structurées
4. Normaliser les codes de zones via le dictionnaire
5. Insérer dans `regulations_normalized` (mode upsert)

### 3. Import des données géospatiales

Importer toutes les communes :
```bash
npm run ingest:geo
```

Importer une commune spécifique :
```bash
npm run ingest:geo riddes
```

Le pipeline va :
1. Interroger l'API GeoAdmin (couche ch.are.bauzonen)
2. Interroger le WFS SIT Valais (paz_zonesaffectation)
3. Convertir en géométries PostGIS
4. Insérer dans `paz_layers`

## Normalisation des données

### Codes de zones

Le dictionnaire `zone_dictionary.json` mappe les codes sources vers des codes normalisés :

| Code source | Code normalisé | Description |
|------------|----------------|-------------|
| R1-R5 | HAB_COLL_1-5 | Habitation collective |
| R10-R60 | HAB_RES_10-60 | Habitation résidentielle |
| H10-H30 | HAB_IND_10-30 | Habitation individuelle |
| T0.3-T1 | TOUR_0_3-1 | Tours/immeubles hauts |
| C1-C3 | CENTRE_1-3 | Centre/cœur de localité |

### Unités normalisées

| Donnée | Format source | Format normalisé |
|--------|---------------|------------------|
| Indice U | 50%, 0.5 | 0.5 (NUMERIC) |
| IBUS | 60%, 0.6 | 0.6 (NUMERIC) |
| Hauteur | 12m, 12 mètres | 12.0 (NUMERIC) |
| Recul | 5m, 5.0 | 5.0 (NUMERIC) |

## Tests

Lancer les tests :
```bash
npm test
```

Avec couverture :
```bash
npm test -- --coverage
```

Les tests vérifient :
- Normalisation des codes de zones
- Parsing des valeurs numériques
- Extraction de patterns (regex)
- Idempotence (pas de doublons)
- Types de données PostgreSQL

## Debugging

### Logs
Les logs utilisent Pino avec niveaux :
- `debug` : Détails d'extraction, patterns trouvés
- `info` : Progression, statistiques
- `warn` : Données manquantes, fallbacks
- `error` : Erreurs fatales

Exemple :
```bash
LOG_LEVEL=debug npm run ingest:pdf
```

### Vérification des données

Après ingestion, vérifier :
```sql
-- Statistiques par commune
SELECT 
  commune_id,
  COUNT(DISTINCT zone_code_source) as zones,
  COUNT(*) as total_rows,
  COUNT(indice_u) as with_indice_u,
  COUNT(ibus) as with_ibus
FROM regulations_normalized
GROUP BY commune_id;

-- Zones géospatiales
SELECT 
  commune_id,
  source,
  COUNT(*) as zones,
  SUM(ST_Area(geometry)) as total_area_m2
FROM paz_layers
GROUP BY commune_id, source;
```

## Rollback

En cas de problème :

1. **Supprimer les données d'une commune** :
```sql
DELETE FROM regulations_normalized WHERE commune_id = 'riddes';
DELETE FROM paz_layers WHERE commune_id = 'riddes';
```

2. **Réinitialiser complètement** :
```sql
TRUNCATE regulations_normalized RESTART IDENTITY;
TRUNCATE paz_layers RESTART IDENTITY;
```

3. **Supprimer les tables** :
```sql
DROP TABLE IF EXISTS regulations_normalized CASCADE;
DROP TABLE IF EXISTS paz_layers CASCADE;
```

## Maintenance

### Ajouter un nouveau code de zone

Éditer `scripts/mappings/zone_dictionary.json` :
```json
{
  "mappings": {
    "NEW_CODE": "NEW_NORMALIZED_CODE"
  }
}
```

### Ajouter une nouvelle source géospatiale

Dans `scripts/ingest/ingest_regulation_geo.js`, ajouter une fonction :
```javascript
async function fetchNewSourceZones(communeName) {
  // Implémenter l'appel API
  // Retourner au format standard
}
```

### Optimisations possibles

1. **Parallélisation** : Traiter plusieurs PDFs/communes en parallèle
2. **Cache** : Mettre en cache les résultats OCR
3. **Incremental** : Ne traiter que les fichiers modifiés
4. **Monitoring** : Ajouter des métriques Prometheus

## Troubleshooting

### "OCR échoue"
- Vérifier que Tesseract est installé : `tesseract --version`
- Installer les langues : `sudo apt-get install tesseract-ocr-fra tesseract-ocr-deu`

### "Connexion PostgreSQL échoue"
- Vérifier `DATABASE_URL` ou `POSTGRES_URL`
- Tester : `psql $DATABASE_URL -c "SELECT 1"`

### "Aucune zone trouvée pour commune X"
- Vérifier l'orthographe exacte dans les APIs
- Certaines petites communes peuvent ne pas avoir de données

### "Doublons lors de l'ingestion"
- Normal : utilise UPSERT, les données sont mises à jour
- La contrainte UNIQUE empêche les vrais doublons

## Support

Pour toute question sur le pipeline :
1. Consulter les logs en mode `debug`
2. Vérifier les tests unitaires pour des exemples
3. Ouvrir une issue sur le dépôt Git