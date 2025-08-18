// Minimal test to check zone extraction
const axios = require('axios');

async function simpleTest() {
    console.log('Testing zone extraction...');
    
    try {
        // Use a very short timeout to see if the server is responding
        const response = await axios.get('http://127.0.0.1:3001/', {
            timeout: 5000
        });
        console.log('✅ Server is responding');
        
        // Now let's check the suggestions endpoint which works
        const suggestionsResponse = await axios.get('http://127.0.0.1:3001/api/suggestions/health');
        console.log('✅ API is working:', suggestionsResponse.data.message);
        
        // Try a simple geoadmin search
        const searchResponse = await axios.get('http://127.0.0.1:3001/api/geoadmin-search?searchText=sion%20parcelle%202257&limit=5&origins=parcel');
        console.log('\n📍 Search results:');
        if (searchResponse.data && searchResponse.data.results) {
            searchResponse.data.results.forEach(r => {
                console.log(`  - ${r.attrs.detail || r.attrs.label}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

simpleTest();