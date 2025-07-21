// CE FICHIER EST MAINTENANT INTÉGRÉ DANS server.js
// Les routes TypeScript sont importées directement dans le serveur principal
// pour éviter les conflits de port et simplifier l'architecture

console.log('🔧 Serveur TypeScript intégré dans server.js - ce fichier est obsolète');

// Export vide pour éviter les erreurs d'import
export default {};

// Note: Les routes suivantes sont maintenant dans server.js :
// - iaConstraintsRouter -> app.use('/api', iaConstraintsTS)
// - ownersRouter -> sera intégré si nécessaire
// - utilsRouter -> sera intégré si nécessaire
// - geoadmin-search -> déjà dans server.js via routes-node/geoadmin-proxy.js