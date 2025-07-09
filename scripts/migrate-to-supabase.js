const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Configuration SQLite (source)
const sqliteDB = new Sequelize({
  dialect: 'sqlite',
  storage: './urban_analysis.db',
  logging: false
});

// Configuration PostgreSQL Supabase (destination)
const getSupabaseConfig = () => {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://firujzfswtatpjilgdry.supabase.co';
  const url = new URL(SUPABASE_URL);
  const projectRef = url.hostname.split('.')[0];
  
  if (!process.env.SUPABASE_DB_PASSWORD) {
    console.error('❌ SUPABASE_DB_PASSWORD manquant dans .env');
    console.error('🔑 Récupérez le mot de passe dans Settings > Database de votre projet Supabase');
    process.exit(1);
  }
  
  return {
    dialect: 'postgres',
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    database: 'postgres',
    username: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: console.log
  };
};

const postgresDB = new Sequelize(getSupabaseConfig());

// === MODÈLES SQLITE (SOURCE) ===
const SQLiteModels = {
  User: sqliteDB.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING(120), unique: true, allowNull: false },
    passwordHash: { type: DataTypes.STRING(128), allowNull: false },
    stripeCustomerId: { type: DataTypes.STRING(100) },
    stripeSubscriptionId: { type: DataTypes.STRING(100) },
    isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
    subscriptionEndDate: { type: DataTypes.DATE }
  }, { timestamps: true }),
  
  Document: sqliteDB.define('Document', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    filename: { type: DataTypes.STRING(255), allowNull: false },
    originalFilename: { type: DataTypes.STRING(255) },
    commune: { type: DataTypes.STRING(100) },
    documentType: { type: DataTypes.STRING(50), defaultValue: 'reglement' },
    rawText: { type: DataTypes.TEXT },
    extractedData: { type: DataTypes.JSON },
    userId: { type: DataTypes.INTEGER, allowNull: false }
  }, { timestamps: true }),
  
  DocumentEmbedding: sqliteDB.define('DocumentEmbedding', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    documentId: { type: DataTypes.INTEGER, allowNull: false },
    chunkIndex: { type: DataTypes.INTEGER, allowNull: false },
    chunkText: { type: DataTypes.TEXT, allowNull: false },
    embedding: { type: DataTypes.BLOB },
    metadata: { type: DataTypes.JSON }
  }, { timestamps: false }),
  
  Analysis: sqliteDB.define('Analysis', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    documentId: { type: DataTypes.INTEGER, allowNull: false },
    analysisType: { type: DataTypes.STRING(50), allowNull: false },
    inputData: { type: DataTypes.JSON },
    result: { type: DataTypes.TEXT },
    tokensUsed: { type: DataTypes.INTEGER },
    costUsd: { type: DataTypes.FLOAT }
  }, { timestamps: true })
};

// === MODÈLES POSTGRESQL (DESTINATION) ===
const PostgreModels = {
  User: postgresDB.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING(120), unique: true, allowNull: false },
    passwordHash: { type: DataTypes.STRING(128), allowNull: false },
    stripeCustomerId: { type: DataTypes.STRING(100) },
    stripeSubscriptionId: { type: DataTypes.STRING(100) },
    isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
    subscriptionEndDate: { type: DataTypes.DATE }
  }, { timestamps: true }),
  
  Document: postgresDB.define('Document', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    filename: { type: DataTypes.STRING(255), allowNull: false },
    originalFilename: { type: DataTypes.STRING(255) },
    commune: { type: DataTypes.STRING(100) },
    documentType: { type: DataTypes.STRING(50), defaultValue: 'reglement' },
    rawText: { type: DataTypes.TEXT },
    extractedData: { type: DataTypes.JSONB }, // JSONB pour PostgreSQL
    userId: { type: DataTypes.INTEGER, allowNull: false }
  }, { timestamps: true }),
  
  DocumentEmbedding: postgresDB.define('DocumentEmbedding', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    documentId: { type: DataTypes.INTEGER, allowNull: false },
    chunkIndex: { type: DataTypes.INTEGER, allowNull: false },
    chunkText: { type: DataTypes.TEXT, allowNull: false },
    embedding: { type: DataTypes.TEXT }, // TEXT pour PostgreSQL
    metadata: { type: DataTypes.JSONB }
  }, { timestamps: false }),
  
  Analysis: postgresDB.define('Analysis', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    documentId: { type: DataTypes.INTEGER, allowNull: false },
    analysisType: { type: DataTypes.STRING(50), allowNull: false },
    inputData: { type: DataTypes.JSONB },
    result: { type: DataTypes.TEXT },
    tokensUsed: { type: DataTypes.INTEGER },
    costUsd: { type: DataTypes.FLOAT }
  }, { timestamps: true })
};

// === FONCTION DE MIGRATION ===
async function migrateData() {
  console.log('🚀 Début de la migration SQLite → Supabase PostgreSQL');
  
  try {
    // 1. Tester les connexions
    console.log('🔍 Test de connexion SQLite...');
    await sqliteDB.authenticate();
    console.log('✅ SQLite connecté');
    
    console.log('🔍 Test de connexion Supabase PostgreSQL...');
    await postgresDB.authenticate();
    console.log('✅ Supabase PostgreSQL connecté');
    
    // 2. Créer les tables PostgreSQL
    console.log('📋 Création des tables PostgreSQL...');
    await postgresDB.sync({ force: false }); // force: false pour ne pas écraser
    console.log('✅ Tables PostgreSQL créées/vérifiées');
    
    // 3. Vérifier si SQLite a des données
    const userCount = await SQLiteModels.User.count();
    const docCount = await SQLiteModels.Document.count();
    const embCount = await SQLiteModels.DocumentEmbedding.count();
    const anaCount = await SQLiteModels.Analysis.count();
    
    console.log(`📊 Données SQLite trouvées:`);
    console.log(`   - Users: ${userCount}`);
    console.log(`   - Documents: ${docCount}`);
    console.log(`   - Embeddings: ${embCount}`);
    console.log(`   - Analyses: ${anaCount}`);
    
    if (userCount === 0 && docCount === 0) {
      console.log('ℹ️ Aucune donnée à migrer. Base SQLite vide.');
      return;
    }
    
    // 4. Migration des Users
    if (userCount > 0) {
      console.log('👥 Migration des utilisateurs...');
      const users = await SQLiteModels.User.findAll();
      for (const user of users) {
        await PostgreModels.User.upsert({
          id: user.id,
          email: user.email,
          passwordHash: user.passwordHash,
          stripeCustomerId: user.stripeCustomerId,
          stripeSubscriptionId: user.stripeSubscriptionId,
          isPremium: user.isPremium,
          subscriptionEndDate: user.subscriptionEndDate,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        });
      }
      console.log(`✅ ${users.length} utilisateurs migrés`);
    }
    
    // 5. Migration des Documents
    if (docCount > 0) {
      console.log('📄 Migration des documents...');
      const documents = await SQLiteModels.Document.findAll();
      for (const doc of documents) {
        await PostgreModels.Document.upsert({
          id: doc.id,
          filename: doc.filename,
          originalFilename: doc.originalFilename,
          commune: doc.commune,
          documentType: doc.documentType,
          rawText: doc.rawText,
          extractedData: doc.extractedData,
          userId: doc.userId,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        });
      }
      console.log(`✅ ${documents.length} documents migrés`);
    }
    
    // 6. Migration des Embeddings
    if (embCount > 0) {
      console.log('🔍 Migration des embeddings...');
      const embeddings = await SQLiteModels.DocumentEmbedding.findAll();
      for (const emb of embeddings) {
        // Convertir BLOB en TEXT pour PostgreSQL
        let embeddingText = null;
        if (emb.embedding) {
          embeddingText = Buffer.isBuffer(emb.embedding) 
            ? emb.embedding.toString('base64')
            : emb.embedding.toString();
        }
        
        await PostgreModels.DocumentEmbedding.upsert({
          id: emb.id,
          documentId: emb.documentId,
          chunkIndex: emb.chunkIndex,
          chunkText: emb.chunkText,
          embedding: embeddingText,
          metadata: emb.metadata
        });
      }
      console.log(`✅ ${embeddings.length} embeddings migrés`);
    }
    
    // 7. Migration des Analyses
    if (anaCount > 0) {
      console.log('📊 Migration des analyses...');
      const analyses = await SQLiteModels.Analysis.findAll();
      for (const ana of analyses) {
        await PostgreModels.Analysis.upsert({
          id: ana.id,
          userId: ana.userId,
          documentId: ana.documentId,
          analysisType: ana.analysisType,
          inputData: ana.inputData,
          result: ana.result,
          tokensUsed: ana.tokensUsed,
          costUsd: ana.costUsd,
          createdAt: ana.createdAt,
          updatedAt: ana.updatedAt
        });
      }
      console.log(`✅ ${analyses.length} analyses migrées`);
    }
    
    // 8. Vérification post-migration
    console.log('🔍 Vérification post-migration...');
    const pgUserCount = await PostgreModels.User.count();
    const pgDocCount = await PostgreModels.Document.count();
    const pgEmbCount = await PostgreModels.DocumentEmbedding.count();
    const pgAnaCount = await PostgreModels.Analysis.count();
    
    console.log(`📊 Données PostgreSQL après migration:`);
    console.log(`   - Users: ${pgUserCount} (était ${userCount})`);
    console.log(`   - Documents: ${pgDocCount} (était ${docCount})`);
    console.log(`   - Embeddings: ${pgEmbCount} (était ${embCount})`);
    console.log(`   - Analyses: ${pgAnaCount} (était ${anaCount})`);
    
    console.log('🎉 Migration terminée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur durant la migration:', error);
    throw error;
  } finally {
    await sqliteDB.close();
    await postgresDB.close();
  }
}

// === EXÉCUTION ===
if (require.main === module) {
  require('dotenv').config();
  
  console.log('🔧 Script de migration DDOT: SQLite → Supabase PostgreSQL');
  console.log('📋 Prérequis: SUPABASE_DB_PASSWORD configuré dans .env');
  
  migrateData()
    .then(() => {
      console.log('✅ Migration complétée. Vous pouvez maintenant activer PostgreSQL dans la configuration.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Échec de la migration:', error.message);
      process.exit(1);
    });
}

module.exports = { migrateData }; 