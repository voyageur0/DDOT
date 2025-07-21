#!/usr/bin/env node

const { exec, spawn } = require('child_process');
const path = require('path');

console.log('🧹 Nettoyage des processus existants...');

// Fonction pour tuer les processus sur un port
function killPort(port) {
  return new Promise((resolve) => {
    exec(`lsof -ti:${port}`, (err, stdout) => {
      if (stdout) {
        const pids = stdout.trim().split('\n');
        pids.forEach(pid => {
          if (pid) {
            exec(`kill -9 ${pid}`, () => {});
          }
        });
        console.log(`🔥 Processus sur port ${port} terminés`);
      }
      resolve();
    });
  });
}

// Fonction pour tuer nodemon
function killNodemon() {
  return new Promise((resolve) => {
    exec('pkill -f nodemon', () => {
      console.log('🔥 Nodemon terminé');
      resolve();
    });
  });
}

async function cleanStart() {
  // Nettoyer les ports et processus
  await killPort(3001);
  await killPort(3000);
  await killNodemon();
  
  // Attendre un peu
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('🚀 Démarrage du serveur...');
  
  // Démarrer le serveur
  const server = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  server.on('error', (error) => {
    console.error('❌ Erreur de démarrage:', error);
  });
  
  process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur...');
    server.kill();
    process.exit(0);
  });
}

cleanStart().catch(console.error);