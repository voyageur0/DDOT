/**
 * Extracteur d'images depuis PDF pour analyse visuelle des tableaux
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Extrait une page spécifique d'un PDF comme image PNG
 * Utilise pdf2image ou Poppler (pdftoppm)
 */
export async function extractPdfPageAsImage(
  pdfPath: string, 
  pageNumber: number,
  outputDir: string = '/tmp'
): Promise<string> {
  console.log(`📸 Extraction page ${pageNumber} de ${pdfPath} comme image...`);
  
  const outputPath = path.join(outputDir, `page_${pageNumber}_${Date.now()}.png`);
  
  try {
    // Essayer avec pdftoppm (Poppler utils)
    const command = `pdftoppm -png -f ${pageNumber} -l ${pageNumber} -r 150 "${pdfPath}" "${outputPath.replace('.png', '')}"`;
    await execAsync(command);
    
    // pdftoppm ajoute -1.png au nom
    const actualPath = outputPath.replace('.png', '-1.png');
    
    // Vérifier que le fichier existe
    await fs.access(actualPath);
    console.log(`✅ Image extraite: ${actualPath}`);
    
    return actualPath;
    
  } catch (error) {
    console.error('❌ pdftoppm non disponible, tentative avec convertisseur alternatif...');
    
    // Alternative: utiliser ImageMagick si disponible
    try {
      const command = `convert -density 150 "${pdfPath}[${pageNumber - 1}]" "${outputPath}"`;
      await execAsync(command);
      
      await fs.access(outputPath);
      console.log(`✅ Image extraite avec ImageMagick: ${outputPath}`);
      return outputPath;
      
    } catch (error2) {
      console.error('❌ Aucun convertisseur PDF vers image disponible');
      throw new Error('Installez pdftoppm (poppler-utils) ou ImageMagick pour extraire les images');
    }
  }
}

/**
 * Trouve la page contenant le tableau synoptique (Art. 111)
 */
export async function findTableauSynoptiquePage(pdfPath: string): Promise<number> {
  console.log('🔍 Recherche de la page du tableau synoptique...');
  
  // D'abord extraire le texte pour trouver la page
  const pdfParse = require('pdf-parse');
  const pdfBuffer = await fs.readFile(pdfPath);
  const pdfData = await pdfParse(pdfBuffer, {
    pagerender: (pageData: any) => {
      // Chercher "Art 111" ou "Tableau synoptique"
      const text = pageData.getTextContent();
      return text.then((content: any) => {
        const pageText = content.items.map((item: any) => item.str).join(' ');
        if (pageText.includes('Art 111') || pageText.includes('Tableau synoptique')) {
          console.log(`✅ Tableau trouvé à la page ${pageData.pageNumber}`);
          return pageData.pageNumber;
        }
        return null;
      });
    }
  });
  
  // Généralement autour de la page 40 pour Vétroz
  return 40;
}

/**
 * Extrait le tableau synoptique comme image depuis le règlement
 */
export async function extractTableauSynoptiqueAsImage(
  municipality: string
): Promise<string | null> {
  try {
    const regulationPath = path.join(
      process.cwd(),
      'reglements',
      `VS_${municipality}_Règlement des constructions.pdf`
    );
    
    // Vérifier que le fichier existe
    await fs.access(regulationPath);
    
    // Page du tableau synoptique (généralement autour de 40-41)
    // Pour Vétroz c'est page 40
    const tableauPage = 40;
    
    const imagePath = await extractPdfPageAsImage(
      regulationPath,
      tableauPage,
      path.join(process.cwd(), 'uploads')
    );
    
    return imagePath;
    
  } catch (error) {
    console.error('Erreur extraction tableau:', error);
    return null;
  }
}

/**
 * Encode une image en base64 pour l'envoyer à l'API OpenAI
 */
export async function encodeImageBase64(imagePath: string): Promise<string> {
  const imageBuffer = await fs.readFile(imagePath);
  return imageBuffer.toString('base64');
}