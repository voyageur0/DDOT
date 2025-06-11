import axios from 'axios';
import * as cheerio from 'cheerio';

interface ReglementCache {
  [communeId: string]: string;
}

const cache: ReglementCache = {};

/**
 * Télécharge le règlement communal (PDF) et renvoie le texte brut.
 */
export async function fetchCommuneReglement(communeId: string): Promise<string> {
  if (cache[communeId]) return cache[communeId];

  // Mock simple pour démo
  if (process.env.NODE_ENV !== 'production') {
    const mockReglement = `
RÈGLEMENT COMMUNAL DE CONSTRUCTION - Commune ${communeId}

Art. 15 - Zones résidentielles R2
- Indice d'utilisation du sol (IUS) : maximum 0.8
- Hauteur maximale des bâtiments : 12 mètres  
- Recul minimal depuis la limite de propriété : 5 mètres
- Taux d'occupation du sol : maximum 30%

Art. 25 - Dispositions particulières
- Toiture en pente obligatoire entre 25° et 45°
- Matériaux de façade : bois, pierre naturelle ou crépi
- Stationnement : 1 place par 100m² habitables

Art. 35 - Zones protégées
- Respect du caractère architectural traditionnel valaisan
- Autorisation spéciale requise pour modifications extérieures
    `;
    cache[communeId] = mockReglement;
    return mockReglement;
  }

  // 1. Trouver le lien PDF sur la page règlement communale via vs.ch
  const htmlUrl = `https://www.vs.ch/web/sipo/${communeId}-reglements`;
  const { data: html } = await axios.get<string>(htmlUrl, { responseType: 'text' });
  const $ = cheerio.load(html);
  const pdfLink = $('a[href$=".pdf"]').first().attr('href');
  if (!pdfLink) {
    throw new Error('PDF du règlement non trouvé.');
  }

  const { data: pdfBuffer } = await axios.get<ArrayBuffer>(pdfLink, {
    responseType: 'arraybuffer',
  });

  // Lazy import de pdf-parse (ESM dynamic)
  const { default: pdfParse } = await import('pdf-parse');
  // pdf-parse attend un Buffer Node
  const { text } = await pdfParse(Buffer.from(pdfBuffer));
  cache[communeId] = text;
  return text;
} 