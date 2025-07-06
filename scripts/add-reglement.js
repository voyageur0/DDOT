const path = require('path');
const fs = require('fs').promises;
const { User, Document } = require('../models-node');
const { extractDocument } = require('../services-node/pdfService');

/**
 * Script pour ajouter manuellement des règlements communaux à la base de données
 * 
 * Usage: node scripts/add-reglement.js <chemin-pdf> <commune> [type-document]
 * 
 * Exemple: node scripts/add-reglement.js ./reglements/geneve.pdf "Genève" "reglement"
 */

async function addReglement() {
    try {
        // Vérifier les arguments
        const args = process.argv.slice(2);
        if (args.length < 2) {
            console.log('Usage: node scripts/add-reglement.js <chemin-pdf> <commune> [type-document]');
            console.log('Exemple: node scripts/add-reglement.js ./reglements/geneve.pdf "Genève" "reglement"');
            process.exit(1);
        }

        const [pdfPath, commune, documentType = 'reglement'] = args;

        // Vérifier que le fichier PDF existe
        try {
            await fs.access(pdfPath);
        } catch (error) {
            console.error(`❌ Fichier PDF non trouvé: ${pdfPath}`);
            process.exit(1);
        }

        console.log('🚀 Démarrage de l\'ajout du règlement...');
        console.log(`📄 Fichier: ${pdfPath}`);
        console.log(`🏘️  Commune: ${commune}`);
        console.log(`📋 Type: ${documentType}`);

        // Créer un utilisateur administrateur s'il n'existe pas
        let adminUser = await User.findOne({ where: { email: 'admin@urban-ia.com' } });
        
        if (!adminUser) {
            adminUser = await User.create({
                email: 'admin@urban-ia.com',
                passwordHash: 'admin-reglements-2025',
                isPremium: true
            });
            console.log('👤 Utilisateur admin créé');
        }

        // Copier le fichier PDF dans le dossier uploads
        const timestamp = Date.now();
        const originalName = path.basename(pdfPath);
        const filename = `${timestamp}_${originalName}`;
        const destinationPath = path.join(__dirname, '../uploads', filename);

        await fs.copyFile(pdfPath, destinationPath);
        console.log('📁 Fichier copié dans uploads/');

        // Créer l'entrée en base de données
        const document = await Document.create({
            filename: filename,
            originalFilename: originalName,
            userId: adminUser.id,
            commune: commune,
            documentType: documentType
        });

        console.log(`✅ Document créé avec l'ID: ${document.id}`);

        // Lancer l'extraction et l'indexation
        console.log('🔄 Extraction et indexation en cours...');
        
        const extractionResult = await extractDocument(document.id, destinationPath);
        
        if (extractionResult.success) {
            console.log('✅ Extraction réussie !');
            console.log('📊 Données extraites:', JSON.stringify(extractionResult.data, null, 2));
        } else {
            console.log('❌ Erreur lors de l\'extraction:', extractionResult.error);
        }

        console.log('\n🎉 Règlement ajouté avec succès !');
        console.log(`📍 ID du document: ${document.id}`);
        console.log(`📍 Commune: ${commune}`);
        console.log('🔍 Le document est maintenant disponible pour la recherche.');

    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

// Exécuter le script
if (require.main === module) {
    addReglement().then(() => {
        process.exit(0);
    });
}

module.exports = { addReglement }; 