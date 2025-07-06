const http = require('http');

function testConnection() {
    const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        console.log(`✅ Application accessible sur http://localhost:3001`);
        console.log(`📊 Status: ${res.statusCode}`);
        process.exit(0);
    });

    req.on('error', (err) => {
        console.log(`❌ Application non accessible: ${err.message}`);
        console.log('🔄 Tentative de redémarrage recommandée...');
        process.exit(1);
    });

    req.setTimeout(5000, () => {
        console.log('⏰ Timeout - L\'application met du temps à démarrer');
        process.exit(1);
    });

    req.end();
}

testConnection(); 