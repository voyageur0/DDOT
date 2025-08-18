// Test pour analyser pourquoi la complétude est seulement 20%
const axios = require('axios');

async function analyzeCompleteness() {
    console.log('🔍 Analyse de la complétude...\n');
    
    // Faire une requête rapide pour voir les logs
    try {
        const response = await axios.post('http://127.0.0.1:3001/api/ia-constraints', {
            searchQuery: 'Sion 2257',
            analysisType: 'comprehensive'
        }, {
            timeout: 30000
        });
        
        const data = response.data;
        
        console.log('📊 Résultats de complétude:');
        console.log('   Complétude totale:', data.metadata?.completeness + '%');
        console.log('   Temps de traitement:', data.metadata?.processingTime + 'ms');
        
        // Analyser ce qui manque
        console.log('\n🔍 Analyse des données:');
        
        // 1. Parcelle trouvée ?
        if (data.data?.parcel?.address) {
            console.log('✅ Étape 1: Parcelle trouvée -', data.data.parcel.address);
        } else {
            console.log('❌ Étape 1: Parcelle non trouvée');
        }
        
        // 2. RDPPF extrait ?
        if (data.data?.parcel?.zone && !data.data.parcel.zone.includes('déterminer')) {
            console.log('✅ Étape 2: Zone RDPPF extraite -', data.data.parcel.zone);
        } else {
            console.log('❌ Étape 2: Zone RDPPF non extraite -', data.data?.parcel?.zone || 'Aucune');
        }
        
        // 3. Zones GeoAdmin ?
        if (data.data?.analysis?.zoneInfo) {
            console.log('✅ Étape 3: Zones analysées');
        } else {
            console.log('❌ Étape 3: Zones non analysées');
        }
        
        // 4. Règlement communal ?
        const constraints = data.data?.constraints || [];
        const communalConstraints = constraints.filter(c => c.source?.includes('Règlement communal'));
        if (communalConstraints.length > 0) {
            console.log(`✅ Étape 4: ${communalConstraints.length} contraintes du règlement communal`);
        } else {
            console.log('❌ Étape 4: Aucune contrainte communale');
        }
        
        // 5. Calcul densité ?
        const ibusConstraints = constraints.filter(c => c.values?.unit === 'IBUS');
        if (ibusConstraints.length > 0) {
            console.log(`✅ Étape 5: IBUS trouvé -`, ibusConstraints[0].values.numeric);
        } else {
            console.log('❌ Étape 5: IBUS non calculé');
        }
        
        // Calculer notre propre complétude
        let myCompleteness = 0;
        if (data.data?.parcel?.address) myCompleteness += 20;
        if (data.data?.parcel?.zone && !data.data.parcel.zone.includes('déterminer')) myCompleteness += 20;
        if (data.data?.analysis?.zoneInfo) myCompleteness += 20;
        if (communalConstraints.length > 0) myCompleteness += 20;
        if (ibusConstraints.length > 0) myCompleteness += 20;
        
        console.log('\n📈 Complétude recalculée:', myCompleteness + '%');
        console.log('   Complétude API:', data.metadata?.completeness + '%');
        
        // Afficher les erreurs s'il y en a
        if (data.errors && data.errors.length > 0) {
            console.log('\n⚠️ Erreurs reportées:');
            data.errors.forEach(err => console.log('   -', err));
        }
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

analyzeCompleteness();