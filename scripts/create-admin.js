#!/usr/bin/env node

// Charger les variables d'environnement
require('dotenv').config();

const { supabaseAdmin } = require('../config/supabase');
const { createContextLogger } = require('../utils/logger');

const logger = createContextLogger('ADMIN_SETUP');

async function createAdminUser() {
  try {
    console.log('🔧 Création d\'un compte administrateur DDOT...\n');

    // Informations de l'administrateur
    const adminEmail = 'admin@ddot.ch';
    const adminPassword = 'AdminDDOT2024!';
    const adminName = 'Administrateur DDOT';

    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔑 Mot de passe: ${adminPassword}\n`);

    // Vérifier si l'utilisateur existe déjà
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers.users.find(user => user.email === adminEmail);
      
      if (existingUser) {
        console.log('⚠️ Un utilisateur avec cet email existe déjà');
        console.log(`ID: ${existingUser.id}`);
        console.log(`Rôle: ${existingUser.user_metadata?.role || 'user'}`);
        
        if (existingUser.user_metadata?.role !== 'admin') {
          console.log('\n🔄 Mise à jour du rôle vers admin...');
          const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            user_metadata: { 
              ...existingUser.user_metadata,
              role: 'admin',
              name: adminName,
              updated_at: new Date().toISOString()
            }
          });
          
          if (error) throw error;
          console.log('✅ Rôle mis à jour vers admin');
        }
        
        console.log('\n✨ Compte administrateur prêt!');
        return;
      }
    } catch (error) {
      console.log('ℹ️ Vérification des utilisateurs existants échouée, création d\'un nouveau compte...');
    }

    // Créer le nouvel utilisateur administrateur
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        name: adminName,
        role: 'admin',
        created_by: 'system',
        created_at: new Date().toISOString()
      }
    });

    if (error) {
      throw error;
    }

    console.log('✅ Compte administrateur créé avec succès!');
    console.log(`\n🆔 ID utilisateur: ${data.user.id}`);
    console.log(`📧 Email: ${data.user.email}`);
    console.log(`👤 Nom: ${data.user.user_metadata.name}`);
    console.log(`🛡️ Rôle: ${data.user.user_metadata.role}`);

    console.log('\n🚀 Vous pouvez maintenant vous connecter sur http://localhost:3001 avec:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Mot de passe: ${adminPassword}`);

    logger.info('Compte administrateur créé', { 
      userId: data.user.id, 
      email: data.user.email,
      role: 'admin'
    });

  } catch (error) {
    console.error('❌ Erreur lors de la création du compte admin:', error.message);
    logger.error('Erreur création admin', { error: error.message });
    process.exit(1);
  }
}

// Test de connexion Supabase d'abord
async function testConnection() {
  try {
    console.log('🔍 Test de connexion à Supabase...');
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    
    if (error) throw error;
    
    console.log('✅ Connexion Supabase OK');
    return true;
  } catch (error) {
    console.error('❌ Impossible de se connecter à Supabase:', error.message);
    console.log('\n🔧 Vérifiez votre configuration dans .env:');
    console.log('   - SUPABASE_URL');
    console.log('   - SUPABASE_SERVICE_KEY');
    return false;
  }
}

// Fonction principale
async function main() {
  console.log('🏗️ DDOT - Configuration du compte administrateur\n');
  
  const connected = await testConnection();
  if (!connected) {
    process.exit(1);
  }
  
  await createAdminUser();
  
  console.log('\n🎉 Configuration terminée!');
  console.log('🌐 Rendez-vous sur http://localhost:3001 pour tester l\'application\n');
}

// Lancer le script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createAdminUser, testConnection };