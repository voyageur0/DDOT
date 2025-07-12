// === VALIDATION DES VARIABLES D'ENVIRONNEMENT ===

const requiredEnvVars = {
  // Variables obligatoires
  OPENAI_API_KEY: 'Clé API OpenAI pour les analyses IA',
  SESSION_SECRET: 'Secret pour les sessions Express',
  SUPABASE_URL: 'URL de la base de données Supabase',
  SUPABASE_ANON_KEY: 'Clé anonyme Supabase',
  
  // Variables conditionnelles
  SUPABASE_DB_PASSWORD: 'Mot de passe base de données (requis pour PostgreSQL)',
};

const optionalEnvVars = {
  NODE_ENV: 'development',
  PORT: '3001',
  FRONTEND_URL: 'http://localhost:3001',
  CORS_ORIGIN: 'http://localhost:3001',
  STRIPE_SECRET_KEY: null,
  STRIPE_PUBLISHABLE_KEY: null,
  STRIPE_WEBHOOK_SECRET: null
};

/**
 * Valide les variables d'environnement au démarrage
 * @throws {Error} Si des variables obligatoires manquent
 */
function validateEnvironment() {
  const missing = [];
  const warnings = [];

  // Vérifier les variables obligatoires
  for (const [varName, description] of Object.entries(requiredEnvVars)) {
    if (!process.env[varName]) {
      missing.push(`${varName}: ${description}`);
    }
  }

  // Vérifications conditionnelles
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SUPABASE_DB_PASSWORD) {
      missing.push('SUPABASE_DB_PASSWORD: Requis en production pour PostgreSQL');
    }
  }

  // Vérifier les variables Stripe si l'une est définie
  const stripeVars = ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'];
  const stripeConfigured = stripeVars.some(v => process.env[v]);
  if (stripeConfigured) {
    stripeVars.forEach(varName => {
      if (!process.env[varName]) {
        warnings.push(`${varName}: Recommandé si Stripe est utilisé`);
      }
    });
  }

  // Définir les valeurs par défaut
  for (const [varName, defaultValue] of Object.entries(optionalEnvVars)) {
    if (!process.env[varName] && defaultValue) {
      process.env[varName] = defaultValue;
    }
  }

  // Erreurs bloquantes
  if (missing.length > 0) {
    console.error('❌ Variables d\'environnement manquantes:');
    missing.forEach(err => console.error(`   - ${err}`));
    console.error('\n💡 Copiez le fichier env.example vers .env et configurez-le');
    throw new Error('Configuration d\'environnement incomplète');
  }

  // Avertissements
  if (warnings.length > 0) {
    console.warn('⚠️ Avertissements configuration:');
    warnings.forEach(warn => console.warn(`   - ${warn}`));
  }

  console.log('✅ Configuration d\'environnement validée');
  
  // Log de la configuration (sans secrets)
  console.log(`🔧 Environnement: ${process.env.NODE_ENV}`);
  console.log(`🚀 Port: ${process.env.PORT}`);
  console.log(`🔗 Frontend: ${process.env.FRONTEND_URL}`);
  console.log(`💾 Base de données: ${process.env.SUPABASE_DB_PASSWORD ? 'PostgreSQL (Supabase)' : 'SQLite (développement)'}`);
}

module.exports = {
  validateEnvironment,
  requiredEnvVars,
  optionalEnvVars
};