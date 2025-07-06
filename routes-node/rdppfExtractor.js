const axios = require('axios');
const pdfParse = require('pdf-parse');
const { extractConstraintsFromLargeText } = require('./constraintExtractor');

/**
 * Télécharge le PDF RDPPF pour un EGRID et extrait les contraintes structurées.
 * @param {string} egrid
 * @returns {Promise<Array>} constraints
 */
async function fetchRDPPFConstraints(egrid) {
  const pdfUrl = `https://rdppfvs.geopol.ch/extract/pdf?EGRID=${egrid}&LANG=fr`;
  try {
    console.log(`📥 Téléchargement RDPPF PDF: ${pdfUrl}`);
    const resp = await axios.get(pdfUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const data = await pdfParse(resp.data);
    const text = data.text || '';
    console.log(`📄 RDPPF: ${text.length} caractères extraits`);

    // Extraire les contraintes via OpenAI (chunking intégré)
    const constraints = await extractConstraintsFromLargeText(text);

    // Marquer la source et sévérité par défaut
    const uiConstraints = constraints.map(c => ({
      title: c.theme || c.zone || c.type || 'RDPPF',
      description: c.rule || c.description || '',
      severity: 'high',
      source: 'RDPPF'
    }));

    return uiConstraints;
  } catch (err) {
    console.error('❌ RDPPF PDF extraction error:', err.message);
    return [];
  }
}

module.exports = { fetchRDPPFConstraints }; 