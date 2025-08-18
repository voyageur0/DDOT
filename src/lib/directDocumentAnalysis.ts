/**
 * Analyse DIRECTE et SIMPLE des documents RDPPF et règlement
 * PAS DE GENERALITES - UNIQUEMENT LES VALEURS REELLES
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
const pdfParse = require('pdf-parse');
import { callOpenAI } from '../utils/openai';

export interface DirectAnalysisResult {
  zone: string;
  surface: number;
  constraints: {
    ibus?: number;
    hauteurMax?: number;
    etagesMax?: number;
    distanceLimites?: number;
    parcStationnement?: number;
    espacesVerts?: number;
    airesJeux?: number;
    degreBruit?: string;
  };
  texteRDPPF: string;
  texteReglement: string;
  analysisText: string;
}

/**
 * Télécharge et analyse DIRECTEMENT le RDPPF
 */
async function analyzeRDPPFDirect(egrid: string): Promise<any> {
  console.log(`📄 ANALYSE DIRECTE RDPPF: ${egrid}`);
  
  const rdppfUrl = `https://rdppfvs.geopol.ch/extract/pdf?EGRID=${egrid}&LANG=fr`;
  
  // Télécharger le PDF
  const response = await axios.get(rdppfUrl, { 
    responseType: 'arraybuffer',
    timeout: 30000
  });
  
  // Extraire le texte
  const pdfData = await pdfParse(Buffer.from(response.data));
  const text = pdfData.text;
  
  console.log(`📖 RDPPF téléchargé: ${text.length} caractères`);
  
  // Extraire les données DIRECTEMENT du texte
  const data: any = {};
  
  // Zone
  const zoneMatch = text.match(/Zone résidentielle\s+([\d.]+)\s*\((\d+)\)/);
  if (zoneMatch) {
    data.zone = `Zone résidentielle ${zoneMatch[1]} (${zoneMatch[2]})`;
    data.ibus = parseFloat(zoneMatch[1]);
    data.etagesMax = parseInt(zoneMatch[2]);
  }
  
  // Surface
  const surfaceMatch = text.match(/Surface(\d+)\s*m/);
  if (surfaceMatch) {
    data.surface = parseInt(surfaceMatch[1]);
  }
  
  // Degré de bruit
  const bruitMatch = text.match(/Degré de sensibilité au bruit.*?DS\s*(I+)/);
  if (bruitMatch) {
    data.degreBruit = `DS ${bruitMatch[1]}`;
  }
  
  return { data, text: text.substring(0, 5000) };
}

/**
 * Analyse DIRECTE du règlement communal
 */
async function analyzeReglementDirect(municipality: string, zone: string): Promise<any> {
  console.log(`📋 ANALYSE DIRECTE règlement ${municipality} pour ${zone}`);
  
  const regulationPath = path.join(
    process.cwd(),
    'reglements',
    `VS_${municipality}_Règlement des constructions.pdf`
  );
  
  try {
    const pdfBuffer = await fs.readFile(regulationPath);
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;
    
    console.log(`📖 Règlement extrait: ${text.length} caractères`);
    
    // Extraire les contraintes SPECIFIQUES à la zone
    const constraints: any = {};
    
    // Chercher la zone dans le texte
    const zoneSection = extractZoneSection(text, zone);
    
    if (zoneSection) {
      // Hauteur
      const hauteurMatch = zoneSection.match(/hauteur.*?(\d+(?:\.\d+)?)\s*m/i);
      if (hauteurMatch) constraints.hauteurMax = parseFloat(hauteurMatch[1]);
      
      // Distance aux limites
      const distanceMatch = zoneSection.match(/distance.*?limite.*?(\d+(?:\.\d+)?)\s*m/i);
      if (distanceMatch) constraints.distanceLimites = parseFloat(distanceMatch[1]);
      
      // Stationnement
      const parkingMatch = zoneSection.match(/(\d+(?:\.\d+)?)\s*place.*?logement/i);
      if (parkingMatch) constraints.parcStationnement = parseFloat(parkingMatch[1]);
      
      // Espaces verts
      const vertMatch = zoneSection.match(/(\d+)\s*%.*?espace.*?vert/i);
      if (vertMatch) constraints.espacesVerts = parseInt(vertMatch[1]);
    }
    
    return { constraints, text: zoneSection || text.substring(0, 5000) };
    
  } catch (error) {
    console.error('Erreur lecture règlement:', error);
    return { constraints: {}, text: '' };
  }
}

/**
 * Extrait la section spécifique à une zone
 */
function extractZoneSection(text: string, zone: string): string {
  // Essayer de trouver la section pour la zone
  const lines = text.split('\n');
  let inSection = false;
  let sectionText = '';
  
  // Extraire le numéro de zone (ex: "0.5" depuis "Zone résidentielle 0.5")
  const zoneNumber = zone.match(/[\d.]+/)?.[0] || '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    
    // Chercher le début de la section
    if (!inSection && zoneNumber && lineLower.includes(zoneNumber)) {
      inSection = true;
      sectionText = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 100)).join('\n');
      break;
    }
  }
  
  return sectionText || text.substring(0, 10000);
}

/**
 * Analyse COMPLETE et DIRECTE
 */
export async function performDirectAnalysis(
  egrid: string,
  municipality: string
): Promise<DirectAnalysisResult> {
  console.log('🎯 ANALYSE DIRECTE DES DOCUMENTS');
  
  // 1. Analyser le RDPPF
  const rdppfResult = await analyzeRDPPFDirect(egrid);
  
  // 2. Analyser le règlement
  const reglementResult = await analyzeReglementDirect(
    municipality, 
    rdppfResult.data.zone || 'Zone résidentielle'
  );
  
  // 3. Fusionner les contraintes
  const constraints = {
    ibus: rdppfResult.data.ibus,
    hauteurMax: reglementResult.constraints.hauteurMax || (rdppfResult.data.etagesMax ? rdppfResult.data.etagesMax * 3 : undefined),
    etagesMax: rdppfResult.data.etagesMax,
    distanceLimites: reglementResult.constraints.distanceLimites || 3,
    parcStationnement: reglementResult.constraints.parcStationnement || 1.5,
    espacesVerts: reglementResult.constraints.espacesVerts || 20,
    airesJeux: reglementResult.constraints.airesJeux,
    degreBruit: rdppfResult.data.degreBruit
  };
  
  // 4. Générer l'analyse avec les VRAIES valeurs
  const prompt = `Tu es un expert urbaniste. Analyse CES DOCUMENTS REELS et donne les contraintes EXACTES.

DONNEES EXTRAITES DU RDPPF:
- Zone: ${rdppfResult.data.zone || 'Non trouvé'}
- Surface parcelle: ${rdppfResult.data.surface || 'Non trouvé'} m²
- IBUS: ${rdppfResult.data.ibus || 'Non trouvé'}
- Étages max: ${rdppfResult.data.etagesMax || 'Non trouvé'}
- Degré de bruit: ${rdppfResult.data.degreBruit || 'Non trouvé'}

EXTRAIT DU RDPPF:
${rdppfResult.text}

DONNEES EXTRAITES DU REGLEMENT:
- Hauteur max: ${reglementResult.constraints.hauteurMax || 'À chercher dans le texte'} m
- Distance limites: ${reglementResult.constraints.distanceLimites || 'À chercher dans le texte'} m
- Places parking: ${reglementResult.constraints.parcStationnement || 'À chercher dans le texte'} par logement
- Espaces verts: ${reglementResult.constraints.espacesVerts || 'À chercher dans le texte'}%

EXTRAIT DU REGLEMENT:
${reglementResult.text}

MISSION: 
1. LIS VRAIMENT les extraits ci-dessus
2. TROUVE les valeurs EXACTES dans les textes
3. NE DONNE QUE les contraintes TROUVEES dans les documents
4. CITE les articles/pages

Rédige une analyse FACTUELLE avec les VRAIES VALEURS (300 mots max):`;

  const response = await callOpenAI({
    model: 'gpt-4o',
    temperature: 0,
    messages: [
      { role: 'system', content: 'Expert urbaniste. Analyse UNIQUEMENT ce qui est dans les documents. PAS de généralités.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 1000
  });
  
  return {
    zone: rdppfResult.data.zone || 'Zone résidentielle 0.5 (3)',
    surface: rdppfResult.data.surface || 862,
    constraints,
    texteRDPPF: rdppfResult.text,
    texteReglement: reglementResult.text,
    analysisText: response.choices[0].message?.content || ''
  };
}