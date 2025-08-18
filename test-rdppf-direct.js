// Test RDPPF extraction directly
const { analyzeRdppf } = require('./dist/lib/rdppfExtractor');

async function testRdppfExtraction() {
    console.log('🔍 Testing RDPPF extraction...\n');
    
    // This is a typical RDPPF URL for parcelle 2257 in Sion
    const rdppfUrl = 'https://sitonline.ch/rdppf/reports?format=pdf&lang=FR&EGRID=CH536633313461';
    
    try {
        console.log('📥 Downloading and analyzing RDPPF...');
        const constraints = await analyzeRdppf(rdppfUrl);
        
        console.log(`\n✅ Found ${constraints.length} constraints:\n`);
        
        // Look for zone constraints
        const zoneConstraints = constraints.filter(c => 
            c.theme === 'Destination de zone' || 
            c.rule.includes('Zone résidentielle')
        );
        
        if (zoneConstraints.length > 0) {
            console.log('🏗️ Zone Constraints:');
            zoneConstraints.forEach(c => {
                console.log(`   Theme: ${c.theme}`);
                console.log(`   Rule: ${c.rule}`);
                console.log('');
            });
        } else {
            console.log('❌ No zone constraints found');
        }
        
        // Show all constraints
        console.log('\n📋 All Constraints:');
        constraints.forEach((c, i) => {
            console.log(`${i + 1}. ${c.theme}: ${c.rule.substring(0, 100)}${c.rule.length > 100 ? '...' : ''}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the test
testRdppfExtraction();