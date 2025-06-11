/**
 * Mapping complet des communes du canton du Valais par district
 * Source: https://www.vs.ch/web/communes/commune
 * Mis à jour: Juin 2025
 */

export interface CommuneInfo {
  name: string;
  district: string;
  germanName?: string;
  searchKeywords?: string[];
}

export const VALAIS_DISTRICTS = {
  'CONCHES': 'District de Conches',
  'RAROGNE_ORIENTAL': 'Demi-district de Rarogne oriental', 
  'RAROGNE_OCCIDENTAL': 'Demi-district de Rarogne occidental',
  'BRIGUE': 'District de Brigue',
  'VIEGE': 'District de Viège',
  'LOECHE': 'District de Loèche',
  'SIERRE': 'District de Sierre',
  'SION': 'District de Sion',
  'HERENS': 'District d\'Hérens',
  'CONTHEY': 'District de Conthey',
  'MARTIGNY': 'District de Martigny',
  'ENTREMONT': 'District d\'Entremont',
  'ST_MAURICE': 'District de St-Maurice',
  'MONTHEY': 'District de Monthey'
} as const;

export const COMMUNES_VALAIS: Record<string, CommuneInfo[]> = {
  // District de Conches (dt. Goms)
  'CONCHES': [
    { name: 'Bellwald', district: 'Conches' },
    { name: 'Binn', district: 'Conches' },
    { name: 'Ernen', district: 'Conches' },
    { name: 'Fiesch', district: 'Conches' },
    { name: 'Fieschertal', district: 'Conches' },
    { name: 'Goms', district: 'Conches' },
    { name: 'Lax', district: 'Conches' },
    { name: 'Obergoms', district: 'Conches' }
  ],

  // Demi-district de Rarogne oriental (dt. Östlich Raron)
  'RAROGNE_ORIENTAL': [
    { name: 'Bettmeralp', district: 'Rarogne oriental' },
    { name: 'Bister', district: 'Rarogne oriental' },
    { name: 'Bitsch', district: 'Rarogne oriental' },
    { name: 'Grengiols', district: 'Rarogne oriental' },
    { name: 'Mörel-Filet', district: 'Rarogne oriental' },
    { name: 'Riederalp', district: 'Rarogne oriental' }
  ],

  // Demi-district de Rarogne occidental (dt. Westlich Raron)
  'RAROGNE_OCCIDENTAL': [
    { name: 'Ausserberg', district: 'Rarogne occidental' },
    { name: 'Blatten', district: 'Rarogne occidental' },
    { name: 'Bürchen', district: 'Rarogne occidental' },
    { name: 'Eischoll', district: 'Rarogne occidental' },
    { name: 'Ferden', district: 'Rarogne occidental' },
    { name: 'Kippel', district: 'Rarogne occidental' },
    { name: 'Niedergesteln', district: 'Rarogne occidental' },
    { name: 'Rarogne', district: 'Rarogne occidental' },
    { name: 'Steg-Hohtenn', district: 'Rarogne occidental' },
    { name: 'Unterbäch', district: 'Rarogne occidental' },
    { name: 'Wiler', district: 'Rarogne occidental' }
  ],

  // District de Brigue (dt. Brig)
  'BRIGUE': [
    { name: 'Brig-Glis', district: 'Brigue', germanName: 'Brig-Glis', searchKeywords: ['Brigue', 'Brig', 'Glis'] },
    { name: 'Eggerberg', district: 'Brigue' },
    { name: 'Naters', district: 'Brigue' },
    { name: 'Ried-Brig', district: 'Brigue' },
    { name: 'Simplon', district: 'Brigue' },
    { name: 'Termen', district: 'Brigue' },
    { name: 'Zwischbergen', district: 'Brigue' }
  ],

  // District de Viège (dt. Visp)
  'VIEGE': [
    { name: 'Baltschieder', district: 'Viège' },
    { name: 'Eisten', district: 'Viège' },
    { name: 'Embd', district: 'Viège' },
    { name: 'Grächen', district: 'Viège' },
    { name: 'Lalden', district: 'Viège' },
    { name: 'Randa', district: 'Viège' },
    { name: 'Saas-Almagell', district: 'Viège' },
    { name: 'Saas-Balen', district: 'Viège' },
    { name: 'Saas-Fee', district: 'Viège' },
    { name: 'Saas-Grund', district: 'Viège' },
    { name: 'St. Niklaus', district: 'Viège', searchKeywords: ['Saint-Nicolas', 'St-Nicolas'] },
    { name: 'Stalden', district: 'Viège' },
    { name: 'Staldenried', district: 'Viège' },
    { name: 'Täsch', district: 'Viège' },
    { name: 'Törbel', district: 'Viège' },
    { name: 'Viège', district: 'Viège', germanName: 'Visp' },
    { name: 'Visperterminen', district: 'Viège' },
    { name: 'Zeneggen', district: 'Viège' },
    { name: 'Zermatt', district: 'Viège' }
  ],

  // District de Loèche (dt. Leuk)
  'LOECHE': [
    { name: 'Agarn', district: 'Loèche' },
    { name: 'Albinen', district: 'Loèche' },
    { name: 'Ergisch', district: 'Loèche' },
    { name: 'Gampel-Bratsch', district: 'Loèche' },
    { name: 'Guttet-Feschel', district: 'Loèche' },
    { name: 'Inden', district: 'Loèche' },
    { name: 'Loèche', district: 'Loèche', germanName: 'Leuk' },
    { name: 'Loèche-les-Bains', district: 'Loèche', germanName: 'Leukerbad' },
    { name: 'Oberems', district: 'Loèche' },
    { name: 'Salquenen', district: 'Loèche' },
    { name: 'Turtmann-Unterems', district: 'Loèche' },
    { name: 'Varen', district: 'Loèche' }
  ],

  // District de Sierre (dt. Siders)
  'SIERRE': [
    { name: 'Anniviers', district: 'Sierre' },
    { name: 'Chalais', district: 'Sierre' },
    { name: 'Chippis', district: 'Sierre' },
    { name: 'Crans-Montana', district: 'Sierre' },
    { name: 'Grône', district: 'Sierre' },
    { name: 'Icogne', district: 'Sierre' },
    { name: 'Lens', district: 'Sierre' },
    { name: 'Noble-Contrée', district: 'Sierre' },
    { name: 'Sierre', district: 'Sierre', germanName: 'Siders' },
    { name: 'St-Léonard', district: 'Sierre', searchKeywords: ['Saint-Léonard'] }
  ],

  // District de Sion (dt. Sitten)
  'SION': [
    { name: 'Arbaz', district: 'Sion' },
    { name: 'Grimisuat', district: 'Sion' },
    { name: 'Savièse', district: 'Sion' },
    { name: 'Sion', district: 'Sion', germanName: 'Sitten' },
    { name: 'Veysonnaz', district: 'Sion' }
  ],

  // District d'Hérens (dt. Ering)
  'HERENS': [
    { name: 'Ayent', district: 'Hérens' },
    { name: 'Evolène', district: 'Hérens' },
    { name: 'Hérémence', district: 'Hérens' },
    { name: 'Mont-Noble', district: 'Hérens' },
    { name: 'St-Martin', district: 'Hérens', searchKeywords: ['Saint-Martin'] },
    { name: 'Vex', district: 'Hérens' }
  ],

  // District de Conthey (dt. Gundis)
  'CONTHEY': [
    { name: 'Ardon', district: 'Conthey' },
    { name: 'Chamoson', district: 'Conthey' },
    { name: 'Conthey', district: 'Conthey' },
    { name: 'Nendaz', district: 'Conthey' },
    { name: 'Vétroz', district: 'Conthey' }
  ],

  // District de Martigny (dt. Martinach)
  'MARTIGNY': [
    { name: 'Bovernier', district: 'Martigny' },
    { name: 'Fully', district: 'Martigny' },
    { name: 'Isérables', district: 'Martigny' },
    { name: 'Leytron', district: 'Martigny' },
    { name: 'Martigny', district: 'Martigny', germanName: 'Martinach' },
    { name: 'Martigny-Combe', district: 'Martigny' },
    { name: 'Riddes', district: 'Martigny' },
    { name: 'Saillon', district: 'Martigny' },
    { name: 'Saxon', district: 'Martigny' },
    { name: 'Trient', district: 'Martigny' }
  ],

  // District d'Entremont
  'ENTREMONT': [
    { name: 'Bourg-St-Pierre', district: 'Entremont', searchKeywords: ['Bourg-Saint-Pierre'] },
    { name: 'Liddes', district: 'Entremont' },
    { name: 'Orsières', district: 'Entremont' },
    { name: 'Sembrancher', district: 'Entremont' },
    { name: 'Val de Bagnes', district: 'Entremont', searchKeywords: ['Bagnes', 'Verbier', 'Le Châble'] }
  ],

  // District de St-Maurice
  'ST_MAURICE': [
    { name: 'Collonges', district: 'St-Maurice' },
    { name: 'Dorénaz', district: 'St-Maurice' },
    { name: 'Evionnaz', district: 'St-Maurice' },
    { name: 'Finhaut', district: 'St-Maurice' },
    { name: 'Massongex', district: 'St-Maurice' },
    { name: 'Salvan', district: 'St-Maurice' },
    { name: 'St-Maurice', district: 'St-Maurice', searchKeywords: ['Saint-Maurice'] },
    { name: 'Vernayaz', district: 'St-Maurice' },
    { name: 'Vérossaz', district: 'St-Maurice' }
  ],

  // District de Monthey
  'MONTHEY': [
    { name: 'Champéry', district: 'Monthey' },
    { name: 'Collombey-Muraz', district: 'Monthey' },
    { name: 'Monthey', district: 'Monthey' },
    { name: 'Port-Valais', district: 'Monthey' },
    { name: 'St-Gingolph', district: 'Monthey', searchKeywords: ['Saint-Gingolph'] },
    { name: 'Troistorrents', district: 'Monthey' },
    { name: 'Val-d\'Illiez', district: 'Monthey', searchKeywords: ['Val d\'Illiez', 'Champoussin'] },
    { name: 'Vionnaz', district: 'Monthey' },
    { name: 'Vouvry', district: 'Monthey' }
  ]
};

/**
 * Obtient toutes les communes du Valais sous forme de liste plate
 */
export function getAllCommunes(): CommuneInfo[] {
  return Object.values(COMMUNES_VALAIS).flat();
}

/**
 * Recherche une commune par nom (insensible à la casse)
 */
export function findCommune(searchText: string): CommuneInfo | null {
  const normalized = searchText.toLowerCase().trim();
  const allCommunes = getAllCommunes();
  
  // Recherche exacte par nom
  let found = allCommunes.find(c => c.name.toLowerCase() === normalized);
  if (found) return found;
  
  // Recherche par nom allemand
  found = allCommunes.find(c => c.germanName?.toLowerCase() === normalized);
  if (found) return found;
  
  // Recherche par mots-clés
  found = allCommunes.find(c => 
    c.searchKeywords?.some(keyword => keyword.toLowerCase() === normalized)
  );
  if (found) return found;
  
  // Recherche partielle
  found = allCommunes.find(c => 
    c.name.toLowerCase().includes(normalized) ||
    c.germanName?.toLowerCase().includes(normalized) ||
    c.searchKeywords?.some(keyword => keyword.toLowerCase().includes(normalized))
  );
  
  return found || null;
}

/**
 * Obtient les communes d'un district
 */
export function getCommunesByDistrict(district: keyof typeof COMMUNES_VALAIS): CommuneInfo[] {
  return COMMUNES_VALAIS[district] || [];
}

/**
 * Normalise le nom d'une commune pour la recherche
 */
export function normalizeCommune(commune: string): string {
  const found = findCommune(commune);
  return found ? found.name : commune;
} 