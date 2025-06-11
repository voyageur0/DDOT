import axios from 'axios';

export interface DangerZone {
  type: 'eau' | 'laves_torrentielles' | 'chutes_pierres' | 'glissements' | 'avalanches';
  level: 'rouge' | 'bleu' | 'jaune_residuel' | 'jaune_indicatif';
  description: string;
  intensity?: string;
  probability?: string;
  surface?: number;
}

export interface DangerData {
  coordinates: { x: number; y: number };
  dangers: DangerZone[];
  summary: string;
  hasSignificantRisk: boolean;
}

const GEO_ADMIN_WMS = 'https://wms.geo.admin.ch';
const IDENTIFY_ENDPOINT = 'https://api3.geo.admin.ch/rest/services/ech/MapServer/identify';

/**
 * Couches des cartes de dangers du Valais
 */
const DANGER_LAYERS = {
  eau: 'ch.bafu.gefahren-wasser',
  laves: 'ch.bafu.gefahren-ruefe',
  pierres: 'ch.bafu.gefahren-sturz',
  glissements: 'ch.bafu.gefahren-rutschung',
  avalanches: 'ch.slf.lawinengefahrenkarten'
};

/**
 * Interroge les cartes de dangers pour des coordonnées données
 */
export async function getDangerData(x: number, y: number): Promise<DangerData> {
  console.log(`⚠️ Analyse dangers naturels (${x}, ${y})`);
  
  const dangers: DangerZone[] = [];
  
  try {
    // Interroger chaque couche de danger
    for (const [dangerType, layerCode] of Object.entries(DANGER_LAYERS)) {
      try {
        const dangerInfo = await queryDangerLayer(x, y, layerCode, dangerType as any);
        if (dangerInfo) {
          dangers.push(dangerInfo);
        }
      } catch (layerError) {
        console.log(`⚠️ Couche ${dangerType} non disponible`);
      }
    }
    
    const hasSignificantRisk = dangers.some(d => d.level === 'rouge' || d.level === 'bleu');
    const summary = generateDangerSummary(dangers);
    
    console.log(`✅ Analyse dangers: ${dangers.length} zone(s) identifiée(s)`);
    
    return {
      coordinates: { x, y },
      dangers,
      summary,
      hasSignificantRisk
    };
    
  } catch (error) {
    console.error('❌ Erreur analyse dangers:', error);
    return {
      coordinates: { x, y },
      dangers: [],
      summary: 'Erreur lors de l\'analyse des dangers naturels',
      hasSignificantRisk: false
    };
  }
}

/**
 * Interroge une couche de danger spécifique
 */
async function queryDangerLayer(x: number, y: number, layerCode: string, dangerType: DangerZone['type']): Promise<DangerZone | null> {
  try {
    const { data } = await axios.get(IDENTIFY_ENDPOINT, {
      params: {
        geometry: `${x},${y}`,
        geometryFormat: 'geojson',
        geometryType: 'esriGeometryPoint',
        layers: `all:${layerCode}`,
        tolerance: 5,
        mapExtent: `${x-100},${y-100},${x+100},${y+100}`,
        imageDisplay: '100,100,96',
        lang: 'fr'
      },
      timeout: 8000
    });

    if (!data?.results?.length) {
      return null;
    }

    const feature = data.results[0];
    const attrs = feature.attributes || {};
    
    // Interpréter les attributs selon le type de danger
    const zone = interpretDangerAttributes(attrs, dangerType);
    
    if (zone) {
      console.log(`⚠️ Danger ${dangerType} identifié: niveau ${zone.level}`);
    }
    
    return zone;
    
  } catch (error) {
    console.log(`⚠️ Erreur couche ${dangerType}:`, error);
    return null;
  }
}

/**
 * Interprète les attributs d'une zone de danger
 */
function interpretDangerAttributes(attrs: any, dangerType: DangerZone['type']): DangerZone | null {
  // Mapping basé sur les standards suisses de cartographie des dangers
  let level: DangerZone['level'] | null = null;
  let description = '';
  let intensity = '';
  let probability = '';
  
  // Couleurs standards: rouge = danger élevé, bleu = danger moyen, jaune = danger faible/résiduel
  if (attrs.farbe || attrs.color || attrs.couleur) {
    const color = (attrs.farbe || attrs.color || attrs.couleur).toLowerCase();
    
    if (color.includes('rot') || color.includes('rouge') || color.includes('red')) {
      level = 'rouge';
      description = 'Zone de danger élevé - construction généralement interdite';
    } else if (color.includes('blau') || color.includes('bleu') || color.includes('blue')) {
      level = 'bleu';
      description = 'Zone de danger moyen - construction possible avec conditions';
    } else if (color.includes('gelb') || color.includes('jaune') || color.includes('yellow')) {
      if (attrs.typ === 'residuel' || attrs.type === 'résiduel') {
        level = 'jaune_residuel';
        description = 'Zone de danger résiduel - prescriptions d\'aménagement';
      } else {
        level = 'jaune_indicatif';
        description = 'Zone de danger indicatif - vigilance requise';
      }
    }
  }
  
  // Interpréter l'intensité et la probabilité si disponibles
  if (attrs.intensitat || attrs.intensite) {
    intensity = attrs.intensitat || attrs.intensite;
  }
  
  if (attrs.wahrscheinlichkeit || attrs.probabilite) {
    probability = attrs.wahrscheinlichkeit || attrs.probabilite;
  }
  
  // Descriptions spécifiques par type de danger
  if (level) {
    switch (dangerType) {
      case 'eau':
        description += ' - Risque d\'inondation';
        break;
      case 'laves_torrentielles':
        description += ' - Coulées de débris/laves torrentielles';
        break;
      case 'chutes_pierres':
        description += ' - Chutes de pierres/éboulements';  
        break;
      case 'glissements':
        description += ' - Glissements de terrain';
        break;
      case 'avalanches':
        description += ' - Zone avalancheuse';
        break;
    }
  }
  
  if (!level) {
    return null;
  }
  
  return {
    type: dangerType,
    level,
    description,
    intensity: intensity || undefined,
    probability: probability || undefined,
    surface: parseFloat(attrs.flaeche || attrs.surface) || undefined
  };
}

/**
 * Génère un résumé des dangers identifiés
 */
function generateDangerSummary(dangers: DangerZone[]): string {
  if (!dangers.length) {
    return "Aucun danger naturel majeur identifié dans les cartes officielles.";
  }
  
  let summary = `### DANGERS NATURELS - ${dangers.length} zone(s) identifiée(s)\n\n`;
  
  const rouges = dangers.filter(d => d.level === 'rouge');
  const bleus = dangers.filter(d => d.level === 'bleu');
  const jaunes = dangers.filter(d => d.level.includes('jaune'));
  
  if (rouges.length) {
    summary += `🔴 **DANGER ÉLEVÉ (${rouges.length} zone(s))**\n`;
    rouges.forEach(d => {
      summary += `   • ${d.type.toUpperCase()}: ${d.description}\n`;
    });
    summary += '\n';
  }
  
  if (bleus.length) {
    summary += `🔵 **DANGER MOYEN (${bleus.length} zone(s))**\n`;
    bleus.forEach(d => {
      summary += `   • ${d.type.toUpperCase()}: ${d.description}\n`;
    });
    summary += '\n';
  }
  
  if (jaunes.length) {
    summary += `🟡 **DANGER FAIBLE/RÉSIDUEL (${jaunes.length} zone(s))**\n`;
    jaunes.forEach(d => {
      summary += `   • ${d.type.toUpperCase()}: ${d.description}\n`;
    });
    summary += '\n';
  }
  
  // Recommandations générales
  if (rouges.length || bleus.length) {
    summary += `**⚠️ RECOMMANDATIONS:**\n`;
    summary += `- Consultation obligatoire des autorités communales\n`;
    summary += `- Étude détaillée des dangers requise pour tout projet\n`;
    summary += `- Mesures de protection éventuellement nécessaires\n`;
    summary += `- Vérification des assurances adaptées\n\n`;
  }
  
  summary += `*Source: Cartes de dangers officielles de la Confédération*`;
  
  return summary;
}

/**
 * Vérifie si une zone nécessite des études spécialisées
 */
export function requiresSpecializedStudy(dangerData: DangerData): boolean {
  return dangerData.dangers.some(d => 
    d.level === 'rouge' || 
    d.level === 'bleu' ||
    (d.type === 'avalanches' && d.level !== 'jaune_indicatif')
  );
} 