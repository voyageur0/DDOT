#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Démarrage du serveur DDOT en mode développement...\n');

// Vérifier que le fichier .env existe
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ Fichier .env manquant!');
  console.log('💡 Création à partir de .env.example...');
  
  const envExamplePath = path.join(__dirname, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Fichier .env créé. Veuillez configurer vos clés API.\n');
  } else {
    console.error('❌ Fichier .env.example introuvable!');
    process.exit(1);
  }
}

// Charger les variables d'environnement
require('dotenv').config();

// Vérifier les clés essentielles
console.log('🔍 Vérification de la configuration...');
const checks = {
  'OpenAI API': !!process.env.OPENAI_API_KEY,
  'Session Secret': !!process.env.SESSION_SECRET,
  'Port configuré': !!process.env.PORT || true
};

Object.entries(checks).forEach(([key, value]) => {
  console.log(`  ${value ? '✅' : '⚠️ '} ${key}: ${value ? 'OK' : 'Manquant'}`);
});

console.log('\n📦 Installation des dépendances si nécessaire...');

// Vérifier si node_modules existe
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('Installation des packages npm...');
  const npmInstall = spawn('npm', ['install'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  npmInstall.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Erreur lors de l\'installation des dépendances');
      process.exit(1);
    }
    startServer();
  });
} else {
  startServer();
}

function startServer() {
  console.log('\n🔄 Démarrage du serveur avec nodemon...\n');
  
  const nodemon = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  nodemon.on('error', (error) => {
    console.error('❌ Erreur lors du démarrage:', error);
    process.exit(1);
  });

  nodemon.on('close', (code) => {
    console.log(`\n⚡ Serveur arrêté avec le code ${code}`);
  });

  // Gérer l'arrêt propre
  process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur...');
    nodemon.kill();
    process.exit(0);
  });
}