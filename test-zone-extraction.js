// Test script to debug zone extraction issue
const axios = require('axios');

async function testZoneExtraction() {
    console.log('🔍 Testing zone extraction for Sion parcelle 2257...\n');
    
    try {
        const response = await axios.post('http://127.0.0.1:3001/api/ia-constraints', {
            searchQuery: 'CH536633313461',
            analysisType: 'quick' // Use quick analysis for faster testing
        }, {
            timeout: 60000 // 60 seconds timeout
        });
        
        const data = response.data;
        
        console.log('✅ Response received!\n');
        
        // Check parcel data
        if (data.data && data.data.parcel) {
            console.log('📍 Parcel Information:');
            console.log('   Address:', data.data.parcel.address);
            console.log('   Zone:', data.data.parcel.zone);
            console.log('   Zone Surface:', data.data.parcel.zone_surface);
            console.log('');
        } else {
            console.log('❌ No parcel data in response\n');
        }
        
        // Check RDPPF constraints for zone info
        if (data.data && data.data.constraints) {
            const zoneConstraints = data.data.constraints.filter(c => 
                c.theme === 'Destination de zone' || 
                (c.rule && c.rule.includes('Zone résidentielle'))
            );
            
            if (zoneConstraints.length > 0) {
                console.log('🏗️ Zone Constraints Found:');
                zoneConstraints.forEach(c => {
                    console.log(`   - ${c.theme}: ${c.rule}`);
                });
            }
        }
        
        // Check metadata
        if (data.metadata) {
            console.log('\n📊 Metadata:');
            console.log('   Completeness:', data.metadata.completeness + '%');
            console.log('   Processing time:', data.metadata.processingTime + 'ms');
        }
        
        // Check raw data for debugging
        if (data.data && data.data.analysis) {
            console.log('\n🔍 Debug - Analysis Data:');
            console.log('   zoneInfo:', data.data.analysis.zoneInfo);
            if (data.data.analysis.rdppfData) {
                console.log('   rdppfData:', JSON.stringify(data.data.analysis.rdppfData, null, 2));
            }
            if (data.data.analysis.rdppfConstraints) {
                console.log('   rdppfConstraints count:', data.data.analysis.rdppfConstraints.length);
            }
        }
        
    } catch (error) {
        if (error.response) {
            console.error('❌ API Error:', error.response.status, error.response.data);
        } else if (error.code === 'ECONNABORTED') {
            console.error('❌ Request timeout - the analysis is taking too long');
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

// Run the test
testZoneExtraction();