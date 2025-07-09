const { createClient } = require('@supabase/supabase-js');

// === CONFIGURATION SUPABASE SÉCURISÉE ===

// Variables d'environnement requises
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://firujzfswtatpjilgdry.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcnVqemZzd3RhdHBqaWxnZHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNzk4NTMsImV4cCI6MjA2NzY1NTg1M30.PvAl1J6ndKwosJjnAm_ph1kWKqBBI0xXoVCIl4YOjlo';

// Validation des variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Variables Supabase manquantes. Veuillez configurer SUPABASE_URL et SUPABASE_ANON_KEY dans votre fichier .env'
  );
}

// Configuration du client Supabase avec options de sécurité
const supabaseOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10 // Limitation du rate limiting
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'ddot-urban-analysis'
    }
  }
};

// Client Supabase principal (avec RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, supabaseOptions);

// Configuration PostgreSQL pour Sequelize via Supabase
const getPostgreSQLConfig = () => {
  // Extraire les informations de connexion depuis l'URL Supabase
  const url = new URL(SUPABASE_URL);
  const projectRef = url.hostname.split('.')[0];
  
  return {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    // Temporairement utiliser SQLite pendant la configuration PostgreSQL
    // TODO: Réactiver PostgreSQL une fois la configuration correcte trouvée
    dialect: 'sqlite',
    storage: './urban_analysis.db',
    
    // Configuration PostgreSQL pour plus tard (désactivée temporairement)
    // ...(process.env.SUPABASE_DB_PASSWORD ? {
    //   host: `aws-0-eu-central-1.pooler.supabase.com`,
    //   port: 6543,
    //   database: 'postgres', 
    //   username: `postgres.${projectRef}`,
    //   password: process.env.SUPABASE_DB_PASSWORD
    // } : {
    //   dialect: 'sqlite',
    //   storage: './urban_analysis.db'
    // }),
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false
    }
  };
};

// Test de connexion Supabase
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('_health').select('*').limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = table not found (normal)
      console.log('⚠️ Supabase connecté mais avec avertissement:', error.message);
    } else {
      console.log('✅ Supabase connecté avec succès');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion Supabase:', error.message);
    return false;
  }
}

module.exports = {
  supabase,
  getPostgreSQLConfig,
  testSupabaseConnection,
  SUPABASE_URL,
  SUPABASE_ANON_KEY
}; 