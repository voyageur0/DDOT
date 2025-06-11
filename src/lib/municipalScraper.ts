import axios from 'axios';
import * as cheerio from 'cheerio';

export interface MunicipalRegulation {
  commune: string;
  documentType: 'reglement_construction' | 'reglement_zones' | 'plan_amenagement' | 'autre';
  title: string;
  url: string;
  content?: string;
  lastUpdated?: string;
  relevantSections?: string[];
}

export interface ScrapingResult {
  commune: string;
  regulations: MunicipalRegulation[];
  scrapingSuccess: boolean;
  errorMessage?: string;
}

/**
 * URLs de base connues pour les règlements communaux valaisans
 */
const MUNICIPAL_SITES: Record<string, { base: string; patterns: string[] }> = {
  'Martigny': {
    base: 'https://www.martigny.ch',
    patterns: ['/administration/reglement', '/construction', '/amenagement']
  },
  'Sion': {
    base: 'https://www.sion.ch',
    patterns: ['/administration/reglements', '/urbanisme', '/construction']
  },
  'Riddes': {
    base: 'https://www.riddes.ch',
    patterns: ['/administration', '/construction', '/reglement']
  },
  'Monthey': {
    base: 'https://www.monthey.ch',
    patterns: ['/administration/reglements', '/construction']
  },
  'Brig-Glis': {
    base: 'https://www.brig-glis.ch',
    patterns: ['/verwaltung/reglemente', '/bauen']
  }
};

/**
 * Scrappe les règlements communaux pour une commune donnée
 */
export async function scrapeCommune(communeName: string): Promise<ScrapingResult> {
  console.log(`🔍 Scraping règlements pour ${communeName}`);
  
  try {
    const siteConfig = MUNICIPAL_SITES[communeName];
    if (!siteConfig) {
      return await tryGenericScraping(communeName);
    }
    
    const regulations: MunicipalRegulation[] = [];
    
    // Scraper les pages connues
    for (const pattern of siteConfig.patterns) {
      try {
        const pageRegulations = await scrapePage(siteConfig.base + pattern, communeName);
        regulations.push(...pageRegulations);
      } catch (error) {
        console.log(`⚠️ Page ${pattern} non accessible`);
      }
    }
    
    // Recherche supplémentaire sur la page principale
    try {
      const mainPageRegulations = await scrapeMainPage(siteConfig.base, communeName);
      regulations.push(...mainPageRegulations);
    } catch (error) {
      console.log(`⚠️ Page principale non accessible`);
    }
    
    console.log(`✅ Scraping ${communeName}: ${regulations.length} document(s) trouvé(s)`);
    
    return {
      commune: communeName,
      regulations: removeDuplicates(regulations),
      scrapingSuccess: regulations.length > 0
    };
    
  } catch (error) {
    console.error(`❌ Erreur scraping ${communeName}:`, error);
    return {
      commune: communeName,
      regulations: [],
      scrapingSuccess: false,
      errorMessage: `Erreur lors du scraping: ${error}`
    };
  }
}

/**
 * Tente un scraping générique pour les communes non configurées
 */
async function tryGenericScraping(communeName: string): Promise<ScrapingResult> {
  console.log(`🔍 Tentative scraping générique pour ${communeName}`);
  
  const possibleUrls = [
    `https://www.${communeName.toLowerCase()}.ch`,
    `https://www.${communeName.toLowerCase()}.vs.ch`,
    `https://${communeName.toLowerCase()}.ch`
  ];
  
  for (const baseUrl of possibleUrls) {
    try {
      const mainPageRegulations = await scrapeMainPage(baseUrl, communeName);
      if (mainPageRegulations.length > 0) {
        return {
          commune: communeName,
          regulations: mainPageRegulations,
          scrapingSuccess: true
        };
      }
    } catch (error) {
      console.log(`⚠️ URL ${baseUrl} non accessible`);
    }
  }
  
  return {
    commune: communeName,
    regulations: [],
    scrapingSuccess: false,
    errorMessage: 'Aucun site communal accessible trouvé'
  };
}

/**
 * Scrappe une page spécifique à la recherche de règlements
 */
async function scrapePage(url: string, communeName: string): Promise<MunicipalRegulation[]> {
  try {
    console.log(`📄 Scraping page: ${url}`);
    
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DDOTBot/1.0; +cadastre-analysis)'
      }
    });
    
    const $ = cheerio.load(data);
    const regulations: MunicipalRegulation[] = [];
    
    // Rechercher les liens vers des PDFs de règlements
    $('a[href$=".pdf"], a[href*="reglement"], a[href*="construction"], a[href*="amenagement"]').each((_, element) => {
      const link = $(element);
      const href = link.attr('href');
      const text = link.text().trim();
      
      if (href && text && isRelevantDocument(text)) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, url).href;
        
        regulations.push({
          commune: communeName,
          documentType: classifyDocument(text),
          title: text,
          url: fullUrl,
          lastUpdated: extractDate($, element)
        });
      }
    });
    
    return regulations;
    
  } catch (error) {
    console.log(`⚠️ Erreur scraping ${url}:`, error);
    return [];
  }
}

/**
 * Scrappe la page principale à la recherche de liens vers les règlements
 */
async function scrapeMainPage(baseUrl: string, communeName: string): Promise<MunicipalRegulation[]> {
  try {
    console.log(`🏠 Scraping page principale: ${baseUrl}`);
    
    const { data } = await axios.get(baseUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DDOTBot/1.0; +cadastre-analysis)'
      }
    });
    
    const $ = cheerio.load(data);
    const regulations: MunicipalRegulation[] = [];
    
    // Rechercher les liens contenant des mots-clés pertinents
    const keywords = ['règlement', 'reglement', 'construction', 'aménagement', 'amenagement', 
                     'urbanisme', 'zone', 'plan', 'PDF'];
    
    for (const keyword of keywords) {
      $(`:contains("${keyword}"):not(script):not(style)`).find('a').each((_, element) => {
        const link = $(element);
        const href = link.attr('href');
        const text = link.text().trim();
        
        if (href && text && isRelevantDocument(text)) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
          
          regulations.push({
            commune: communeName,
            documentType: classifyDocument(text),
            title: text,
            url: fullUrl
          });
        }
      });
    }
    
    return removeDuplicates(regulations);
    
  } catch (error) {
    console.log(`⚠️ Erreur scraping page principale ${baseUrl}:`, error);
    return [];
  }
}

/**
 * Détermine si un document est pertinent pour l'analyse urbanistique
 */
function isRelevantDocument(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  const relevantKeywords = [
    'règlement', 'reglement', 'construction', 'bâtir', 'batir',
    'aménagement', 'amenagement', 'urbanisme', 'zone', 'plan',
    'cadastre', 'permis', 'autorisation'
  ];
  
  const irrelevantKeywords = [
    'budget', 'compte', 'procès-verbal', 'proces-verbal', 
    'séance', 'seance', 'assemblée', 'assemblee',
    'rapport', 'newsletter', 'actualité', 'actualite'
  ];
  
  // Doit contenir au moins un mot-clé pertinent
  const hasRelevant = relevantKeywords.some(keyword => lowerText.includes(keyword));
  
  // Ne doit pas contenir de mots-clés non pertinents
  const hasIrrelevant = irrelevantKeywords.some(keyword => lowerText.includes(keyword));
  
  return hasRelevant && !hasIrrelevant && text.length > 5;
}

/**
 * Classifie le type de document
 */
function classifyDocument(title: string): MunicipalRegulation['documentType'] {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('construction') || lowerTitle.includes('bâtir') || lowerTitle.includes('batir')) {
    return 'reglement_construction';
  } else if (lowerTitle.includes('zone') || lowerTitle.includes('aménagement') || lowerTitle.includes('amenagement')) {
    return 'reglement_zones';
  } else if (lowerTitle.includes('plan')) {
    return 'plan_amenagement';
  } else {
    return 'autre';
  }
}

/**
 * Extrait une date de dernière mise à jour si disponible
 */
function extractDate($: cheerio.CheerioAPI, element: any): string | undefined {
  // Rechercher des dates dans le contexte de l'élément
  const parent = $(element).parent();
  const text = parent.text();
  
  const dateMatch = text.match(/(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/);
  return dateMatch ? dateMatch[1] : undefined;
}

/**
 * Supprime les doublons de règlements
 */
function removeDuplicates(regulations: MunicipalRegulation[]): MunicipalRegulation[] {
  const seen = new Set<string>();
  return regulations.filter(reg => {
    const key = reg.url + '::' + reg.title;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Télécharge et extrait le contenu d'un règlement (si c'est un PDF ou HTML)
 */
export async function downloadRegulationContent(regulation: MunicipalRegulation): Promise<string> {
  try {
    console.log(`📥 Téléchargement règlement: ${regulation.title}`);
    
    const { data } = await axios.get(regulation.url, {
      responseType: regulation.url.endsWith('.pdf') ? 'arraybuffer' : 'text',
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DDOTBot/1.0; +cadastre-analysis)'
      }
    });
    
    if (regulation.url.endsWith('.pdf')) {
      // Pour les PDFs, on devra utiliser le module OCR
      return 'Contenu PDF - extraction nécessaire via OCR';
    } else {
      // Pour les pages HTML, extraire le texte
      const $ = cheerio.load(data);
      $('script, style, nav, header, footer').remove();
      const cleanText = $('body').text()
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`✅ Contenu extrait: ${cleanText.length} caractères`);
      return cleanText;
    }
    
  } catch (error) {
    console.error(`❌ Erreur téléchargement ${regulation.url}:`, error);
    return 'Erreur lors du téléchargement du contenu';
  }
} 