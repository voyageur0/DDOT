const { createClient } = require('@supabase/supabase-js');

// === CONFIGURATION SUPABASE SÉCURISÉE ===

// Variables d'environnement requises
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Validation des variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Variables Supabase manquantes. Certaines fonctionnalités seront désactivées.');
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
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, supabaseOptions)
  : null;

// Client Supabase Admin (pour les opérations administratives)
const supabaseAdmin = SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Configuration PostgreSQL pour Sequelize via Supabase
const getPostgreSQLConfig = () => {
  // Extraire les informations de connexion depuis l'URL Supabase
  const url = new URL(SUPABASE_URL);
  const projectRef = url.hostname.split('.')[0];
  
  return {
    // Utiliser PostgreSQL si mot de passe Supabase configuré
    ...(process.env.SUPABASE_DB_PASSWORD ? {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      database: 'postgres', 
      username: 'postgres',
      password: process.env.SUPABASE_DB_PASSWORD,
    } : {
      dialect: 'sqlite',
      storage: './urban_analysis.db'
    }),
    
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
  supabaseAdmin,
  getPostgreSQLConfig,
  testSupabaseConnection,
  SUPABASE_URL,
  SUPABASE_ANON_KEY
}; 