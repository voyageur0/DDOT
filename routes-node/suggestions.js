const express = require('express');
const router = express.Router();
const { createContextLogger } = require('../utils/logger');

const logger = createContextLogger('SUGGESTIONS');

// Données de suggestions pour les communes valaisannes
const communes = [
  'Sion', 'Martigny', 'Chamoson', 'Collonges', 'Savièse', 'Val de Bagnes', 
  'Vollèges', 'Monthey', 'Sierre', 'Vétroz', 'Conthey', 'Fully', 'Ayent', 
  'Nendaz', 'Leytron', 'Riddes', 'Saxon', 'Orsières', 'Bovernier', 'Brig-Glis'
];

// Exemples d'adresses pour les suggestions
const addressExamples = [
  { commune: 'Sion', addresses: ['Rue du Rhône 12', 'Avenue de la Gare 35', 'Place de la Planta 3', 'Rue de Lausanne 47'] },
  { commune: 'Martigny', addresses: ['Avenue de la Gare 6', 'Rue du Léman 18', 'Place Centrale 9', 'Rue de la Délèze 21'] },
  { commune: 'Chamoson', addresses: ['Route Cantonale 15', 'Chemin des Vignes 8', 'Rue du Village 4'] },
  { commune: 'Sierre', addresses: ['Avenue Général-Guisan 10', 'Rue du Bourg 22', 'Place de la Gare 7'] },
  { commune: 'Monthey', addresses: ['Avenue de la Gare 45', 'Rue du Châble 33', 'Place Tübingen 2'] }
];

// Exemples de parcelles (numéros fictifs mais réalistes)
const parcelExamples = [
  'VS 2611 435', 'VS 2611 436', 'VS 2611 437', // Chamoson
  'VS 6266 1024', 'VS 6266 1025', 'VS 6266 1026', // Sion
  'VS 6002 789', 'VS 6002 790', 'VS 6002 791', // Martigny
  'VS 6294 456', 'VS 6294 457', 'VS 6294 458', // Sierre
  'VS 6153 234', 'VS 6153 235', 'VS 6153 236'  // Monthey
];

// Route pour les suggestions de recherche simples
router.get('/', async (req, res) => {
  try {
    const { q, limit = 8 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }
    
    const query = q.toLowerCase().trim();
    const suggestions = [];
    
    // Suggestions simples basées sur les communes
    communes.forEach(commune => {
      if (commune.toLowerCase().includes(query)) {
        suggestions.push(commune);
      }
    });
    
    // Suggestions d'adresses simples
    addressExamples.forEach(({ commune, addresses }) => {
      addresses.forEach(address => {
        if (address.toLowerCase().includes(query) || commune.toLowerCase().includes(query)) {
          suggestions.push(`${address}, ${commune}`);
        }
      });
    });
    
    // Suggestions de parcelles simples
    parcelExamples.forEach(parcel => {
      if (parcel.toLowerCase().includes(query)) {
        suggestions.push(parcel);
      }
    });
    
    // Limiter le nombre de suggestions
    const limitedSuggestions = [...new Set(suggestions)].slice(0, parseInt(limit));
    
    logger.info('Suggestions générées', { 
      query, 
      count: limitedSuggestions.length,
      ip: req.ip 
    });
    
    res.json({ 
      suggestions: limitedSuggestions,
      query,
      count: limitedSuggestions.length
    });
    
  } catch (error) {
    logger.error('Erreur lors de la génération des suggestions', { 
      error: error.message,
      query: req.query.q 
    });
    
    res.status(500).json({ 
      error: 'Erreur lors de la génération des suggestions',
      suggestions: []
    });
  }
});

// Route de santé
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Service de suggestions opérationnel',
    communes_count: communes.length,
    examples_count: addressExamples.reduce((total, item) => total + item.addresses.length, 0)
  });
});

module.exports = router;