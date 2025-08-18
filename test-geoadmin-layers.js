const axios = require('axios');

async function testAllLayers() {
  console.log('🔍 Test de toutes les layers disponibles pour Vétroz\n');
  
  const x = 2586790;  // Coordonnées de la parcelle 12558 Vétroz
  const y = 1118777;
  
  // Layers potentielles pour obtenir les infos de parcelle
  const layers = [
    'ch.swisstopo.amtliches-gebaeudeadressverzeichnis',
    'ch.are.bauzonen',
    'ch.swisstopo-vd.stand-oerebkataster',
    'ch.swisstopo.lubis-luftbilder_schwarzweiss',
    'ch.swisstopo.swissimage',
    'ch.admin.ch',
    'ch.vbs.bundestankstellen-bebeco'
  ];
  
  console.log(`📍 Test aux coordonnées: ${x}, ${y}\n`);
  
  // Test 1: Sans spécifier de layer (toutes les layers)
  console.log('=== TEST SANS LAYER SPÉCIFIQUE ===');
  try {
    const resp = await axios.get('https://api3.geo.admin.ch/rest/services/api/MapServer/identify', {
      params: {
        geometry: `${x},${y}`,
        geometryType: 'esriGeometryPoint',
        layers: 'all',
        tolerance: 10,
        sr: 2056,
        lang: 'fr'
      }
    });
    
    if (resp.data?.results?.length) {
      console.log(`✅ ${resp.data.results.length} résultats trouvés`);
      for (const result of resp.data.results.slice(0, 5)) {
        console.log('\n---');
        console.log('Layer:', result.layerBodId);
        console.log('LayerName:', result.layerName);
        if (result.properties) {
          const keys = Object.keys(result.properties);
          console.log('Properties keys:', keys.slice(0, 10));
          // Chercher EGRID ou numéro de parcelle
          for (const key of keys) {
            if (key.toLowerCase().includes('egrid') || 
                key.toLowerCase().includes('number') || 
                key.toLowerCase().includes('parcel') ||
                key.toLowerCase().includes('nummer')) {
              console.log(`  ${key}:`, result.properties[key]);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
  
  // Test 2: Tester chaque layer individuellement
  console.log('\n\n=== TEST LAYERS INDIVIDUELLES ===');
  for (const layer of layers) {
    console.log(`\n📋 Test layer: ${layer}`);
    try {
      const resp = await axios.get('https://api3.geo.admin.ch/rest/services/api/MapServer/identify', {
        params: {
          geometry: `${x},${y}`,
          geometryType: 'esriGeometryPoint',
          layers: `all:${layer}`,
          tolerance: 50,
          sr: 2056,
          lang: 'fr'
        }
      });
      
      if (resp.data?.results?.length) {
        const result = resp.data.results[0];
        console.log('✅ Résultat trouvé');
        if (result.properties) {
          const keys = Object.keys(result.properties);
          console.log('Properties keys:', keys.slice(0, 5));
          // Afficher les premières propriétés
          for (const key of keys.slice(0, 3)) {
            console.log(`  ${key}:`, result.properties[key]);
          }
        }
      } else {
        console.log('❌ Aucun résultat');
      }
    } catch (error) {
      console.error('❌ Erreur:', error.response?.status || error.message);
    }
  }
  
  // Test 3: GetFeatureInfo (alternative à identify)
  console.log('\n\n=== TEST GETFEATUREINFO ===');
  try {
    const resp = await axios.get('https://wms.geo.admin.ch/', {
      params: {
        SERVICE: 'WMS',
        VERSION: '1.3.0',
        REQUEST: 'GetFeatureInfo',
        LAYERS: 'ch.swisstopo-vd.stand-oerebkataster',
        QUERY_LAYERS: 'ch.swisstopo-vd.stand-oerebkataster',
        CRS: 'EPSG:2056',
        BBOX: `${x-100},${y-100},${x+100},${y+100}`,
        WIDTH: 101,
        HEIGHT: 101,
        I: 50,
        J: 50,
        INFO_FORMAT: 'application/json'
      }
    });
    
    console.log('GetFeatureInfo response:', JSON.stringify(resp.data, null, 2).substring(0, 500));
  } catch (error) {
    console.error('❌ Erreur GetFeatureInfo:', error.message);
  }
}

testAllLayers();