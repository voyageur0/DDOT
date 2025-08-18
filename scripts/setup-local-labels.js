const Database = require('better-sqlite3');
const path = require('path');

// Créer/ouvrir la base de données locale
const db = new Database(path.join(__dirname, '../data.db'));

console.log('🔧 Configuration des labels en local (SQLite)...\n');

// Créer la table label_dictionary
db.exec(`
  CREATE TABLE IF NOT EXISTS label_dictionary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('zone', 'constraint', 'field', 'message')),
    label_fr_short TEXT NOT NULL,
    label_fr_long TEXT,
    label_de_short TEXT,
    label_en_short TEXT,
    severity INTEGER CHECK (severity >= 1 AND severity <= 3),
    category TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(type, code)
  );
`);

// Insérer les labels de zones
const zoneLabels = [
  { code: 'R1', label_fr_short: 'Hab. collectives', label_fr_long: "Zone d'habitations collectives (R1)", label_de_short: 'Mehrfamilienhäuser', label_en_short: 'Multi-family housing' },
  { code: 'R2', label_fr_short: 'Hab. individuelles', label_fr_long: "Zone d'habitations individuelles (R2)", label_de_short: 'Einfamilienhäuser', label_en_short: 'Single-family housing' },
  { code: 'R3', label_fr_short: 'Résidentiel mixte', label_fr_long: 'Zone résidentielle mixte (R3)', label_de_short: 'Mischzone Wohnen', label_en_short: 'Mixed residential' },
  { code: 'C1', label_fr_short: 'Centre-ville', label_fr_long: 'Zone centre-ville (C1)', label_de_short: 'Stadtzentrum', label_en_short: 'City center' },
  { code: 'C2', label_fr_short: 'Commercial', label_fr_long: 'Zone commerciale (C2)', label_de_short: 'Gewerbe', label_en_short: 'Commercial' },
  { code: 'I1', label_fr_short: 'Industriel léger', label_fr_long: 'Zone industrielle légère (I1)', label_de_short: 'Leichtindustrie', label_en_short: 'Light industrial' },
  { code: 'A1', label_fr_short: 'Agricole', label_fr_long: 'Zone agricole (A1)', label_de_short: 'Landwirtschaft', label_en_short: 'Agricultural' },
  { code: 'V1', label_fr_short: 'Espace vert', label_fr_long: 'Zone verte/parc (V1)', label_de_short: 'Grünzone', label_en_short: 'Green space' }
];

const insertZone = db.prepare(`
  INSERT OR REPLACE INTO label_dictionary (code, type, label_fr_short, label_fr_long, label_de_short, label_en_short)
  VALUES (@code, 'zone', @label_fr_short, @label_fr_long, @label_de_short, @label_en_short)
`);

console.log('📍 Insertion des labels de zones...');
for (const zone of zoneLabels) {
  insertZone.run(zone);
  console.log(`  ✅ ${zone.code}: ${zone.label_fr_short}`);
}

// Insérer les labels de contraintes
const constraintLabels = [
  // Bruit
  { code: 'opb_noise_DS_I', label_fr_short: 'Bruit DS I - Zone calme', severity: 1, category: 'Bruit' },
  { code: 'opb_noise_DS_II', label_fr_short: 'Bruit DS II - Zone modérée', severity: 1, category: 'Bruit' },
  { code: 'opb_noise_DS_III', label_fr_short: 'Bruit DS III - Isolation requise', severity: 2, category: 'Bruit' },
  { code: 'opb_noise_DS_IV', label_fr_short: 'Bruit DS IV - Forte isolation', severity: 3, category: 'Bruit' },
  
  // Pente
  { code: 'slope_0_30', label_fr_short: 'Pente douce - Construction standard', severity: 1, category: 'Topographie' },
  { code: 'slope_30_45', label_fr_short: 'Pente forte - Terrassements importants', severity: 2, category: 'Topographie' },
  { code: 'slope_45_plus', label_fr_short: 'Pente très forte - Restrictions', severity: 3, category: 'Topographie' },
  
  // Dangers naturels
  { code: 'risk_nat_faible', label_fr_short: 'Danger faible - Mesures simples', severity: 1, category: 'Dangers naturels' },
  { code: 'risk_nat_moyen', label_fr_short: 'Danger moyen - Étude requise', severity: 2, category: 'Dangers naturels' },
  { code: 'risk_nat_fort', label_fr_short: 'Danger fort - Construction interdite', severity: 3, category: 'Dangers naturels' },
  
  // Routes
  { code: 'roads_25_100m', label_fr_short: 'Route proche - Recul standard', severity: 1, category: 'Infrastructure' },
  { code: 'roads_0_25m', label_fr_short: 'Route très proche - Recul obligatoire', severity: 2, category: 'Infrastructure' },
  
  // Patrimoine
  { code: 'monument_protected', label_fr_short: 'Monument protégé - Restrictions', severity: 3, category: 'Patrimoine' },
  { code: 'site_protected', label_fr_short: 'Site protégé - Consultation requise', severity: 2, category: 'Patrimoine' },
  
  // Environnement
  { code: 'forest_edge', label_fr_short: 'Lisière forêt - Distance 10m', severity: 2, category: 'Environnement' },
  { code: 'water_protection', label_fr_short: 'Protection eaux - Restrictions', severity: 2, category: 'Environnement' }
];

const insertConstraint = db.prepare(`
  INSERT OR REPLACE INTO label_dictionary (code, type, label_fr_short, severity, category)
  VALUES (@code, 'constraint', @label_fr_short, @severity, @category)
`);

console.log('\n⚠️  Insertion des labels de contraintes...');
for (const constraint of constraintLabels) {
  insertConstraint.run(constraint);
  console.log(`  ✅ [Sév.${constraint.severity}] ${constraint.code}: ${constraint.label_fr_short}`);
}

// Insérer les labels de champs
const fieldLabels = [
  { code: 'indice_u', label_fr_short: 'Indice U', label_fr_long: "Indice d'utilisation du sol" },
  { code: 'indice_ibus', label_fr_short: 'IBUS', label_fr_long: "Indice brut d'utilisation du sol" },
  { code: 'h_max_m', label_fr_short: 'Hauteur max', label_fr_long: 'Hauteur maximale en mètres' },
  { code: 'h_max_corniche', label_fr_short: 'Hauteur corniche', label_fr_long: 'Hauteur maximale à la corniche' },
  { code: 'distance_limite', label_fr_short: 'Distance limite', label_fr_long: 'Distance minimale aux limites' },
  { code: 'nb_niveaux', label_fr_short: 'Nombre niveaux', label_fr_long: 'Nombre de niveaux autorisés' },
  { code: 'emprise_sol', label_fr_short: 'Emprise au sol', label_fr_long: 'Emprise au sol maximale' },
  { code: 'densite_batie', label_fr_short: 'Densité bâtie', label_fr_long: 'Densité bâtie maximale' }
];

const insertField = db.prepare(`
  INSERT OR REPLACE INTO label_dictionary (code, type, label_fr_short, label_fr_long)
  VALUES (@code, 'field', @label_fr_short, @label_fr_long)
`);

console.log('\n📋 Insertion des labels de champs...');
for (const field of fieldLabels) {
  insertField.run(field);
  console.log(`  ✅ ${field.code}: ${field.label_fr_short}`);
}

// Vérifier le résultat
const count = db.prepare('SELECT COUNT(*) as total FROM label_dictionary').get();
console.log(`\n✅ Total des labels insérés: ${count.total}`);

db.close();
console.log('\n🎉 Configuration des labels terminée !');