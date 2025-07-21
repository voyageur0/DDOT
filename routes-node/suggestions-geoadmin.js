const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createContextLogger } = require('../utils/logger');

const logger = createContextLogger('SUGGESTIONS_GEOADMIN');

// Configuration de l'API GeoAdmin
const GEOADMIN_BASE_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
const SEARCH_LAYERS = [
  'ch.kantone.cadastralwebmap-farbe',
  'ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill',
  'ch.bfs.gebaeude_wohnungs_register',
  'ch.swisstopo.amtliches-strassenverzeichnis'
];

// Route pour les suggestions de recherche via GeoAdmin
router.get('/', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }
    
    const query = q.trim();
    
    logger.info('Recherche de suggestions GeoAdmin', { 
      query,
      ip: req.ip 
    });

    // Déterminer le type de recherche
    const isParcelSearch = /^(VS|vs)?\s*\d+/.test(query) || query.toLowerCase().includes('parcelle');
    const isCoordinateSearch = /^\d{6,7}[\s,]\d{6,7}/.test(query);
    
    // Paramètres adaptés pour le Valais
    const searchParams = {
      searchText: query,
      type: 'locations',
      limit: limit * 2, // Demander plus pour filtrer après
      lang: 'fr',
      sr: 2056 // Système de coordonnées suisse LV95
    };
    
    // Si c'est une recherche de parcelle, privilégier les layers cadastraux
    if (isParcelSearch) {
      searchParams.origins = 'parcel';
    } else {
      searchParams.origins = 'address,parcel';
    }
    
    // Appel à l'API GeoAdmin
    const response = await axios.get(GEOADMIN_BASE_URL, {
      params: searchParams,
      timeout: 5000
    });

    // Transformer les résultats GeoAdmin en format simple
    const suggestions = [];
    
    if (response.data && response.data.results) {
      // Filtrer pour privilégier les résultats du Valais
      const valaisResults = [];
      const otherResults = [];
      
      response.data.results.forEach(result => {
        const attrs = result.attrs || {};
        const canton = attrs.canton || attrs.kt || '';
        
        if (canton === 'VS' || canton === 'Valais' || 
            (attrs.gemeinde && attrs.gemeinde.includes('VS')) ||
            (attrs.gemname && attrs.gemname.includes('VS'))) {
          valaisResults.push(result);
        } else {
          otherResults.push(result);
        }
      });
      
      // Traiter d'abord les résultats du Valais, puis les autres
      [...valaisResults, ...otherResults].forEach(result => {
        const attrs = result.attrs || {};
        let suggestion = '';
        
        // Déterminer le type et formater la suggestion
        // Extraire la suggestion à partir des attributs
        if (attrs.label) {
          // GeoAdmin retourne parfois du HTML, on le nettoie
          suggestion = attrs.label.replace(/<[^>]*>/g, '').trim();
        } else if (attrs.featurename) {
          suggestion = attrs.featurename.replace(/<[^>]*>/g, '').trim();
        } else if (result.attrs.origin === 'parcel') {
          // Parcelle cadastrale
          const commune = attrs.gemeinde || attrs.gemname || '';
          const parcelNum = attrs.number || attrs.no || '';
          
          if (parcelNum) {
            suggestion = `Parcelle ${parcelNum}`;
            if (commune) {
              suggestion += `, ${commune}`;
            }
          }
        }
        
        // Nettoyer et ajouter la suggestion
        if (suggestion) {
          // Supprimer les balises HTML et espaces multiples
          suggestion = suggestion.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          
          if (suggestion && !suggestions.includes(suggestion)) {
            suggestions.push(suggestion);
          }
        }
      });
    }
    
    // Ajouter des suggestions de recherche par coordonnées si c'est un nombre
    if (/^\d+/.test(query) && suggestions.length < limit) {
      suggestions.push(`Coordonnées: ${query}`);
    }
    
    // Limiter le nombre de suggestions
    const limitedSuggestions = suggestions.slice(0, parseInt(limit));
    
    logger.info('Suggestions GeoAdmin générées', { 
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
    logger.error('Erreur lors de la récupération des suggestions GeoAdmin', { 
      error: error.message,
      query: req.query.q 
    });
    
    // En cas d'erreur, renvoyer des suggestions de base
    const fallbackSuggestions = [];
    const query = req.query.q.toLowerCase();
    
    // Communes valaisannes de base
    const communes = ['Sion', 'Martigny', 'Monthey', 'Sierre', 'Chamoson'];
    communes.forEach(commune => {
      if (commune.toLowerCase().includes(query)) {
        fallbackSuggestions.push(commune);
      }
    });
    
    res.json({ 
      suggestions: fallbackSuggestions.slice(0, parseInt(req.query.limit || 10)),
      query: req.query.q,
      count: fallbackSuggestions.length,
      fallback: true
    });
  }
});

// Route de santé pour vérifier la connexion à GeoAdmin
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(GEOADMIN_BASE_URL, {
      params: {
        searchText: 'Sion',
        type: 'locations',
        limit: 1
      },
      timeout: 3000
    });
    
    res.json({
      success: true,
      message: 'Service de suggestions GeoAdmin opérationnel',
      geoadmin_status: response.status === 200 ? 'connected' : 'error'
    });
  } catch (error) {
    res.json({
      success: false,
      message: 'Service de suggestions GeoAdmin - erreur de connexion',
      error: error.message
    });
  }
});

module.exports = router;