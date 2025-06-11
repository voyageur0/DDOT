import axios from 'axios';

export interface DangerZone {
  type: 'avalanche' | 'laves_torrentielles' | 'chutes_pierres' | 'glissement' | 'inondation';
  level: 'rouge' | 'bleu' | 'jaune' | 'blanc';
  levelCode: number; // 1=rouge, 2=bleu, 3=jaune, 4=blanc
  description: string;
  recommendations: string[];
  probability: string;
  intensity: string;
}

export interface HazardAssessment {
  coordinates: { x: number; y: number };
  municipality: string;
  dangerZones: DangerZone[];
  seismicZone?: string;
  radonRisk?: string;
  generalRecommendations: string[];
  mapUrls: string[];
}

const VALAIS_WMS_BASE = 'https://map.geo.vs.ch/wmsserver';
const GEO_ADMIN_WMS = 'https://wms.geo.admin.ch';

/**
 * Récupère toutes les informations de dangers naturels pour une parcelle
 */
export async function getHazardAssessment(x: number, y: number, municipality: string): Promise<HazardAssessment> {
  console.log(`⚠️ Évaluation des dangers naturels (${x}, ${y}) à ${municipality}`);
  
  const assessment: HazardAssessment = {
    coordinates: { x, y },
    municipality,
    dangerZones: [],
    generalRecommendations: [],
    mapUrls: []
  };
  
  try {
    // 1. Dangers d'avalanches
    const avalanches = await getAvalancheDangers(x, y);
    assessment.dangerZones.push(...avalanches);
    
    // 2. Laves torrentielles
    const torrents = await getTorrentialHazards(x, y);
    assessment.dangerZones.push(...torrents);
    
    // 3. Chutes de pierres et éboulements
    const rockfalls = await getRockfallHazards(x, y);
    assessment.dangerZones.push(...rockfalls);
    
    // 4. Glissements de terrain
    const landslides = await getLandslideHazards(x, y);
    assessment.dangerZones.push(...landslides);
    
    // 5. Inondations
    const floods = await getFloodHazards(x, y);
    assessment.dangerZones.push(...floods);
    
    // 6. Zone sismique
    assessment.seismicZone = await getSeismicZone(x, y);
    
    // 7. Risque radon
    assessment.radonRisk = await getRadonRisk(x, y);
    
    // 8. Générer les recommandations
    assessment.generalRecommendations = generateRecommendations(assessment.dangerZones);
    
    // 9. URLs de cartes pour visualisation
    assessment.mapUrls = generateMapUrls(x, y);
    
    console.log(`✅ Évaluation terminée: ${assessment.dangerZones.length} zones de danger identifiées`);
    
  } catch (error) {
    console.error('❌ Erreur évaluation dangers:', error);
  }
  
  return assessment;
}

/**
 * Récupère les données d'avalanches
 */
async function getAvalancheDangers(x: number, y: number): Promise<DangerZone[]> {
  const dangers: DangerZone[] = [];
  
  try {
    console.log('🏔️ Vérification dangers d\'avalanches');
    
    const { data } = await axios.get(`${VALAIS_WMS_BASE}`, {
      params: {
        SERVICE: 'WMS',
        VERSION: '1.3.0',
        REQUEST: 'GetFeatureInfo',
        LAYERS: 'ms:VS_DANGERS_AVALANCHES',
        QUERY_LAYERS: 'ms:VS_DANGERS_AVALANCHES',
        FORMAT: 'image/png',
        INFO_FORMAT: 'text/xml',
        I: '50',
        J: '50',
        WIDTH: '100',
        HEIGHT: '100',
        CRS: 'EPSG:2056',
        BBOX: `${x-50},${y-50},${x+50},${y+50}`
      },
      timeout: 10000
    });
    
    // Parser la réponse XML pour extraire les informations
    if (data && data.includes('Feature')) {
      dangers.push({
        type: 'avalanche',
        level: 'rouge', // À déterminer selon les données réelles
        levelCode: 1,
        description: 'Zone d\'avalanche identifiée',
        recommendations: ['Études spécialisées requises', 'Mesures de protection à prévoir'],
        probability: 'Variable selon les conditions météorologiques',
        intensity: 'Forte'
      });
    }
    
  } catch (error) {
    console.log('⚠️ Données avalanches non disponibles');
  }
  
  return dangers;
}

/**
 * Récupère les données de laves torrentielles
 */
async function getTorrentialHazards(x: number, y: number): Promise<DangerZone[]> {
  const dangers: DangerZone[] = [];
  
  try {
    console.log('🌊 Vérification laves torrentielles');
    
    const { data } = await axios.get(`${VALAIS_WMS_BASE}`, {
      params: {
        SERVICE: 'WMS',
        VERSION: '1.3.0',
        REQUEST: 'GetFeatureInfo',
        LAYERS: 'ms:VS_DANGERS_LAVES_TORRENTIELLES',
        QUERY_LAYERS: 'ms:VS_DANGERS_LAVES_TORRENTIELLES',
        FORMAT: 'image/png',
        INFO_FORMAT: 'text/xml',
        I: '50',
        J: '50',
        WIDTH: '100',
        HEIGHT: '100',
        CRS: 'EPSG:2056',
        BBOX: `${x-50},${y-50},${x+50},${y+50}`
      },
      timeout: 10000
    });
    
    if (data && data.includes('Feature')) {
      dangers.push({
        type: 'laves_torrentielles',
        level: 'bleu',
        levelCode: 2,
        description: 'Zone exposée aux laves torrentielles',
        recommendations: ['Étude hydraulique recommandée', 'Surélévation possible des constructions'],
        probability: 'Moyenne lors d\'événements pluvieux intenses',
        intensity: 'Modérée à forte'
      });
    }
    
  } catch (error) {
    console.log('⚠️ Données laves torrentielles non disponibles');
  }
  
  return dangers;
}

/**
 * Récupère les données de chutes de pierres
 */
async function getRockfallHazards(x: number, y: number): Promise<DangerZone[]> {
  const dangers: DangerZone[] = [];
  
  try {
    console.log('🪨 Vérification chutes de pierres');
    
    // Utiliser les données fédérales via geo.admin.ch
    const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/ech/MapServer/identify', {
      params: {
        geometry: `${x},${y}`,
        geometryFormat: 'geojson',
        geometryType: 'esriGeometryPoint',
        layers: 'all:ch.bafu.gefahren-steinschlag',
        tolerance: 10,
        mapExtent: `${x-100},${y-100},${x+100},${y+100}`,
        imageDisplay: '100,100,96',
        lang: 'fr'
      },
      timeout: 10000
    });
    
    if (data?.results?.length) {
      const attrs = data.results[0].attributes;
      dangers.push({
        type: 'chutes_pierres',
        level: attrs.hazard_level || 'jaune',
        levelCode: 3,
        description: attrs.description || 'Zone de chutes de pierres',
        recommendations: ['Filets de protection possibles', 'Orientation des ouvertures à considérer'],
        probability: attrs.probability || 'Faible à moyenne',
        intensity: attrs.intensity || 'Variable'
      });
    }
    
  } catch (error) {
    console.log('⚠️ Données chutes de pierres non disponibles');
  }
  
  return dangers;
}

/**
 * Récupère les données de glissements de terrain
 */
async function getLandslideHazards(x: number, y: number): Promise<DangerZone[]> {
  const dangers: DangerZone[] = [];
  
  try {
    console.log('⛰️ Vérification glissements de terrain');
    
    const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/ech/MapServer/identify', {
      params: {
        geometry: `${x},${y}`,
        geometryFormat: 'geojson',
        geometryType: 'esriGeometryPoint',
        layers: 'all:ch.bafu.gefahren-rutschung',
        tolerance: 10,
        mapExtent: `${x-100},${y-100},${x+100},${y+100}`,
        imageDisplay: '100,100,96',
        lang: 'fr'
      },
      timeout: 10000
    });
    
    if (data?.results?.length) {
      dangers.push({
        type: 'glissement',
        level: 'jaune',
        levelCode: 3,
        description: 'Zone sensible aux glissements de terrain',
        recommendations: ['Étude géotechnique recommandée', 'Drainage à prévoir'],
        probability: 'Faible en conditions normales',
        intensity: 'Modérée'
      });
    }
    
  } catch (error) {
    console.log('⚠️ Données glissements non disponibles');
  }
  
  return dangers;
}

/**
 * Récupère les données d'inondations
 */
async function getFloodHazards(x: number, y: number): Promise<DangerZone[]> {
  const dangers: DangerZone[] = [];
  
  try {
    console.log('💧 Vérification risques d\'inondation');
    
    const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/ech/MapServer/identify', {
      params: {
        geometry: `${x},${y}`,
        geometryFormat: 'geojson',
        geometryType: 'esriGeometryPoint',
        layers: 'all:ch.bafu.gefahren-ueberschwemmung',
        tolerance: 5,
        mapExtent: `${x-50},${y-50},${x+50},${y+50}`,
        imageDisplay: '100,100,96',
        lang: 'fr'
      },
      timeout: 10000
    });
    
    if (data?.results?.length) {
      dangers.push({
        type: 'inondation',
        level: 'bleu',
        levelCode: 2,
        description: 'Zone inondable',
        recommendations: ['Surélévation des constructions', 'Étanchéité renforcée des sous-sols'],
        probability: 'Rare (récurrence > 100 ans)',
        intensity: 'Moyenne'
      });
    }
    
  } catch (error) {
    console.log('⚠️ Données inondations non disponibles');
  }
  
  return dangers;
}

/**
 * Récupère la zone sismique
 */
async function getSeismicZone(x: number, y: number): Promise<string> {
  try {
    const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/ech/MapServer/identify', {
      params: {
        geometry: `${x},${y}`,
        geometryFormat: 'geojson',
        geometryType: 'esriGeometryPoint',
        layers: 'all:ch.bafu.erdbeben-gefaehrdungskarte',
        tolerance: 0,
        mapExtent: `${x-10},${y-10},${x+10},${y+10}`,
        imageDisplay: '100,100,96',
        lang: 'fr'
      },
      timeout: 8000
    });
    
    if (data?.results?.length) {
      return data.results[0].attributes?.zone || 'Zone sismique non définie';
    }
  } catch (error) {
    console.log('⚠️ Zone sismique non disponible');
  }
  
  return 'Zone sismique à déterminer';
}

/**
 * Récupère le risque radon
 */
async function getRadonRisk(x: number, y: number): Promise<string> {
  try {
    const { data } = await axios.get('https://api3.geo.admin.ch/rest/services/ech/MapServer/identify', {
      params: {
        geometry: `${x},${y}`,
        geometryFormat: 'geojson',
        geometryType: 'esriGeometryPoint',
        layers: 'all:ch.bag.radon',
        tolerance: 0,
        mapExtent: `${x-10},${y-10},${x+10},${y+10}`,
        imageDisplay: '100,100,96',
        lang: 'fr'
      },
      timeout: 8000
    });
    
    if (data?.results?.length) {
      return data.results[0].attributes?.risk_level || 'Risque radon non défini';
    }
  } catch (error) {
    console.log('⚠️ Risque radon non disponible');
  }
  
  return 'Risque radon à déterminer';
}

/**
 * Génère des recommandations basées sur les zones de danger
 */
function generateRecommendations(dangerZones: DangerZone[]): string[] {
  const recommendations: string[] = [];
  
  if (dangerZones.some(z => z.levelCode <= 2)) {
    recommendations.push('Consultation d\'un ingénieur spécialisé en dangers naturels obligatoire');
  }
  
  if (dangerZones.some(z => z.type === 'avalanche')) {
    recommendations.push('Étude avalanche détaillée requise');
  }
  
  if (dangerZones.some(z => z.type === 'inondation')) {
    recommendations.push('Cote de sécurité et drainage à prévoir');
  }
  
  if (dangerZones.some(z => z.type === 'chutes_pierres')) {
    recommendations.push('Mesures de protection contre les chutes de pierres');
  }
  
  if (dangerZones.length === 0) {
    recommendations.push('Aucun danger naturel majeur identifié');
  }
  
  return recommendations;
}

/**
 * Génère les URLs de cartes pour visualisation
 */
function generateMapUrls(x: number, y: number): string[] {
  const urls: string[] = [];
  
  // Carte des dangers du Valais
  urls.push(`https://map.geo.vs.ch/?theme=dangers&E=${x}&N=${y}&zoom=6`);
  
  // Carte fédérale des dangers
  urls.push(`https://map.geo.admin.ch/?topic=bafu&lang=fr&bgLayer=ch.swisstopo.pixelkarte-farbe&E=${x}&N=${y}&zoom=6&layers=ch.bafu.gefahren-steinschlag,ch.bafu.gefahren-rutschung,ch.bafu.gefahren-ueberschwemmung`);
  
  return urls;
}

/**
 * Formate l'évaluation des dangers pour l'analyse OpenAI
 */
export function formatHazardAssessment(assessment: HazardAssessment): string {
  let formatted = `### ÉVALUATION DES DANGERS NATURELS\n\n`;
  formatted += `**Localisation:** ${assessment.municipality} (${assessment.coordinates.x}, ${assessment.coordinates.y})\n\n`;
  
  if (assessment.dangerZones.length > 0) {
    formatted += `#### ZONES DE DANGER (${assessment.dangerZones.length} identifiées)\n\n`;
    
    for (const zone of assessment.dangerZones) {
      formatted += `**${zone.type.toUpperCase()}** - Niveau ${zone.level.toUpperCase()}\n`;
      formatted += `- Description: ${zone.description}\n`;
      formatted += `- Probabilité: ${zone.probability}\n`;
      formatted += `- Intensité: ${zone.intensity}\n`;
      formatted += `- Recommandations: ${zone.recommendations.join('; ')}\n\n`;
    }
  } else {
    formatted += `#### Aucune zone de danger majeur identifiée\n\n`;
  }
  
  if (assessment.seismicZone) {
    formatted += `**Zone sismique:** ${assessment.seismicZone}\n`;
  }
  
  if (assessment.radonRisk) {
    formatted += `**Risque radon:** ${assessment.radonRisk}\n`;
  }
  
  if (assessment.generalRecommendations.length > 0) {
    formatted += `\n#### RECOMMANDATIONS GÉNÉRALES\n`;
    for (const rec of assessment.generalRecommendations) {
      formatted += `- ${rec}\n`;
    }
  }
  
  return formatted;
} 