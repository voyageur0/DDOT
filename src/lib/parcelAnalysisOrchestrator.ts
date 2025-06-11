import { searchParcel, getParcelDetails, identifyZonesAndConstraints, getGeologicalInfo, type ParcelSearchResult, type ParcelDetails } from './geoAdmin';
import { getPLRRestrictions, getBuildingZoneInfo, formatPLRForAnalysis, type PLRData } from './plrCadastre';
import { findCommunalRegulations, analyzeCommunalRegulation, formatRegulationsForAnalysis, type CommunalRegulation } from './communalRegulations';
import { getHazardAssessment, formatHazardAssessment, type HazardAssessment } from './dangerMapsVS';
import { geocodeAddress, getFallbackCoordinates, type GeocodeResult } from './geocodingVS';
import { getAllAdditionalData, formatAdditionalDataForAI, type CantonalDataResult } from './additionalDataSources';

export interface ComprehensiveParcelAnalysis {
  // Données de base
  searchQuery: string;
  searchResult: ParcelSearchResult | null;
  parcelDetails: ParcelDetails | null;
  geocodeResult: GeocodeResult | null;
  
  // Données cadastrales
  zones: Record<string, any>;
  geologicalInfo: Record<string, any>;
  buildingZone: Record<string, any>;
  
  // Restrictions légales
  plrData: PLRData | null;
  communalRegulations: CommunalRegulation[];
  
  // Dangers naturels
  hazardAssessment: HazardAssessment | null;
  
  // Données supplémentaires
  additionalData: CantonalDataResult[];
  
  // Métadonnées
  processingTime: number;
  completeness: number; // Pourcentage de données récupérées avec succès
  errors: string[];
  
  // Données formatées pour OpenAI
  formattedForAI: string;
}

/**
 * Orchestre une analyse complète de parcelle avec toutes les sources
 */
export async function performComprehensiveAnalysis(searchQuery: string): Promise<ComprehensiveParcelAnalysis> {
  const startTime = Date.now();
  console.log(`🚀 Début analyse complète pour: "${searchQuery}"`);
  
  const analysis: ComprehensiveParcelAnalysis = {
    searchQuery,
    searchResult: null,
    parcelDetails: null,
    geocodeResult: null,
    zones: {},
    geologicalInfo: {},
    buildingZone: {},
    plrData: null,
    communalRegulations: [],
    hazardAssessment: null,
    additionalData: [],
    processingTime: 0,
    completeness: 0,
    errors: [],
    formattedForAI: ''
  };
  
  let successCount = 0;
  const totalSteps = 8; // Nombre total d'étapes
  
  try {
    // ÉTAPE 1: Recherche de la parcelle
    console.log('📍 Étape 1/8: Recherche parcelle...');
    try {
      analysis.searchResult = await searchParcel(searchQuery);
      if (analysis.searchResult) {
        successCount++;
        console.log(`✅ Parcelle trouvée: ${analysis.searchResult.egrid}`);
      } else {
        analysis.errors.push('Parcelle non trouvée');
        console.log('❌ Parcelle non trouvée');
        // Si on ne trouve pas la parcelle, on ne peut pas continuer
        analysis.processingTime = Date.now() - startTime;
        analysis.completeness = 0;
        analysis.formattedForAI = generateErrorMessage(searchQuery, analysis.errors);
        return analysis;
      }
    } catch (error) {
      analysis.errors.push(`Erreur recherche parcelle: ${error}`);
    }
    
    if (!analysis.searchResult) {
      analysis.processingTime = Date.now() - startTime;
      analysis.completeness = 0;
      analysis.formattedForAI = generateErrorMessage(searchQuery, analysis.errors);
      return analysis;
    }
    
    const { x, y } = analysis.searchResult.center;
    const egrid = analysis.searchResult.egrid;
    
    // ÉTAPE 2: Détails de la parcelle
    console.log('📊 Étape 2/8: Détails parcelle...');
    try {
      analysis.parcelDetails = await getParcelDetails(x, y);
      if (analysis.parcelDetails) successCount++;
    } catch (error) {
      analysis.errors.push(`Erreur détails parcelle: ${error}`);
    }
    
    // ÉTAPE 3: Zones et contraintes
    console.log('🗺️ Étape 3/8: Zones et contraintes...');
    try {
      analysis.zones = await identifyZonesAndConstraints(x, y);
      if (Object.keys(analysis.zones).length > 0) successCount++;
    } catch (error) {
      analysis.errors.push(`Erreur zones: ${error}`);
    }
    
    // ÉTAPE 4: Informations géologiques
    console.log('🗻 Étape 4/8: Infos géologiques...');
    try {
      analysis.geologicalInfo = await getGeologicalInfo(x, y);
      if (Object.keys(analysis.geologicalInfo).length > 0) successCount++;
    } catch (error) {
      analysis.errors.push(`Erreur géologie: ${error}`);
    }
    
    // ÉTAPE 5: Zone de construction
    console.log('🏗️ Étape 5/8: Zone de construction...');
    try {
      analysis.buildingZone = await getBuildingZoneInfo(x, y);
      if (Object.keys(analysis.buildingZone).length > 0) successCount++;
    } catch (error) {
      analysis.errors.push(`Erreur zone construction: ${error}`);
    }
    
    // ÉTAPE 6: Restrictions PLR
    console.log('📋 Étape 6/8: Restrictions PLR...');
    if (egrid) {
      try {
        analysis.plrData = await getPLRRestrictions(egrid);
        if (analysis.plrData) successCount++;
      } catch (error) {
        analysis.errors.push(`Erreur PLR: ${error}`);
      }
    }
    
    // ÉTAPE 7: Règlements communaux
    console.log('🏛️ Étape 7/8: Règlements communaux...');
    const municipality = analysis.parcelDetails?.municipality || analysis.searchResult?.municipality || '';
    if (municipality) {
      try {
        const regulations = await findCommunalRegulations(municipality);
        // Analyser les premiers règlements trouvés
        for (let i = 0; i < Math.min(regulations.length, 3); i++) {
          const analyzed = await analyzeCommunalRegulation(regulations[i]);
          analysis.communalRegulations.push(analyzed);
        }
        if (analysis.communalRegulations.length > 0) successCount++;
      } catch (error) {
        analysis.errors.push(`Erreur règlements: ${error}`);
      }
    }
    
    // ÉTAPE 8: Dangers naturels
    console.log('⚠️ Étape 8/8: Dangers naturels...');
    try {
      analysis.hazardAssessment = await getHazardAssessment(x, y, municipality);
      if (analysis.hazardAssessment) successCount++;
    } catch (error) {
      analysis.errors.push(`Erreur dangers: ${error}`);
    }
    
    // Calcul de la complétude
    analysis.completeness = Math.round((successCount / totalSteps) * 100);
    analysis.processingTime = Date.now() - startTime;
    
    // Formatage pour OpenAI
    analysis.formattedForAI = formatForOpenAI(analysis);
    
    console.log(`✅ Analyse terminée en ${analysis.processingTime}ms - Complétude: ${analysis.completeness}%`);
    
  } catch (error) {
    console.error('❌ Erreur critique lors de l\'analyse:', error);
    analysis.errors.push(`Erreur critique: ${error}`);
    analysis.processingTime = Date.now() - startTime;
    analysis.formattedForAI = generateErrorMessage(searchQuery, analysis.errors);
  }
  
  return analysis;
}

/**
 * Formate toutes les données pour l'analyse OpenAI
 */
function formatForOpenAI(analysis: ComprehensiveParcelAnalysis): string {
  let formatted = `# ANALYSE COMPLÈTE DE PARCELLE\n\n`;
  formatted += `**Recherche:** ${analysis.searchQuery}\n`;
  formatted += `**Complétude des données:** ${analysis.completeness}%\n`;
  formatted += `**Temps de traitement:** ${analysis.processingTime}ms\n\n`;
  
  // 1. INFORMATIONS DE BASE
  if (analysis.searchResult && analysis.parcelDetails) {
    formatted += `## 1. INFORMATIONS DE BASE\n\n`;
    formatted += `**EGRID:** ${analysis.searchResult.egrid}\n`;
    formatted += `**Numéro de parcelle:** ${analysis.parcelDetails.number}\n`;
    formatted += `**Commune:** ${analysis.parcelDetails.municipality}\n`;
    formatted += `**Canton:** ${analysis.parcelDetails.canton}\n`;
    formatted += `**Surface:** ${analysis.parcelDetails.surface} m²\n`;
    formatted += `**Coordonnées:** ${analysis.parcelDetails.coordinates.x}, ${analysis.parcelDetails.coordinates.y} (CH1903+ LV95)\n\n`;
  }
  
  // 2. ZONE DE CONSTRUCTION
  if (Object.keys(analysis.buildingZone).length > 0) {
    formatted += `## 2. ZONE DE CONSTRUCTION\n\n`;
    const zone = analysis.buildingZone;
    if (zone.typ_kt) formatted += `**Type de zone:** ${zone.typ_kt}\n`;
    if (zone.description) formatted += `**Description:** ${zone.description}\n`;
    if (zone.nutzungszone) formatted += `**Zone d'affectation:** ${zone.nutzungszone}\n`;
    formatted += '\n';
  }
  
  // 3. RESTRICTIONS PLR
  if (analysis.plrData) {
    formatted += `## 3. RESTRICTIONS DE DROIT PUBLIC (PLR)\n\n`;
    formatted += formatPLRForAnalysis(analysis.plrData);
  }
  
  // 4. RÈGLEMENTS COMMUNAUX
  if (analysis.communalRegulations.length > 0) {
    formatted += `## 4. RÈGLEMENTS COMMUNAUX\n\n`;
    formatted += formatRegulationsForAnalysis(analysis.communalRegulations);
  }
  
  // 5. DANGERS NATURELS
  if (analysis.hazardAssessment) {
    formatted += `## 5. DANGERS NATURELS\n\n`;
    formatted += formatHazardAssessment(analysis.hazardAssessment);
  }
  
  // 6. CONTRAINTES GÉOGRAPHIQUES
  if (Object.keys(analysis.zones).length > 0 || Object.keys(analysis.geologicalInfo).length > 0) {
    formatted += `## 6. CONTRAINTES GÉOGRAPHIQUES ET GÉOLOGIQUES\n\n`;
    
    if (Object.keys(analysis.zones).length > 0) {
      formatted += `### Zones spéciales identifiées:\n`;
      for (const [layer, data] of Object.entries(analysis.zones)) {
        formatted += `- **${layer}:** ${JSON.stringify(data, null, 2)}\n`;
      }
      formatted += '\n';
    }
    
    if (Object.keys(analysis.geologicalInfo).length > 0) {
      formatted += `### Informations géologiques:\n`;
      for (const [layer, data] of Object.entries(analysis.geologicalInfo)) {
        formatted += `- **${layer}:** ${JSON.stringify(data, null, 2)}\n`;
      }
      formatted += '\n';
    }
  }
  
  // 7. ERREURS ET LIMITATIONS
  if (analysis.errors.length > 0) {
    formatted += `## 7. LIMITATIONS DE L'ANALYSE\n\n`;
    formatted += `**Données manquantes ou erreurs rencontrées:**\n`;
    for (const error of analysis.errors) {
      formatted += `- ${error}\n`;
    }
    formatted += '\n';
  }
  
  // 8. LIENS UTILES
  if (analysis.hazardAssessment?.mapUrls?.length) {
    formatted += `## 8. CARTES ET VISUALISATIONS\n\n`;
    for (const url of analysis.hazardAssessment.mapUrls) {
      formatted += `- [Visualisation des dangers](${url})\n`;
    }
    formatted += '\n';
  }
  
  formatted += `---\n\n`;
  formatted += `**INSTRUCTIONS POUR L'ANALYSE:**\n`;
  formatted += `En tant qu'expert en aménagement du territoire et construction en Suisse, analysez ces données et fournissez:\n`;
  formatted += `1. Un résumé des principales contraintes et opportunités\n`;
  formatted += `2. Les démarches administratives nécessaires\n`;
  formatted += `3. Les points d'attention pour un projet de construction\n`;
  formatted += `4. Une estimation des risques et défis potentiels\n`;
  formatted += `5. Des recommandations spécifiques basées sur les données récoltées\n\n`;
  
  return formatted;
}

/**
 * Génère un message d'erreur formaté
 */
function generateErrorMessage(searchQuery: string, errors: string[]): string {
  let message = `# ERREUR D'ANALYSE DE PARCELLE\n\n`;
  message += `**Recherche:** ${searchQuery}\n\n`;
  message += `**Problèmes rencontrés:**\n`;
  for (const error of errors) {
    message += `- ${error}\n`;
  }
  message += `\n**Recommandations:**\n`;
  message += `- Vérifiez que l'adresse ou le numéro de parcelle est correct\n`;
  message += `- Essayez avec une formulation différente (ex: "Rue du Village 10, Sion" ou "Parcelle 542, Martigny")\n`;
  message += `- Contactez les services communaux pour obtenir des informations précises\n\n`;
  
  return message;
}

/**
 * Analyse rapide (version allégée pour tests)
 */
export async function performQuickAnalysis(searchQuery: string): Promise<ComprehensiveParcelAnalysis> {
  console.log(`⚡ Analyse rapide pour: "${searchQuery}"`);
  
  const startTime = Date.now();
  const analysis: ComprehensiveParcelAnalysis = {
    searchQuery,
    searchResult: null,
    parcelDetails: null,
    geocodeResult: null,
    zones: {},
    geologicalInfo: {},
    buildingZone: {},
    plrData: null,
    communalRegulations: [],
    hazardAssessment: null,
    additionalData: [],
    processingTime: 0,
    completeness: 0,
    errors: [],
    formattedForAI: ''
  };
  
  try {
    // Juste la recherche de base et quelques infos essentielles
    analysis.searchResult = await searchParcel(searchQuery);
    
    if (analysis.searchResult) {
      const { x, y } = analysis.searchResult.center;
      
      // Essayer de récupérer quelques données essentielles en parallèle
      const [parcelDetails, buildingZone, zones] = await Promise.allSettled([
        getParcelDetails(x, y),
        getBuildingZoneInfo(x, y),
        identifyZonesAndConstraints(x, y)
      ]);
      
      if (parcelDetails.status === 'fulfilled') analysis.parcelDetails = parcelDetails.value;
      if (buildingZone.status === 'fulfilled') analysis.buildingZone = buildingZone.value;
      if (zones.status === 'fulfilled') analysis.zones = zones.value;
      
      // Calcul de complétude approximatif
      let successCount = 1; // searchResult réussi
      if (analysis.parcelDetails) successCount++;
      if (Object.keys(analysis.buildingZone).length > 0) successCount++;
      if (Object.keys(analysis.zones).length > 0) successCount++;
      
      analysis.completeness = Math.round((successCount / 4) * 100);
    }
    
    analysis.processingTime = Date.now() - startTime;
    analysis.formattedForAI = formatForOpenAI(analysis);
    
    console.log(`⚡ Analyse rapide terminée en ${analysis.processingTime}ms`);
    
  } catch (error) {
    analysis.errors.push(`Erreur analyse rapide: ${error}`);
    analysis.formattedForAI = generateErrorMessage(searchQuery, analysis.errors);
  }
  
  return analysis;
} 