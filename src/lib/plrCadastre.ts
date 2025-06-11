import axios from 'axios';

export interface PLRRestriction {
  theme: string;
  subtheme?: string;
  typeCode: string;
  typeTxt: string;
  lawStatus: string;
  publishedFrom: string;
  responsibleOffice: string;
  documentUrl?: string;
  legalProvision?: string;
}

export interface PLRData {
  egrid: string;
  municipality: string;
  restrictions: PLRRestriction[];
  extractPdfUrl?: string;
  lastUpdate: string;
}

const PLR_API_BASE = 'https://api3.geo.admin.ch/plr/v2';

/**
 * Récupère toutes les restrictions PLR pour une parcelle
 */
export async function getPLRRestrictions(egrid: string): Promise<PLRData | null> {
  try {
    console.log(`📋 Récupération PLR pour EGRID: ${egrid}`);
    
    if (!egrid || egrid.length < 10) {
      console.log('❌ EGRID invalide ou manquant');
      return null;
    }
    
    // Essayer plusieurs endpoints PLR
    const plrEndpoints = [
      `${PLR_API_BASE}/parcels/${egrid}`,
      `https://www.cadastre.ch/plr/parcels/${egrid}`,
      `https://api3.geo.admin.ch/plr/oereb/extract/reduced/json/geometry/${egrid}`
    ];
    
    for (const endpoint of plrEndpoints) {
      try {
        const { data } = await axios.get(endpoint, {
          params: {
            lang: 'fr',
            format: 'json',
            withimages: 'false'
          },
          timeout: 12000
        });

        if (data && (data.restrictions || data.GetExtractByIdResponse)) {
          console.log(`✅ Données PLR trouvées via ${endpoint}`);
          
          const restrictions: PLRRestriction[] = [];
          
          // Format API standard
          if (data.restrictions) {
            for (const theme of data.restrictions) {
              if (theme.restrictionRecords) {
                for (const record of theme.restrictionRecords) {
                  restrictions.push({
                    theme: theme.theme || 'Non spécifié',
                    subtheme: record.subtheme,
                    typeCode: record.typeCode || '',
                    typeTxt: record.typeTxt || '',
                    lawStatus: record.lawStatus || 'Inconnu',
                    publishedFrom: record.publishedFrom || '',
                    responsibleOffice: record.responsibleOffice?.name || 'Non spécifié',
                    documentUrl: record.legalProvisions?.[0]?.documentUrl,
                    legalProvision: record.legalProvisions?.[0]?.title
                  });
                }
              }
            }
          }
          
          // Format OEREB
          const oerebData = data.GetExtractByIdResponse?.extract;
          if (oerebData?.RealEstate?.RestrictionOnLandownership) {
            for (const restriction of oerebData.RealEstate.RestrictionOnLandownership) {
              restrictions.push({
                theme: restriction.Theme?.Text?.fr || restriction.Theme?.Code || 'Non spécifié',
                typeCode: restriction.TypeCode || '',
                typeTxt: restriction.TypeCodelist || restriction.Information?.Text?.fr || '',
                lawStatus: restriction.LawStatus?.Text?.fr || 'Inconnu',
                publishedFrom: restriction.PublishedFrom || '',
                responsibleOffice: restriction.ResponsibleOffice?.Name?.fr || 'Non spécifié',
                legalProvision: restriction.LegalProvisions?.[0]?.Title?.Text?.fr
              });
            }
          }

          console.log(`✅ ${restrictions.length} restrictions PLR trouvées`);

          return {
            egrid,
            municipality: data.municipality || oerebData?.RealEstate?.Municipality || '',
            restrictions,
            extractPdfUrl: data.extractUrl || oerebData?.ExtractIdentifier,
            lastUpdate: new Date().toISOString()
          };
        }
      } catch (endpointError) {
        console.log(`⚠️ Endpoint PLR ${endpoint} indisponible`);
        continue;
      }
    }
    
    console.log('❌ Aucune donnée PLR trouvée sur tous les endpoints');
    return null;

  } catch (error) {
    console.error('❌ Erreur récupération PLR:', error);
    return null;
  }
}

/**
 * Télécharge et récupère le contenu d'un PDF PLR
 */
export async function downloadPLRExtract(extractUrl: string): Promise<Buffer | null> {
  try {
    console.log(`📥 Téléchargement extrait PLR: ${extractUrl}`);
    
    const { data } = await axios.get(extractUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    console.log(`✅ Extrait PLR téléchargé (${data.byteLength} bytes)`);
    return Buffer.from(data);

  } catch (error) {
    console.error('❌ Erreur téléchargement PLR:', error);
    return null;
  }
}

/**
 * Récupère les informations sur les zones de construction
 */
export async function getBuildingZoneInfo(x: number, y: number): Promise<Record<string, any>> {
  try {
    console.log(`🏗️ Récupération infos zone de construction (${x}, ${y})`);
    
    const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/ech/MapServer/identify', {
      params: {
        geometry: `${x},${y}`,
        geometryFormat: 'geojson',
        geometryType: 'esriGeometryPoint',
        layers: 'all:ch.are.bauzonen',
        tolerance: 0,
        mapExtent: `${x-50},${y-50},${x+50},${y+50}`,
        imageDisplay: '100,100,96',
        lang: 'fr'
      },
      timeout: 10000
    });

    if (data?.results?.length) {
      const zone = data.results[0].attributes;
      console.log(`✅ Zone de construction: ${zone.typ_kt || 'Non définie'}`);
      return zone;
    }

    return {};
  } catch (error) {
    console.error('❌ Erreur zone de construction:', error);
    return {};
  }
}

/**
 * Formate les restrictions PLR en texte lisible
 */
export function formatPLRForAnalysis(plrData: PLRData): string {
  if (!plrData || !plrData.restrictions.length) {
    return 'Aucune restriction PLR identifiée pour cette parcelle.';
  }

  let formatted = `### RESTRICTIONS PLR (${plrData.restrictions.length} restrictions)\n\n`;
  
  const groupedByTheme = plrData.restrictions.reduce((acc, restriction) => {
    if (!acc[restriction.theme]) acc[restriction.theme] = [];
    acc[restriction.theme].push(restriction);
    return acc;
  }, {} as Record<string, PLRRestriction[]>);

  for (const [theme, restrictions] of Object.entries(groupedByTheme)) {
    formatted += `**${theme}:**\n`;
    for (const restriction of restrictions) {
      formatted += `- ${restriction.typeTxt}`;
      if (restriction.lawStatus) formatted += ` (Statut: ${restriction.lawStatus})`;
      if (restriction.responsibleOffice) formatted += ` - ${restriction.responsibleOffice}`;
      formatted += '\n';
      if (restriction.legalProvision) {
        formatted += `  Base légale: ${restriction.legalProvision}\n`;
      }
    }
    formatted += '\n';
  }

  return formatted;
} 