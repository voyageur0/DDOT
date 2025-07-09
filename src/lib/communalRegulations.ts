import axios from 'axios';
// @ts-ignore: type definitions optionally installed via @types/cheerio
import * as cheerio from 'cheerio';
import { extractRegulationConstraints, RegulationConstraint, extractConstraintsFromLargeText } from './regulationExtractor';

export interface CommunalRegulation {
  municipality: string;
  documentType: 'règlement' | 'plan_zones' | 'prescriptions';
  title: string;
  url: string;
  lastUpdate?: string;
  textContent?: string;
  relevantSections?: string[];
  structuredConstraints?: RegulationConstraint[];
}

const VALAIS_MUNICIPALITIES = [
  'riddes', 'martigny', 'sion', 'sierre', 'monthey', 'chamoson', 'saxon',
  'fully', 'leytron', 'saillon', 'bagnes', 'orsières', 'sembrancher',
  'bourg-saint-pierre', 'liddes', 'champex', 'verbier'
];

/**
 * Recherche les règlements d'urbanisme d'une commune
 */
export async function findCommunalRegulations(municipality: string): Promise<CommunalRegulation[]> {
  console.log(`🏛️ Recherche règlements pour: ${municipality}`);
  
  const regulations: CommunalRegulation[] = [];
  const municipalityClean = municipality.toLowerCase().trim();
  
  try {
    // 1. Recherche sur le site officiel de la commune
    const communalDocs = await searchCommunalWebsite(municipalityClean);
    regulations.push(...communalDocs);
    
    // 2. Recherche sur les portails cantonaux du Valais
    const cantonalDocs = await searchCantonalPortals(municipalityClean);
    regulations.push(...cantonalDocs);
    
    // 3. Recherche sur les plateformes de géodonnées
    const geoDocs = await searchGeoDataPortals(municipalityClean);
    regulations.push(...geoDocs);
    
    console.log(`✅ ${regulations.length} documents de règlementation trouvés pour ${municipality}`);
    return regulations;
    
  } catch (error) {
    console.error('❌ Erreur recherche règlements communaux:', error);
    return [];
  }
}

/**
 * Recherche sur le site web officiel de la commune
 */
async function searchCommunalWebsite(municipality: string): Promise<CommunalRegulation[]> {
  const regulations: CommunalRegulation[] = [];
  
  // URLs communes potentielles
  const baseUrls = [
    `https://www.${municipality}.ch`,
    `https://${municipality}.ch`,
    `https://www.commune-${municipality}.ch`,
    `https://${municipality}.vs.ch`
  ];
  
  for (const baseUrl of baseUrls) {
    try {
      console.log(`🌐 Recherche sur: ${baseUrl}`);
      
      const { data } = await axios.get(baseUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DDOT-Bot/1.0; +https://ddot.ch/bot)'
        }
      });
      
      const $ = cheerio.load(data);
      
      // Rechercher les liens vers des règlements
      const keywords = [
        'règlement', 'construction', 'urbanisme', 'plan de zones',
        'aménagement', 'prescriptions', 'gabarit', 'zone'
      ];
      
      $('a[href]').each((_idx: number, element: any) => {
        const link = $(element);
        const href = link.attr('href');
        const text = link.text().toLowerCase();
        
        if (href && keywords.some(keyword => text.includes(keyword))) {
          let fullUrl = href;
          if (href.startsWith('/')) {
            fullUrl = baseUrl + href;
          } else if (!href.startsWith('http')) {
            fullUrl = baseUrl + '/' + href;
          }
          
          if (fullUrl.endsWith('.pdf')) {
            regulations.push({
              municipality,
              documentType: determineDocumentType(text),
              title: link.text().trim(),
              url: fullUrl
            });
          }
        }
      });
      
      // Si on trouve des documents, on s'arrête
      if (regulations.length > 0) {
        console.log(`✅ ${regulations.length} documents trouvés sur ${baseUrl}`);
        break;
      }
      
    } catch (error) {
      console.log(`⚠️ ${baseUrl} non accessible`);
    }
  }
  
  return regulations;
}

/**
 * Recherche sur les portails cantonaux du Valais
 */
async function searchCantonalPortals(municipality: string): Promise<CommunalRegulation[]> {
  const regulations: CommunalRegulation[] = [];
  
  const cantonalUrls = [
    `https://www.vs.ch/web/sazd/amenagement-du-territoire`,
    `https://geoservices.vs.ch`,
    `https://map.geo.vs.ch`
  ];
  
  // Cette recherche est plus complexe et nécessiterait une API spécialisée
  // Pour l'instant, on retourne un placeholder
  console.log(`🏔️ Recherche portails cantonaux pour ${municipality} - En développement`);
  
  return regulations;
}

/**
 * Recherche sur les plateformes de géodonnées
 */
async function searchGeoDataPortals(municipality: string): Promise<CommunalRegulation[]> {
  const regulations: CommunalRegulation[] = [];
  
  try {
    // Recherche sur opendata.swiss
    const { data } = await axios.get('https://opendata.swiss/api/3/action/package_search', {
      params: {
        q: `${municipality} urbanisme OR ${municipality} règlement OR ${municipality} construction`,
        rows: 10
      },
      timeout: 10000
    });
    
    if (data?.result?.results) {
      for (const dataset of data.result.results) {
        if (dataset.resources) {
          for (const resource of dataset.resources) {
            if (resource.url && resource.format === 'PDF') {
              regulations.push({
                municipality,
                documentType: determineDocumentType(resource.name || dataset.title),
                title: resource.name || dataset.title,
                url: resource.url,
                lastUpdate: resource.last_modified
              });
            }
          }
        }
      }
    }
    
    console.log(`📊 ${regulations.length} documents trouvés sur opendata.swiss`);
    
  } catch (error) {
    console.log('⚠️ Recherche opendata.swiss échouée');
  }
  
  return regulations;
}

/**
 * Détermine le type de document à partir du titre
 */
function determineDocumentType(title: string): 'règlement' | 'plan_zones' | 'prescriptions' {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('plan') && titleLower.includes('zone')) {
    return 'plan_zones';
  } else if (titleLower.includes('prescription')) {
    return 'prescriptions';
  } else {
    return 'règlement';
  }
}

/**
 * Extrait et analyse le contenu d'un règlement communal
 */
export async function analyzeCommunalRegulation(regulation: CommunalRegulation, targetZone?: string): Promise<CommunalRegulation> {
  console.log(`📖 Analyse du règlement: ${regulation.title} (Fonctionnalité désactivée - utiliser les PDFs locaux)`);
  
  // Fonctionnalité d'extraction web désactivée car tous les règlements sont maintenant locaux
  // et analysés directement par parcelAnalysisOrchestrator
  console.log('⚠️ Extraction web désactivée - utiliser les règlements locaux dans le dossier reglements/');
  
  return regulation;
}

/**
 * Formate les règlements pour l'analyse OpenAI
 */
export function formatRegulationsForAnalysis(regulations: CommunalRegulation[]): string {
  if (!regulations.length) {
    return 'Aucun règlement communal disponible pour cette analyse.';
  }
  
  let formatted = `### RÈGLEMENTS COMMUNAUX (${regulations.length} documents)\n\n`;
  
  for (const regulation of regulations) {
    formatted += `#### ${regulation.title}\n`;
    formatted += `**Type:** ${regulation.documentType}\n`;
    formatted += `**Source:** ${regulation.url}\n`;
    
    if (regulation.lastUpdate) {
      formatted += `**Dernière mise à jour:** ${regulation.lastUpdate}\n`;
    }
    
    if (regulation.relevantSections?.length) {
      formatted += `\n**Extraits pertinents:**\n`;
      for (const section of regulation.relevantSections) {
        formatted += `${section}\n\n`;
      }
    } else if (regulation.textContent?.length && regulation.textContent.length > 200) {
      // Si pas de sections spécifiques, prendre un extrait du début
      const excerpt = regulation.textContent.substring(0, 500) + '...';
      formatted += `\n**Extrait:**\n${excerpt}\n\n`;
    }
    
    formatted += '---\n\n';
  }
  
  return formatted;
}

/**
 * Recherche spécifique de règles pour une zone donnée
 */
export async function searchZoneSpecificRules(municipality: string, zone: string): Promise<string> {
  console.log(`🎯 Recherche règles spécifiques pour zone ${zone} à ${municipality}`);
  
  const regulations = await findCommunalRegulations(municipality);
  
  let zoneRules = '';
  
  for (const regulation of regulations) {
    const analyzedRegulation = await analyzeCommunalRegulation(regulation, zone);
    
    if (analyzedRegulation.relevantSections?.length) {
      zoneRules += `### ${analyzedRegulation.title}\n`;
      zoneRules += analyzedRegulation.relevantSections.join('\n\n');
      zoneRules += '\n\n---\n\n';
    }
  }
  
  return zoneRules || `Aucune règle spécifique trouvée pour la zone "${zone}" à ${municipality}.`;
} 