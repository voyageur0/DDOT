// Test simple pour vérifier la route ia-constraints
require('ts-node').register({ transpileOnly: true });

try {
  console.log('🔍 Test de chargement de la route...');
  const router = require('./src/routes/iaConstraints');
  console.log('✅ Route chargée avec succès!');
  console.log('Type:', typeof router);
  console.log('Router stack:', router.stack ? router.stack.length + ' routes' : 'Pas de stack');
} catch (error) {
  console.error('❌ Erreur lors du chargement de la route:', error.message);
  console.error('Stack:', error.stack);
} 