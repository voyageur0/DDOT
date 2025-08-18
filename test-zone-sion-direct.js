// Test direct avec les données exactes de la parcelle Sion 2257
const axios = require('axios');

async function testDirectData() {
    console.log('🔍 Test avec données exactes de Sion parcelle 2257...\n');
    
    // Données basées sur les captures d'écran fournies
    const testData = {
        // D'après les captures d'écran, la parcelle correcte semble être:
        // Zone résidentielle 0.5 (3) avec 2257 m² à 100%
        searchQuery: 'Rue du Sanetsch 15, 1950 Sion',
        analysisType: 'comprehensive',
        // EGRID visible dans les captures
        egrid: 'CH536633313461',
        commune: 'Sion',
        parcelNumber: '2257'
    };
    
    console.log('📤 Données envoyées:', testData);
    
    try {
        const response = await axios.post('http://127.0.0.1:3001/api/ia-constraints', testData, {
            timeout: 120000, // 2 minutes timeout pour comprehensive
            onDownloadProgress: (progressEvent) => {
                // Afficher la progression si disponible
                if (progressEvent.lengthComputable) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    process.stdout.write(`\rTéléchargement: ${percentCompleted}%`);
                }
            }
        });
        
        console.log('\n\n✅ Réponse reçue!');
        
        const data = response.data;
        
        // Afficher les informations de la parcelle
        if (data.data && data.data.parcel) {
            console.log('\n📍 Informations Parcelle:');
            console.log('   Adresse:', data.data.parcel.address);
            console.log('   Zone:', data.data.parcel.zone);
            console.log('   Surface zone:', data.data.parcel.zone_surface);
        }
        
        // Afficher les contraintes liées à la zone
        if (data.data && data.data.constraints) {
            const zoneConstraints = data.data.constraints.filter(c => 
                c.theme === 'Destination de zone' || 
                (c.rule && c.rule.includes('Zone résidentielle'))
            );
            
            if (zoneConstraints.length > 0) {
                console.log('\n🏗️ Contraintes de Zone:');
                zoneConstraints.forEach(c => {
                    console.log(`   - ${c.theme}: ${c.rule}`);
                    if (c.source) console.log(`     Source: ${c.source}`);
                });
            }
        }
        
        // Vérifier les données brutes de l'analyse
        if (data.data && data.data.analysis) {
            console.log('\n🔍 Données d\'Analyse:');
            if (data.data.analysis.zoneInfo) {
                console.log('   Zone Info:', JSON.stringify(data.data.analysis.zoneInfo, null, 2));
            }
            if (data.data.analysis.rdppfData) {
                console.log('   RDPPF Data:', JSON.stringify(data.data.analysis.rdppfData, null, 2));
            }
        }
        
        // Afficher les métadonnées
        if (data.metadata) {
            console.log('\n📊 Métadonnées:');
            console.log('   Complétude:', data.metadata.completeness + '%');
            console.log('   Temps de traitement:', data.metadata.processingTime + 'ms');
            console.log('   Confiance:', data.metadata.confidence + '%');
        }
        
        // Sauvegarder la réponse complète pour debug
        const fs = require('fs');
        fs.writeFileSync('response-sion-2257.json', JSON.stringify(data, null, 2));
        console.log('\n💾 Réponse complète sauvegardée dans response-sion-2257.json');
        
    } catch (error) {
        if (error.response) {
            console.error('\n❌ Erreur API:', error.response.status);
            console.error('Message:', error.response.data);
        } else if (error.code === 'ECONNABORTED') {
            console.error('\n❌ Timeout - l\'analyse prend trop de temps');
            console.error('Essayez avec analysisType: "quick" pour un test plus rapide');
        } else {
            console.error('\n❌ Erreur:', error.message);
        }
    }
}

// Lancer le test
testDirectData();