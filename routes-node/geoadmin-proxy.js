const express = require('express');
const axios = require('axios');
const https = require('https');

const router = express.Router();

// Logger simplifié
const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn
};

// Route proxy pour GeoAdmin (résout les problèmes CORS)
router.get('/', async (req, res) => {
  try {
    const { searchText, type = 'locations', origins = 'parcel,address,gg25', limit = '8', sr = '4326' } = req.query;
    
    if (!searchText) {
      return res.status(400).json({ error: 'searchText parameter is required' });
    }

    logger.info('Proxy GeoAdmin search', { searchText, type, origins, limit });

    const response = await axios.get(`https://api3.geo.admin.ch/rest/services/api/SearchServer`, {
      params: {
        searchText,
        type,
        origins,
        limit,
        sr
      },
      timeout: 10000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: process.env.NODE_ENV === 'development' ? false : true
      })
    });

    res.json(response.data);
  } catch (error) {
    logger.error('Erreur proxy GeoAdmin', { error: error.message });
    res.status(500).json({ error: 'Erreur interne, réessayez plus tard.' });
  }
});

// Route proxy pour les détails de parcelle
router.get('/geoadmin-identify', async (req, res) => {
  try {
    const { geometry, geometryType = 'esriGeometryPoint', layers = 'all', sr = '2056' } = req.query;
    
    if (!geometry) {
      return res.status(400).json({ error: 'geometry parameter is required' });
    }

    logger.info('Proxy GeoAdmin identify', { geometry, geometryType, layers });

    const response = await axios.get(`https://api3.geo.admin.ch/rest/services/api/MapServer/identify`, {
      params: {
        geometry,
        geometryType,
        layers,
        sr
      },
      timeout: 7000, // Réduit pour améliorer la réactivité
      httpsAgent: new https.Agent({
        rejectUnauthorized: process.env.NODE_ENV === 'development' ? false : true
      })
    });

    res.json(response.data);
  } catch (error) {
    logger.error('Erreur proxy GeoAdmin identify', { 
      error: error.message,
      geometry: req.query.geometry,
      timeout: error.code === 'ECONNABORTED'
    });
    
    if (error.code === 'ECONNABORTED') {
      res.status(408).json({ error: 'Délai d\'attente dépassé. Veuillez réessayer.' });
    } else if (error.response) {
      res.status(error.response.status).json({ error: 'Erreur du service d\'identification' });
    } else {
      res.status(500).json({ error: 'Erreur interne, réessayez plus tard.' });
    }
  }
});

module.exports = router;