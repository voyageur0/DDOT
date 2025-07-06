const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const { extractConstraintsFromLargeText } = require('./constraintExtractor');

const mappingPath = path.join(__dirname, '../public/regulations-vs.json');
let mapping = {};
if (fs.existsSync(mappingPath)) {
  try {
    mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
  } catch (e) {
    console.error('❌ Impossible de lire regulations-vs.json');
  }
}

const cacheDir = path.join(__dirname, '../uploads/reg_cache');
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

async function downloadPdf(url, commune) {
  const dest = path.join(cacheDir, `${commune}.pdf`);
  if (fs.existsSync(dest)) return fs.readFileSync(dest);
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
  fs.writeFileSync(dest, resp.data);
  return resp.data;
}

async function fetchRegulationText(commune) {
  const url = mapping[commune];
  if (!url) return null;
  try {
    console.log(`📥 Téléchargement règlement ${commune}`);
    const pdfBuffer = await downloadPdf(url, commune);
    const data = await pdfParse(pdfBuffer);
    return data.text || null;
  } catch (err) {
    console.error('⚠️ fetchRegulationText error:', err.message);
    return null;
  }
}

async function fetchRegulationConstraints(commune) {
  const text = await fetchRegulationText(commune);
  if (!text) return [];
  return extractConstraintsFromLargeText(text);
}

module.exports = { fetchRegulationText, fetchRegulationConstraints }; 