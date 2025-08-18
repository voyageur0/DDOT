#!/usr/bin/env node

/**
 * Test de l'API avec le nouveau système O3
 */

async function testAPI() {
    console.log('🧪 Test de l\'API avec analyse O3');
    console.log('=================================\n');
    
    try {
        // Test avec la parcelle d'Ayent
        const response = await fetch('http://localhost:3001/api/ia-constraints', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                searchQuery: 'Parcelle 3649 Ayent',
                analysisType: 'comprehensive',
                useConversational: true  // Utilise le nouveau système O3
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        console.log('✅ Réponse reçue:');
        console.log('================\n');
        
        // Afficher les métadonnées
        if (result.metadata) {
            console.log('📊 Métadonnées:');
            console.log(`  - Modèle: ${result.metadata.model || 'Non spécifié'}`);
            console.log(`  - Raisonnement: ${result.metadata.reasoningEffort || 'Non spécifié'}`);
            console.log(`  - Confiance: ${result.metadata.confidence}%`);
            console.log(`  - Complétude: ${result.metadata.completeness}%`);
            console.log(`  - Temps: ${result.metadata.elapsedMs}ms`);
            console.log(`  - Sources: ${result.metadata.sources?.join(', ') || 'Non spécifiées'}`);
        }
        
        // Afficher les infos de la parcelle
        if (result.data?.parcel) {
            console.log('\n📍 Parcelle:');
            console.log(`  - Adresse: ${result.data.parcel.address}`);
            console.log(`  - Zone: ${result.data.parcel.zone}`);
            console.log(`  - Surface: ${result.data.parcel.surface} m²`);
            console.log(`  - EGRID: ${result.data.parcel.egrid}`);
        }
        
        // Afficher un extrait de l'analyse
        if (result.data?.analysis) {
            console.log('\n📝 Extrait de l\'analyse:');
            console.log('------------------------');
            const analysis = typeof result.data.analysis === 'string' 
                ? result.data.analysis 
                : result.data.analysis.analysis || JSON.stringify(result.data.analysis);
            console.log(analysis.substring(0, 1000) + '...\n');
        }
        
        console.log('✅ Test réussi!');
        
    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
        console.error(error);
    }
}

// Attendre un peu que le serveur soit prêt
setTimeout(() => {
    testAPI().then(() => process.exit(0)).catch(() => process.exit(1));
}, 2000);