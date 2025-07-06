const fs = require('fs').promises;
const path = require('path');
const { User, Document } = require('../models-node');
const { extractDocument } = require('../services-node/pdfService');

/**
 * Script pour ajouter automatiquement tous les règlements du Valais Romand
 */

// Mapping des fichiers avec les noms propres des communes
const communesMapping = {
    'VS_Vétroz_Règlement des constructions.pdf': 'Vétroz',
    'VS_Vérrossaz_Règlement des constructions.pdf': 'Vérrossaz', 
    'VS_Vernamiège_Règlement des constructions.pdf': 'Vernamiège',
    'VS_Mase_Règlement des constructions.pdf': 'Mase',
    'VS_Nax_Règlement des constructions.pdf': 'Nax',
    'VS_Conthey_Règlement des constructions.pdf': 'Conthey',
    'VS_Sion_Règlement des constructions.pdf': 'Sion',
    'VS_Saxon_Règlement des constructions.pdf': 'Saxon',
    'VS_Savièse_Règlement des constructions.pdf': 'Savièse',
    'VS_Salgesch_Règlement des constructions.pdf': 'Salgesch',
    'VS_Saint-Leonard_Règlement des constructions.pdf': 'Saint-Léonard',
    'VS_Saillon_Règlement des constructions.pdf': 'Saillon',
    'VS_Nendaz_Règlement des constructions.pdf': 'Nendaz',
    'VS_Martigny_Règlement des constructions.pdf': 'Martigny',
    'VS_Charrat_Règlement des constructions.pdf': 'Charrat',
    'VS_Mollens_Règlement des constructions.pdf': 'Mollens',
    'VS_Chamoson_Règlement des constructions.pdf': 'Chamoson',
    'VS_Chamoson_Règlement des places de parcs.pdf': { commune: 'Chamoson', type: 'reglement_parking' },
    'VS_Ayent_Règlement des constructions.pdf': 'Ayent',
    'VS_Ardon_Règlement des constructions.pdf': 'Ardon',
    'VS_Arbaz_Règlement des constructions.pdf': 'Arbaz',
    'VS_Sierre_Règlement des constructions.pdf': 'Sierre',
    'VS_Riddes_Règlement des constructions.pdf': 'Riddes'
};

async function addAllValaisReglements() {
    try {
        console.log('🏔️  Ajout automatique des règlements du Valais Romand');
        console.log('=' .repeat(60));

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

        // Lister les fichiers PDF dans le dossier reglements
        const reglementsDir = path.join(__dirname, '../reglements');
        const files = await fs.readdir(reglementsDir);
        const pdfFiles = files.filter(file => file.endsWith('.pdf') && file !== 'README.md');

        console.log(`📄 ${pdfFiles.length} fichiers PDF trouvés`);
        console.log('');

        let successCount = 0;
        let errorCount = 0;

        for (const filename of pdfFiles) {
            if (!communesMapping[filename]) {
                console.log(`⚠️  Fichier non mappé ignoré: ${filename}`);
                continue;
            }

            const mapping = communesMapping[filename];
            const commune = typeof mapping === 'string' ? mapping : mapping.commune;
            const documentType = typeof mapping === 'string' ? 'reglement' : mapping.type;

            try {
                console.log(`🔄 Traitement: ${commune}...`);

                // Vérifier si le document existe déjà
                const existingDoc = await Document.findOne({
                    where: {
                        originalFilename: filename,
                        commune: commune
                    }
                });

                if (existingDoc) {
                    console.log(`   ⏭️  Déjà existant, ignoré`);
                    continue;
                }

                // Copier le fichier vers uploads
                const sourcePath = path.join(reglementsDir, filename);
                const timestamp = Date.now();
                const newFilename = `${timestamp}_${filename}`;
                const destinationPath = path.join(__dirname, '../uploads', newFilename);

                await fs.copyFile(sourcePath, destinationPath);

                // Créer l'entrée en base
                const document = await Document.create({
                    filename: newFilename,
                    originalFilename: filename,
                    userId: adminUser.id,
                    commune: commune,
                    documentType: documentType
                });

                console.log(`   ✅ Document créé (ID: ${document.id})`);

                // Extraction en arrière-plan (pas d'attente pour accélérer)
                extractDocument(document.id, destinationPath).then(result => {
                    if (result.success) {
                        console.log(`   🔍 ${commune}: Extraction réussie`);
                    } else {
                        console.log(`   ❌ ${commune}: Erreur extraction - ${result.error}`);
                    }
                }).catch(err => {
                    console.log(`   ❌ ${commune}: Erreur extraction - ${err.message}`);
                });

                successCount++;
                
            } catch (error) {
                console.log(`   ❌ Erreur: ${error.message}`);
                errorCount++;
            }
        }

        console.log('');
        console.log('=' .repeat(60));
        console.log(`🎉 Traitement terminé !`);
        console.log(`✅ Succès: ${successCount} documents`);
        if (errorCount > 0) {
            console.log(`❌ Erreurs: ${errorCount} documents`);
        }
        console.log(`🔍 Extraction et indexation en cours en arrière-plan...`);
        console.log('');
        console.log('🌐 Les règlements sont maintenant disponibles dans l\'application web !');

    } catch (error) {
        console.error('❌ Erreur globale:', error);
        process.exit(1);
    }
}

// Exporter la liste des communes pour le front-end
const VALAIS_COMMUNES = Object.values(communesMapping)
    .map(mapping => typeof mapping === 'string' ? mapping : mapping.commune)
    .filter((commune, index, array) => array.indexOf(commune) === index) // Déduplication
    .sort();

// Exécuter le script
if (require.main === module) {
    addAllValaisReglements().then(() => {
        console.log('📍 Communes du Valais Romand disponibles:');
        VALAIS_COMMUNES.forEach(commune => console.log(`   - ${commune}`));
        process.exit(0);
    });
}

module.exports = { addAllValaisReglements, VALAIS_COMMUNES }; 