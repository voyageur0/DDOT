const { searchParcel } = require('./src/lib/geoAdmin');

async function testSearch() {
  console.log('🔍 Test recherche parcelle 12558 Vétroz\n');
  
  const tests = [
    'Vétroz 12558',
    'parcelle 12558 Vétroz',
    '12558 Vétroz',
    'Route Cantonale 199, Vétroz'
  ];
  
  for (const query of tests) {
    console.log(`\n=== Test: "${query}" ===`);
    try {
      const result = await searchParcel(query);
      if (result) {
        console.log('✅ Trouvé!');
        console.log('  EGRID:', result.egrid);
        console.log('  Number:', result.number);
        console.log('  Municipality:', result.municipality);
        console.log('  Coordinates:', result.center);
      } else {
        console.log('❌ Non trouvé');
      }
    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
  }
}

testSearch().catch(console.error);