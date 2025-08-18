const { normalizeConstraint, normalizeConstraints } = require('../dist/i18n/constraintNormalizer');

async function testNormalization() {
  console.log('🧪 Test de normalisation des contraintes\n');
  
  // Contraintes de test basées sur la réponse actuelle
  const testConstraints = [
    {
      title: "Hauteur maximale des constructions",
      description: "La hauteur maximale des constructions dans la zone résidentielle est limitée à 12 mètres selon le règlement communal en vigueur",
      severity: "high",
      source: "Règlement communal, article 15"
    },
    {
      title: "Indice de densité (IBUS)",
      description: "L'indice de densité pour la zone résidentielle est fixé à 0.5.",
      severity: "high",
      source: "Règlement communal, article 22"
    },
    {
      title: "Espaces verts",
      description: "Au moins 30% de la surface de la parcelle doit être dédiée à des espaces verts non construits et perméables pour favoriser l'infiltration des eaux",
      severity: "medium",
      source: "Règlement communal, article 35"
    },
    {
      title: "Stationnement résidentiel",
      description: "Un minimum de 1.5 places de stationnement par logement est requis.",
      severity: "medium",
      source: "Règlement communal, article 25"
    },
    {
      title: "Restrictions spéciales pour les toitures",
      description: "Les toitures doivent être inclinées avec une pente comprise entre 30 et 45 degrés",
      severity: "medium",
      source: "Règlement communal, article 40"
    }
  ];
  
  console.log('AVANT NORMALISATION:');
  console.log('===================\n');
  
  testConstraints.forEach((c, i) => {
    console.log(`${i+1}. ${c.title}`);
    console.log(`   ${c.description}`);
    console.log(`   Mots: ${c.description.split(' ').length}\n`);
  });
  
  // Normaliser
  const normalized = await normalizeConstraints(testConstraints);
  
  console.log('\nAPRÈS NORMALISATION:');
  console.log('===================\n');
  
  normalized.forEach((c, i) => {
    console.log(`${i+1}. ${c.title}`);
    console.log(`   ${c.description}`);
    console.log(`   Mots: ${c.description.split(' ').length}`);
    console.log(`   Catégorie: ${c.category}`);
    console.log(`   Sévérité: ${c.severity}\n`);
  });
  
  // Test spécifique pour les labels connus
  console.log('\n🏷️  TEST DES LABELS SPÉCIFIQUES:');
  console.log('================================\n');
  
  const specificTests = [
    {
      title: "Zone de bruit DS III",
      description: "La parcelle se trouve dans une zone de bruit de degré de sensibilité III selon l'ordonnance sur la protection contre le bruit"
    },
    {
      title: "Pente du terrain",
      description: "Le terrain présente une pente de 35% nécessitant des travaux de terrassement importants"
    },
    {
      title: "Danger naturel",
      description: "Zone de danger moyen - avalanches, nécessitant une étude spécifique"
    }
  ];
  
  for (const test of specificTests) {
    const normalized = await normalizeConstraint(test);
    console.log(`Original: "${test.title}"`);
    console.log(`Normalisé: "${normalized.title}"`);
    console.log(`Description: "${normalized.description}"`);
    console.log(`Catégorie détectée: ${normalized.category}\n`);
  }
}

// Compiler d'abord TypeScript
const { exec } = require('child_process');
console.log('📦 Compilation TypeScript...');

exec('npx tsc src/i18n/constraintNormalizer.ts --outDir dist --esModuleInterop --skipLibCheck', (error) => {
  if (error) {
    console.error('Erreur compilation:', error);
    return;
  }
  
  // Exécuter les tests
  testNormalization().catch(console.error);
});