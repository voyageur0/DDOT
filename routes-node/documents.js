const express = require('express');
const { Document } = require('../models-node');
const router = express.Router();


// Récupérer tous les documents de l'utilisateur
router.get('/', async (req, res) => {
  try {
    const documents = await Document.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    
    res.json(documents);
  } catch (error) {
    console.error('Erreur récupération documents:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des documents' });
  }
});

// Récupérer un document spécifique
router.get('/:id', async (req, res) => {
  try {
    const document = await Document.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    res.json(document);
  } catch (error) {
    console.error('Erreur récupération document:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du document' });
  }
});

// Supprimer un document
router.delete('/:id', async (req, res) => {
  try {
    const document = await Document.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    // Supprimer de l'index vectoriel
    const { removeDocument } = require('../services-node/vectorService');
    await removeDocument(document.id);
    
    // Supprimer de la base de données
    await document.destroy();
    
    res.json({ message: 'Document supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression document:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du document' });
  }
});

// Recherche dans les documents
router.post('/search', async (req, res) => {
  try {
    const { query, documentId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Requête vide' });
    }
    
    const { search, searchWithFilter } = require('../services-node/vectorService');
    
    let results;
    if (documentId) {
      // Vérifier que le document appartient à l'utilisateur
      const document = await Document.findOne({
        where: {
          id: documentId,
          userId: req.user.id
        }
      });
      
      if (!document) {
        return res.status(403).json({ error: 'Document non autorisé' });
      }
      
      results = await searchWithFilter(
        query,
        (meta) => meta.documentId === parseInt(documentId),
        5
      );
    } else {
      // Rechercher dans tous les documents de l'utilisateur
      const userDocIds = await Document.findAll({
        where: { userId: req.user.id },
        attributes: ['id']
      }).then(docs => docs.map(d => d.id));
      
      results = await searchWithFilter(
        query,
        (meta) => userDocIds.includes(meta.documentId),
        5
      );
    }
    
    // Formater les résultats
    const formattedResults = results.map(result => ({
      text: (result.metadata.chunkText || '').substring(0, 200) + '...',
      documentId: result.metadata.documentId,
      similarity: result.similarity
    }));
    
    res.json({ results: formattedResults });
  } catch (error) {
    console.error('Erreur recherche:', error);
    res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
});

module.exports = router; 