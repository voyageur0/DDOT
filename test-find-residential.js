// Test pour trouver la parcelle résidentielle correcte
const axios = require('axios');

async function findResidentialParcel() {
    console.log('🔍 Recherche de parcelles résidentielles à Sion...\n');
    
    // Essayer différentes recherches
    const searches = [
        'Rue du Sanetsch 15, 1950 Sion',
        'Sion parcelle résidentielle',
        'Sion Zone résidentielle 0.5',
        'CH536633313461', // EGRID des screenshots
        '1950 Sion 2257'
    ];
    
    for (const search of searches) {
        console.log(`\n📍 Test avec: "${search}"`);
        
        try {
            const response = await axios.post('http://127.0.0.1:3001/api/ia-constraints', {
                searchQuery: search,
                analysisType: 'quick' // Quick pour aller plus vite
            }, {
                timeout: 15000
            });
            
            const data = response.data;
            
            if (data.data?.parcel) {
                console.log(`   Adresse: ${data.data.parcel.address}`);
                console.log(`   Zone: ${data.data.parcel.zone}`);
                console.log(`   Surface: ${data.data.parcel.zone_surface}`);
                
                // Vérifier si c'est une zone résidentielle
                if (data.data.parcel.zone && data.data.parcel.zone.includes('résidentielle')) {
                    console.log(`   ✅ TROUVÉ ! Zone résidentielle`);
                }
            }
            
        } catch (error) {
            console.log(`   ❌ Erreur: ${error.message}`);
        }
    }
}

findResidentialParcel();