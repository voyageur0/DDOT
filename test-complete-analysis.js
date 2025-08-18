// Test complet avec analyse détaillée
const axios = require('axios');

async function testCompleteAnalysis() {
    console.log('🔍 Test d\'analyse complète avec débogage...\n');
    
    const testCases = [
        {
            name: "Sion 2257 (trouve aire forestière)",
            query: "Sion 2257"
        },
        {
            name: "Rue du Sanetsch 15, Sion",
            query: "Rue du Sanetsch 15, 1950 Sion"
        },
        {
            name: "EGRID direct des screenshots",
            query: "CH536633313461"
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📍 Test: ${testCase.name}`);
        console.log(`   Query: "${testCase.query}"`);
        console.log(`${'='.repeat(60)}\n`);
        
        try {
            const response = await axios.post('http://127.0.0.1:3001/api/ia-constraints', {
                searchQuery: testCase.query,
                analysisType: 'comprehensive'
            }, {
                timeout: 120000 // 2 minutes
            });
            
            const data = response.data;
            
            console.log('✅ Analyse terminée!');
            console.log('\n📊 Résumé:');
            console.log(`   Complétude: ${data.metadata?.completeness}%`);
            console.log(`   Temps total: ${data.metadata?.elapsedMs}ms`);
            console.log(`   Confiance: ${data.metadata?.confidence}%`);
            
            console.log('\n📍 Parcelle:');
            console.log(`   Adresse: ${data.data?.parcel?.address || 'Non trouvée'}`);
            console.log(`   Zone: ${data.data?.parcel?.zone || 'Non déterminée'}`);
            console.log(`   Surface zone: ${data.data?.parcel?.zone_surface || 'Non spécifiée'}`);
            
            console.log('\n📋 Contraintes par catégorie:');
            const constraints = data.data?.constraints || [];
            const byCategory = {};
            constraints.forEach(c => {
                const cat = c.source || 'Autre';
                byCategory[cat] = (byCategory[cat] || 0) + 1;
            });
            Object.entries(byCategory).forEach(([cat, count]) => {
                console.log(`   - ${cat}: ${count} contraintes`);
            });
            
            console.log('\n🏗️ Contraintes clés:');
            // IBUS
            const ibusConstraint = constraints.find(c => c.values?.unit === 'IBUS');
            if (ibusConstraint) {
                console.log(`   ✅ IBUS: ${ibusConstraint.values.numeric} (${ibusConstraint.source})`);
            } else {
                console.log(`   ❌ IBUS: Non trouvé`);
            }
            
            // Hauteur
            const hauteurConstraint = constraints.find(c => c.title?.includes('Hauteur') || c.title?.includes('hauteur'));
            if (hauteurConstraint) {
                console.log(`   ✅ Hauteur max: ${hauteurConstraint.values?.numeric} ${hauteurConstraint.values?.unit} (${hauteurConstraint.source})`);
            } else {
                console.log(`   ❌ Hauteur: Non trouvée`);
            }
            
            // Reculs
            const reculConstraint = constraints.find(c => c.title?.includes('Recul') || c.title?.includes('recul'));
            if (reculConstraint) {
                console.log(`   ✅ Reculs: ${reculConstraint.values?.numeric} ${reculConstraint.values?.unit} (${reculConstraint.source})`);
            } else {
                console.log(`   ❌ Reculs: Non trouvés`);
            }
            
            // Sauvegarder pour analyse détaillée
            const fs = require('fs');
            const filename = `analysis-${testCase.query.replace(/[^a-z0-9]/gi, '_')}.json`;
            fs.writeFileSync(filename, JSON.stringify(data, null, 2));
            console.log(`\n💾 Résultats complets sauvegardés dans ${filename}`);
            
        } catch (error) {
            console.error(`❌ Erreur: ${error.message}`);
            if (error.response?.data) {
                console.error('   Détails:', error.response.data);
            }
        }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Tests terminés');
}

testCompleteAnalysis();