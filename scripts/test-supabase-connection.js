const { Pool } = require('pg');
require('dotenv').config();

// === SCRIPT DE TEST POUR CONNEXION SUPABASE POSTGRESQL ===

async function testSupabaseConnections() {
  const projectRef = 'firujzfswtatpjilgdry';
  const password = process.env.SUPABASE_DB_PASSWORD;
  
  if (!password) {
    console.log('❌ SUPABASE_DB_PASSWORD manquant dans .env');
    return;
  }

  console.log('🔍 Test des différentes configurations Supabase PostgreSQL...\n');

  // Configuration 1: Direct connection
  const directConfig = {
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: password,
    ssl: { rejectUnauthorized: false }
  };

  // Configuration 2: Pooler connection
  const poolerConfig = {
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: `postgres.${projectRef}`,
    password: password,
    ssl: { rejectUnauthorized: false }
  };

  // Configuration 3: IPv6 Pooler
  const poolerIPv6Config = {
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: `postgres.${projectRef}`,
    password: password,
    ssl: { rejectUnauthorized: false }
  };

  const configs = [
    { name: 'Direct Connection', config: directConfig },
    { name: 'Transaction Pooler (6543)', config: poolerConfig },
    { name: 'Session Pooler (5432)', config: poolerIPv6Config }
  ];

  for (const { name, config } of configs) {
    console.log(`📡 Test: ${name}`);
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   User: ${config.user}`);
    
    try {
      const pool = new Pool(config);
      const client = await pool.connect();
      
      // Test simple query
      const result = await client.query('SELECT version();');
      console.log(`   ✅ Connexion réussie!`);
      console.log(`   📊 Version: ${result.rows[0].version.substring(0, 50)}...`);
      
      client.release();
      await pool.end();
      
      console.log(`   🎉 Configuration ${name} fonctionne!\n`);
      return config; // Retourner la première config qui marche
      
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}`);
      console.log(`   Code: ${error.code || 'N/A'}\n`);
    }
  }
  
  console.log('⚠️ Aucune configuration PostgreSQL ne fonctionne.');
  console.log('L\'application continuera avec SQLite.');
  return null;
}

// Script principal
async function main() {
  console.log('=== TEST DE CONNEXION SUPABASE POSTGRESQL ===\n');
  
  const workingConfig = await testSupabaseConnections();
  
  if (workingConfig) {
    console.log('🔧 Configuration recommandée pour config/supabase.js:');
    console.log(JSON.stringify(workingConfig, null, 2));
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSupabaseConnections }; 