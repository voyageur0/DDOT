// Test to simulate RDPPF zone extraction with the exact text from screenshots

// Simulated RDPPF text based on the screenshots provided
const simulatedRdppfText = `
Extrait du cadastre des restrictions de droit public à la propriété foncière
Cadastre RDPPF

Bien-fonds
Commune: Sion (6266)
Numéro: 2257
EGRID: CH536633313461
Type: Bien-fonds
Surface [m²]: 2257

Restrictions de droit public à la propriété foncière qui touchent le bien-fonds

Zone résidentielle 0.5 (3) 2257 m² 100.0%
Degré de sensibilité II 2257 m² 100.0%

Plans d'affectation
Zone d'affectation: Zone résidentielle 0.5 (3)
Surface: 2257 m²
Pourcentage: 100.0%
`;

// Function to extract zone from RDPPF text
function extractZoneFromRdppfText(text) {
    console.log('🔍 Extracting zone from RDPPF text...\n');
    
    // Pattern 1: Look for zone after "Zone d'affectation:"
    const zoneAffectationMatch = text.match(/Zone d'affectation:\s*([^\n]+)/);
    if (zoneAffectationMatch) {
        const zone = zoneAffectationMatch[1].trim();
        console.log('✅ Found zone from "Zone d\'affectation":', zone);
        return zone;
    }
    
    // Pattern 2: Look for zone pattern with percentage
    const zonePercentMatch = text.match(/Zone résidentielle[^\\n]*?(\d+m²\s+[\d.]+%)/);
    if (zonePercentMatch) {
        const fullMatch = zonePercentMatch[0];
        const zoneMatch = fullMatch.match(/^([^0-9]+)/);
        if (zoneMatch) {
            const zone = zoneMatch[1].trim();
            console.log('✅ Found zone from percentage pattern:', zone);
            return zone;
        }
    }
    
    // Pattern 3: Direct zone pattern
    const directZoneMatch = text.match(/Zone résidentielle\s+[\d.]+\s*\(\d+\)/);
    if (directZoneMatch) {
        const zone = directZoneMatch[0];
        console.log('✅ Found zone from direct pattern:', zone);
        return zone;
    }
    
    console.log('❌ No zone pattern matched');
    return null;
}

// Test the extraction
const extractedZone = extractZoneFromRdppfText(simulatedRdppfText);

console.log('\n📊 Results:');
console.log('Expected: Zone résidentielle 0.5 (3)');
console.log('Extracted:', extractedZone || 'Not found');

// Now test with the rdppfExtractor if available
try {
    const { extractRelevantSectionsFromText } = require('./dist/lib/rdppfExtractor');
    
    console.log('\n🔧 Testing with rdppfExtractor.extractRelevantSectionsFromText:');
    const relevantSections = extractRelevantSectionsFromText(simulatedRdppfText);
    console.log('Relevant sections extracted:', relevantSections.substring(0, 200) + '...');
    
    // Check if zone is in relevant sections
    if (relevantSections.includes('Zone résidentielle 0.5 (3)')) {
        console.log('✅ Zone is included in relevant sections');
    } else {
        console.log('❌ Zone NOT found in relevant sections');
    }
    
} catch (error) {
    console.log('\n⚠️ Could not test with rdppfExtractor:', error.message);
}

// Suggest the fix
console.log('\n💡 Suggested fix for rdppfExtractor.ts:');
console.log(`
const SYSTEM_PROMPT = \`...
2. Pour la "Destination de zone", extraire EXACTEMENT la dénomination complète de la zone telle qu'elle apparaît dans le document.
   - La zone principale doit être extraite en premier (ex: "Zone résidentielle 0.5 (3)")
   - Chercher d'abord après "Zone d'affectation:" dans les sections "Plans d'affectation"
   - Sinon, chercher les patterns "Zone résidentielle X.X (Y)" avec surface et pourcentage
   ...
\`;
`);