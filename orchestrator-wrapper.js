// Wrapper CommonJS pour l'orchestrateur TypeScript
const tsNode = require('ts-node');

// Configuration ts-node pour TypeScript/ESM
const service = tsNode.register({
  compilerOptions: {
    module: 'CommonJS',
    target: 'ES2020',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true
  },
  transpileOnly: true
});

let orchestratorModule;

try {
  // Importer l'orchestrateur TypeScript
  orchestratorModule = require('./src/lib/parcelAnalysisOrchestrator.ts');
  console.log('✅ Orchestrateur TypeScript chargé avec succès');
} catch (error) {
  console.error('❌ Erreur chargement orchestrateur:', error.message);
  
  // Fallback - orchestrateur simulé basique
  orchestratorModule = {
    performComprehensiveAnalysis: async (searchQuery) => {
      console.log('🔄 Utilisation orchestrateur simulé pour:', searchQuery);
      
      return {
        searchQuery,
        searchResult: { egrid: 'CH-123456789', surface: 850 },
        parcelDetails: null,
        geocodeResult: null,
        zones: {
          'R2': { 
            description: 'Zone résidentielle faible densité',
            ibus: 0.5,
            hauteur_max: 9
          }
        },
        plrData: null,
        communalRegulations: [
          {
            title: 'Règlement de construction Vétroz',
            content: 'Zone R2: IUS max 0.5, hauteur max 9m, distance min 3m aux limites'
          }
        ],
        rdppfConstraints: [
          {
            title: 'Restriction construction',
            description: 'Distance minimale 3m aux limites de parcelle',
            severity: 'medium'
          }
        ],
        additionalData: [],
        communalConstraints: [],
        valaisDensity: null,
        processingTime: 1500,
        completeness: 75,
        errors: ['Mode orchestrateur simulé'],
        formattedForAI: 'Données partielles disponibles'
      };
    }
  };
}

module.exports = orchestratorModule;