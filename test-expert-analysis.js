const { searchParcel } = require('./src/lib/geoAdmin');
const { performExpertUrbanAnalysis } = require('./src/lib/expertUrbanistAnalysis');
const { performComprehensiveAnalysis } = require('./src/lib/parcelAnalysisOrchestrator');

async function testExpertAnalysis() {
  console.log('🔍 Test analyse experte pour Vétroz 12558\n');
  
  try {
    // Étape 1: Rechercher la parcelle
    console.log('=== ÉTAPE 1: Recherche de la parcelle ===');
    const searchResult = await searchParcel('Vétroz 12558');
    
    if (!searchResult) {
      console.error('❌ Parcelle non trouvée');
      return;
    }
    
    console.log('✅ Parcelle trouvée:');
    console.log('  EGRID:', searchResult.egrid);
    console.log('  Number:', searchResult.number);
    console.log('  Municipality:', searchResult.municipality);
    
    // Étape 2: Créer un objet de données minimal pour l'analyse experte
    console.log('\n=== ÉTAPE 2: Analyse experte directe ===');
    const mockData = {
      searchQuery: 'Vétroz 12558',
      searchResult: searchResult,
      parcelDetails: {
        number: '12558',
        municipality: 'Vétroz',
        surface: 862  // Surface typique, sera mise à jour depuis RDPPF
      },
      geocodeResult: null,
      zones: {},
      geologicalInfo: {},
      buildingZone: {},
      plrData: null,
      communalRegulations: [],
      additionalData: [],
      communalConstraints: [],
      rdppfConstraints: [],
      valaisDensity: undefined,
      processingTime: 0,
      completeness: 0,
      errors: [],
      formattedForAI: ''
    };
    
    const expertAnalysis = await performExpertUrbanAnalysis(mockData);
    
    console.log('\n✅ Analyse experte complétée:');
    console.log('📍 Parcelle:', expertAnalysis.parcelIdentification);
    
    // Afficher les contraintes par catégorie
    const categories = Object.keys(expertAnalysis.constraints);
    for (const category of categories) {
      const constraints = expertAnalysis.constraints[category];
      if (constraints.length > 0) {
        console.log(`\n📋 ${category.toUpperCase()} (${constraints.length} contraintes):`);
        for (const c of constraints.slice(0, 3)) {
          console.log(`  - ${c.constraint}: ${c.value} ${c.unit || ''} (${c.article || 'N/A'})`);
        }
        if (constraints.length > 3) {
          console.log(`  ... et ${constraints.length - 3} autres`);
        }
      }
    }
    
    console.log('\n📊 Valeurs calculées:');
    console.log('  Surface constructible max:', expertAnalysis.calculatedValues.maxBuildableSurface, 'm²');
    console.log('  Hauteur max:', expertAnalysis.calculatedValues.maxHeight, 'm');
    console.log('  Distance min aux limites:', expertAnalysis.calculatedValues.minDistanceToBoundary, 'm');
    console.log('  Places de parc requises:', expertAnalysis.calculatedValues.requiredParkingSpaces);
    console.log('  Espaces verts requis:', expertAnalysis.calculatedValues.requiredGreenSpace, 'm²');
    console.log('  Aires de jeux requises:', expertAnalysis.calculatedValues.requiredPlaygroundArea, 'm²');
    
    console.log('\n📝 Synthèse:');
    console.log(expertAnalysis.synthesis.substring(0, 500) + '...');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

testExpertAnalysis().catch(console.error);