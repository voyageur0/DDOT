#!/usr/bin/env node

/**
 * Test du nouveau système d'analyse avec modèle O3
 */

import { analyzeParcelWithO3 } from './src/lib/o3ReasoningAnalysis.js';

async function test() {
    console.log('🧪 Test du système d\'analyse O3');
    console.log('================================\n');
    
    // Test avec une parcelle d'Ayent
    const testCases = [
        {
            egrid: 'CH143052254092',
            municipality: 'Ayent',
            parcelNumber: '3649'
        },
        {
            egrid: 'CH858635289361',
            municipality: 'Vétroz',
            parcelNumber: '12558'
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n📍 Test parcelle ${testCase.parcelNumber} à ${testCase.municipality}`);
        console.log('----------------------------------------------');
        
        try {
            const result = await analyzeParcelWithO3(
                testCase.egrid,
                testCase.municipality,
                testCase.parcelNumber
            );
            
            if (result.error) {
                console.error(`❌ Erreur: ${result.error}`);
            } else {
                console.log(`✅ Analyse réussie avec ${result.model}`);
                console.log(`⚡ Temps: ${result.processingTime}ms`);
                console.log(`🎯 Confiance: ${result.confidence}%`);
                console.log(`🧠 Niveau de raisonnement: ${result.reasoningEffort}`);
                console.log(`📄 Sources: ${result.sources.join(', ')}`);
                console.log('\n📝 Extrait de l\'analyse:');
                console.log('----------------------------');
                console.log(result.analysis.substring(0, 500) + '...');
            }
        } catch (error) {
            console.error(`❌ Erreur lors du test: ${error.message}`);
        }
    }
    
    console.log('\n✅ Tests terminés');
}

// Vérifier que les variables d'environnement sont configurées
if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY non configurée dans le fichier .env');
    process.exit(1);
}

test().catch(console.error);