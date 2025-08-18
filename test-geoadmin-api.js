const axios = require('axios');

async function testSearchAndIdentify() {
  console.log('🔍 Test des APIs GeoAdmin pour Vétroz parcelle 12558\n');
  
  // Test 1: Recherche directe de parcelle
  console.log('=== TEST 1: Recherche parcelle "Vétroz 12558" ===');
  try {
    const searchResp = await axios.get('https://api3.geo.admin.ch/rest/services/api/SearchServer', {
      params: {
        searchText: 'Vétroz 12558',
        type: 'locations',
        origins: 'parcel',
        limit: 3,
        sr: 2056,
        lang: 'fr'
      }
    });
    
    if (searchResp.data?.results?.length) {
      const hit = searchResp.data.results[0];
      console.log('✅ Parcelle trouvée!');
      console.log('Label:', hit.attrs?.label);
      console.log('Number:', hit.attrs?.number);
      console.log('EGRID dans attrs:', hit.attrs?.egrid);
      console.log('Municipality:', hit.attrs?.municipality);
      console.log('Coordonnées (x,y):', hit.attrs?.x, hit.attrs?.y);
      console.log('\nTous les attrs:', JSON.stringify(hit.attrs, null, 2));
    }
  } catch (error) {
    console.error('❌ Erreur recherche:', error.message);
  }
  
  // Test 2: Recherche par adresse puis identify
  console.log('\n=== TEST 2: Recherche adresse "Route Cantonale 199, Vétroz" ===');
  try {
    const addressResp = await axios.get('https://api3.geo.admin.ch/rest/services/api/SearchServer', {
      params: {
        searchText: 'Route Cantonale 199, Vétroz',
        type: 'locations',
        origins: 'address',
        limit: 1,
        sr: 2056,
        lang: 'fr'
      }
    });
    
    if (addressResp.data?.results?.length) {
      const hit = addressResp.data.results[0];
      console.log('✅ Adresse trouvée:', hit.attrs?.label);
      const x = hit.attrs?.y; // Note: inversé dans l'API
      const y = hit.attrs?.x;
      console.log('Coordonnées:', x, y);
      
      // Identify la parcelle à ces coordonnées
      console.log('\nRecherche de la parcelle aux coordonnées...');
      const identifyResp = await axios.get('https://api3.geo.admin.ch/rest/services/api/MapServer/identify', {
        params: {
          geometry: `${x},${y}`,
          geometryType: 'esriGeometryPoint',
          layers: 'all:ch.kantone.cadastralwebmap-farbe',
          imageDisplay: '512,512,96',
          mapExtent: `${x-100},${y-100},${x+100},${y+100}`,
          tolerance: 10,
          returnGeometry: true,
          sr: 2056
        }
      });
      
      if (identifyResp.data?.results?.length) {
        const parcel = identifyResp.data.results[0];
        console.log('✅ Parcelle identifiée!');
        console.log('Properties.egrid:', parcel.properties?.egrid);
        console.log('Properties.number:', parcel.properties?.number);
        console.log('Properties.municipality:', parcel.properties?.municipality);
        console.log('\nToutes les properties:', JSON.stringify(parcel.properties, null, 2));
      } else {
        console.log('❌ Aucune parcelle trouvée aux coordonnées');
      }
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
  
  // Test 3: Identify avec différentes layers
  console.log('\n=== TEST 3: Test avec différentes layers ===');
  const layers = [
    'ch.kantone.cadastralwebmap-farbe',
    'ch.swisstopo-vd.stand-oerebkataster',
    'ch.swisstopo.cadastralwebmap-farbe'
  ];
  
  const x = 2558700; // Coordonnées approximatives Vétroz
  const y = 1117900;
  
  for (const layer of layers) {
    console.log(`\nTest layer: ${layer}`);
    try {
      const resp = await axios.get('https://api3.geo.admin.ch/rest/services/api/MapServer/identify', {
        params: {
          geometry: `${x},${y}`,
          geometryType: 'esriGeometryPoint',
          layers: `all:${layer}`,
          tolerance: 50,
          sr: 2056
        }
      });
      
      if (resp.data?.results?.length) {
        const result = resp.data.results[0];
        console.log('✅ Résultat trouvé');
        console.log('Properties keys:', Object.keys(result.properties || {}));
        if (result.properties?.egrid || result.properties?.number) {
          console.log('EGRID:', result.properties?.egrid);
          console.log('Number:', result.properties?.number);
        }
      } else {
        console.log('❌ Aucun résultat');
      }
    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
  }
}

testSearchAndIdentify();