# Moteur de Règles Hiérarchique DDOT

## Vue d'ensemble

Le moteur de règles hiérarchique est un système avancé de gestion des contraintes urbanistiques qui résout automatiquement les conflits entre différentes sources réglementaires selon une hiérarchie de priorités prédéfinie.

## Architecture

### Hiérarchie des Règles

Le moteur utilise 4 niveaux de priorité (du plus prioritaire au moins prioritaire) :

1. **LEVEL1 - Servitudes et PSQ** : Contraintes les plus restrictives (servitudes de droit public, plans spéciaux de quartier)
2. **LEVEL2 - PAZ Compléments** : Plans d'aménagement de zones et règles complémentaires communales
3. **LEVEL3 - RCCZ** : Règlements communaux de construction et de zones
4. **LEVEL4 - Cantonal/Fédéral** : Lois cantonales et fédérales (OPB, LAT, OFAC, LC)

### Base de Données

```sql
-- Table principale des définitions de règles
rule_definitions (
  id uuid PRIMARY KEY,
  zone_id uuid REFERENCES zones(id),
  level rule_level NOT NULL, -- ENUM: LEVEL1, LEVEL2, LEVEL3, LEVEL4
  field text NOT NULL,       -- Nom du champ (h_max_m, indice_u, etc.)
  value_num numeric,         -- Valeur numérique
  value_text text,           -- Valeur textuelle
  value_json jsonb,          -- Valeur complexe (tableaux, objets)
  description text,
  source_id uuid REFERENCES regulation_sources(id),
  validity_from date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT NOW()
)

-- Index unique pour éviter les doublons
CREATE UNIQUE INDEX idx_rule_definitions_unique 
ON rule_definitions (zone_id, field, level, validity_from);
```

## Utilisation

### Installation et Configuration

```bash
# Variables d'environnement requises
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Scripts d'Ingestion

```bash
# Ingestion individuelle par niveau
npm run ingest:psq        # LEVEL1 - Servitudes et PSQ
npm run ingest:paz        # LEVEL2 - Compléments PAZ
npm run ingest:rccz       # LEVEL3 - Migration RCCZ existants
npm run ingest:cantonal   # LEVEL4 - Règles cantonales/fédérales

# Ingestion complète dans l'ordre
npm run ingest:all-rules
```

### Tests

```bash
# Exécuter tous les tests du moteur
npm run test:engine

# Tests spécifiques
npx vitest tests/engine/priority_resolution.test.ts
npx vitest tests/engine/geom_resolution.test.ts
npx vitest tests/engine/idempotent_ingest.test.ts
```

## API du Moteur

### RuleResolver

Service principal pour la résolution des règles :

```typescript
import { RuleResolver } from './src/engine/ruleResolver';

const resolver = new RuleResolver();

// Résoudre les règles pour une zone
const rules = await resolver.resolveRulesByZone(zoneId);

// Résoudre les règles pour une géométrie de parcelle
const rulesForParcel = await resolver.resolveRulesByParcelGeom(wktGeometry);

// Insérer des règles (idempotent)
await resolver.insertRulesBatch([
  {
    zone_id: 'zone-uuid',
    level: RuleLevel.LEVEL1,
    field: 'h_max_m',
    value: 12,
    description: 'Hauteur maximale selon servitude'
  }
]);
```

### Structure des Règles Consolidées

```typescript
interface ConsolidatedRule {
  field: string;           // Nom du champ
  value: any;             // Valeur applicable
  level: RuleLevel;       // Niveau de priorité
  overridden: Array<{     // Règles écrasées
    level: string;
    value: any;
  }>;
  description?: string;
  zone_id?: string;
  zone_code?: string;
}
```

### Intégration avec FeasibilityCalculator

Le moteur est intégré dans le service de calcul de faisabilité :

```typescript
import { feasibilityCalculator } from './src/services/feasibilityCalculator';

// Génère un tableau de faisabilité avec résolution hiérarchique
const result = await feasibilityCalculator.generateFeasibilityTable(
  zoneId,
  projectData
);

// Le résultat inclut les surcharges
console.log(result.overrides); // Montre quelles règles ont été écrasées
```

## Exemples de Résolution

### Exemple 1 : Hauteur Maximale

Zone avec règles conflictuelles :
- LEVEL4 (LC) : 20m (loi cantonale)
- LEVEL3 (RCCZ) : 15m (règlement communal)  
- LEVEL1 (Servitude) : 12m (servitude de vue)

**Résultat** : 12m (LEVEL1 prévaut)

### Exemple 2 : Parcelle Multi-Zones

Parcelle chevauchant 2 zones :
- Zone A : h_max_m = 10m, indice_u = 0.4
- Zone B : h_max_m = 15m, indice_u = 0.6

**Résultat** : Les deux ensembles de règles sont retournés avec identification de zone

## Maintenance

### Ajout de Nouvelles Sources

1. Créer un script d'ingestion dans `scripts/ingest/`
2. Utiliser `RuleResolver.insertRulesBatch()` pour l'insertion idempotente
3. Ajouter le script npm dans `package.json`
4. Documenter la source et sa priorité

### Modification des Priorités

Les niveaux de priorité sont définis dans l'ENUM PostgreSQL. Pour modifier :

```sql
-- Attention : nécessite migration complexe
ALTER TYPE rule_level ADD VALUE 'LEVEL5' AFTER 'LEVEL4';
```

### Monitoring

```sql
-- Statistiques par niveau
SELECT level, COUNT(*) as count
FROM rule_definitions
GROUP BY level
ORDER BY level;

-- Règles en conflit pour une zone
SELECT field, 
       COUNT(DISTINCT level) as conflict_count,
       array_agg(DISTINCT level ORDER BY level) as levels
FROM rule_definitions
WHERE zone_id = 'your-zone-id'
GROUP BY field
HAVING COUNT(DISTINCT level) > 1;
```

## Considérations de Performance

- Les règles sont chargées une fois par zone et mises en cache côté application
- L'index unique garantit des recherches rapides O(log n)
- Les requêtes spatiales utilisent les index PostGIS
- Le batch insert réduit les allers-retours DB

## Limitations Connues

1. **Géométries complexes** : Les parcelles très complexes peuvent ralentir la résolution spatiale
2. **Historique** : Seule la dernière version valide est utilisée (pas d'historique complet)
3. **Conflits de même niveau** : Entre deux règles de même niveau, la plus récente prévaut

## Roadmap

- [ ] Interface d'administration pour la gestion manuelle des règles
- [ ] Export des conflits détectés pour analyse
- [ ] Règles conditionnelles (si X alors Y)
- [ ] Versioning complet avec historique
- [ ] Cache Redis pour performances accrues