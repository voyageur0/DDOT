const axios = require('axios');

async function testVetrozParcel() {
  console.log('🔍 Test complet pour parcelle 12558 Vétroz\n');
  
  // Étape 1: Rechercher la parcelle pour obtenir les coordonnées exactes
  console.log('=== ÉTAPE 1: Recherche de la parcelle ===');
  const searchResp = await axios.get('https://api3.geo.admin.ch/rest/services/api/SearchServer', {
    params: {
      searchText: 'Vétroz 12558',
      type: 'locations',
      origins: 'parcel',
      limit: 1,
      sr: 2056,
      lang: 'fr'
    }
  });
  
  if (!searchResp.data?.results?.length) {
    console.error('❌ Parcelle non trouvée');
    return;
  }
  
  const parcel = searchResp.data.results[0];
  console.log('✅ Parcelle trouvée:', parcel.attrs.label);
  
  // Extraire l'EGRID du label
  const egridMatch = parcel.attrs.label.match(/CH\s*([\d\s]+)/);
  const egrid = egridMatch ? 'CH' + egridMatch[1].replace(/\s/g, '') : '';
  console.log('📋 EGRID extrait:', egrid);
  
  // Les coordonnées de la parcelle
  const coord_x = parcel.attrs.x;  // 1118777.25
  const coord_y = parcel.attrs.y;  // 2586790
  console.log('📍 Coordonnées parcelle: x=', coord_x, 'y=', coord_y);
  
  // Étape 2: Tester identify avec différentes configurations
  console.log('\n=== ÉTAPE 2: Test identify avec les coordonnées de la parcelle ===');
  
  // Test avec différents ordres de coordonnées et layers
  const testConfigs = [
    { geometry: `${coord_x},${coord_y}`, desc: 'x,y normal' },
    { geometry: `${coord_y},${coord_x}`, desc: 'y,x inversé' },
  ];
  
  for (const config of testConfigs) {
    console.log(`\n📋 Test avec ${config.desc}: ${config.geometry}`);
    
    try {
      const resp = await axios.get('https://api3.geo.admin.ch/rest/services/api/MapServer/identify', {
        params: {
          geometry: config.geometry,
          geometryType: 'esriGeometryPoint',
          layers: 'all',
          tolerance: 20,
          sr: 2056,
          lang: 'fr',
          returnGeometry: false
        }
      });
      
      if (resp.data?.results?.length) {
        console.log(`✅ ${resp.data.results.length} résultats trouvés`);
        
        // Afficher les premiers résultats
        for (const result of resp.data.results.slice(0, 3)) {
          console.log('\n  Layer:', result.layerBodId);
          console.log('  LayerName:', result.layerName);
          
          if (result.properties) {
            // Chercher des propriétés intéressantes
            const interesting = {};
            for (const [key, value] of Object.entries(result.properties)) {
              if (key.toLowerCase().includes('egrid') ||
                  key.toLowerCase().includes('number') ||
                  key.toLowerCase().includes('nummer') ||
                  key.toLowerCase().includes('parcel') ||
                  key.toLowerCase().includes('gemeinde') ||
                  key.toLowerCase().includes('flaeche') ||
                  key === 'id' ||
                  key === 'label') {
                interesting[key] = value;
              }
            }
            
            if (Object.keys(interesting).length > 0) {
              console.log('  Propriétés intéressantes:', interesting);
            }
          }
        }
      } else {
        console.log('❌ Aucun résultat');
      }
    } catch (error) {
      console.error('❌ Erreur:', error.response?.status || error.message);
    }
  }
  
  // Étape 3: Tester le téléchargement RDPPF
  console.log('\n\n=== ÉTAPE 3: Test téléchargement RDPPF ===');
  if (egrid) {
    const rdppfUrl = `https://rdppfvs.geopol.ch/extract/pdf?EGRID=${egrid}&LANG=fr`;
    console.log('📄 URL RDPPF:', rdppfUrl);
    
    try {
      const resp = await axios.head(rdppfUrl, { timeout: 5000 });
      console.log('✅ RDPPF accessible, status:', resp.status);
      console.log('   Content-Type:', resp.headers['content-type']);
      console.log('   Content-Length:', resp.headers['content-length']);
    } catch (error) {
      console.error('❌ Erreur accès RDPPF:', error.response?.status || error.message);
    }
  }
  
  // Étape 4: Recherche dans les zones à bâtir
  console.log('\n=== ÉTAPE 4: Test zones à bâtir ===');
  try {
    const resp = await axios.get('https://api3.geo.admin.ch/rest/services/api/MapServer/identify', {
      params: {
        geometry: `${coord_x},${coord_y}`,
        geometryType: 'esriGeometryPoint',
        layers: 'all:ch.are.bauzonen',
        tolerance: 50,
        sr: 2056,
        lang: 'fr'
      }
    });
    
    if (resp.data?.results?.length) {
      console.log('✅ Zone à bâtir trouvée');
      const zone = resp.data.results[0];
      console.log('Properties:', JSON.stringify(zone.properties, null, 2));
    } else {
      console.log('❌ Pas de zone à bâtir');
    }
  } catch (error) {
    console.error('❌ Erreur zones:', error.response?.status || error.message);
  }
}

testVetrozParcel().catch(console.error);