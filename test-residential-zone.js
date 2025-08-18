// Test pour trouver la parcelle avec Zone résidentielle 0.5 (3)
const axios = require('axios');

async function testFindResidentialZone() {
    console.log('🔍 Recherche de la parcelle Zone résidentielle 0.5 (3) à Sion...\n');
    
    // D'après les screenshots, on cherche une parcelle avec:
    // - Zone résidentielle 0.5 (3)
    // - Surface 2257 m² 
    // - 100% de la parcelle dans cette zone
    
    const testSearches = [
        'CH536633313461', // EGRID du screenshot
        'Sion 3461', // Numéro partiel possible
        'Sion parcelle 3461',
        'Sion 33313461',
        'Sion Zone résidentielle 0.5'
    ];
    
    for (const search of testSearches) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📍 Test: "${search}"`);
        console.log(`${'='.repeat(60)}\n`);
        
        try {
            const response = await axios.post('http://127.0.0.1:3001/api/ia-constraints', {
                searchQuery: search,
                analysisType: 'comprehensive' // Analyse complète pour avoir toutes les infos
            }, {
                timeout: 120000 // 2 minutes
            });
            
            const data = response.data;
            
            console.log('📊 Résultat:');
            console.log(`   Complétude: ${data.metadata?.completeness}%`);
            console.log(`   Zone: ${data.data?.parcel?.zone || 'Non déterminée'}`);
            console.log(`   Surface zone: ${data.data?.parcel?.zone_surface || 'Non spécifiée'}`);
            
            // Vérifier si c'est la bonne zone
            const zone = data.data?.parcel?.zone || '';
            if (zone.includes('résidentielle') && zone.includes('0.5')) {
                console.log('\n✅ TROUVÉ ! C\'est la bonne parcelle !');
                console.log(`   Zone complète: ${zone}`);
                
                // Afficher les contraintes principales
                const constraints = data.data?.constraints || [];
                const ibusConstraint = constraints.find(c => 
                    c.title?.includes('IBUS') || c.values?.unit === 'IBUS'
                );
                if (ibusConstraint) {
                    console.log(`   IBUS: ${ibusConstraint.values?.numeric || ibusConstraint.rule}`);
                }
                
                // Sauvegarder pour analyse
                const fs = require('fs');
                fs.writeFileSync(`residential-zone-found-${search.replace(/[^a-z0-9]/gi, '_')}.json`, 
                    JSON.stringify(data, null, 2));
                console.log(`\n💾 Données complètes sauvegardées`);
                
                break; // On a trouvé !
            } else if (zone.includes('forestière')) {
                console.log('❌ Zone forestière trouvée (mauvaise parcelle)');
            }
            
        } catch (error) {
            console.error(`❌ Erreur: ${error.message}`);
        }
    }
    
    console.log('\n\n📝 Résumé:');
    console.log('L\'utilisateur voit dans le RDPPF:');
    console.log('- Zone résidentielle 0.5 (3)');
    console.log('- Surface: 2257 m²');
    console.log('- 100.0% de la parcelle');
    console.log('\nMais l\'API trouve une zone forestière ou "à déterminer"');
    console.log('Il faut identifier pourquoi le bon EGRID ne donne pas la bonne zone.');
}

testFindResidentialZone();