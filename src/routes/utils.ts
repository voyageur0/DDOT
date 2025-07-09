import { Router } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const router = Router();

// Vérifie qu'une URL est accessible (HEAD)
// GET /check-url?target=https://example.com/doc.pdf
router.get('/check-url', async (req, res) => {
  const target = (req.query.target as string || '').trim();
  if (!target) {
    return res.status(400).json({ ok: false, error: 'Paramètre "target" manquant' });
  }

  try {
    await axios.head(target, { timeout: 8000, maxRedirects: 5, validateStatus: () => true });
    return res.json({ ok: true });
  } catch (err) {
    return res.json({ ok: false });
  }
});

// Route pour télécharger les règlements communaux locaux
// GET /regulation/:commune
router.get('/regulation/:commune', (req, res) => {
  const commune = req.params.commune;
  
  // Fonction pour normaliser les noms (enlever accents, standardiser)
  const normalize = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
      .toLowerCase()
      .trim();
  };
  
  // Essayer différentes variantes du nom du fichier
  const baseDir = path.join(process.cwd(), 'reglements');
  
  try {
    // Lister tous les fichiers du dossier reglements
    const files = fs.readdirSync(baseDir);
    
    // Chercher un fichier qui correspond à la commune
    const matchingFile = files.find(file => {
      if (!file.endsWith('.pdf')) return false;
      
      // Normaliser le nom du fichier pour la comparaison
      const normalizedFile = normalize(file);
      const normalizedCommune = normalize(commune);
      
      // Vérifier si le nom de commune est contenu dans le nom du fichier
      return normalizedFile.includes(normalizedCommune);
    });
    
    if (matchingFile) {
      const filePath = path.join(baseDir, matchingFile);
      
      // Servir le fichier PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${matchingFile}"`);
      res.sendFile(filePath);
    } else {
      // Si aucun fichier n'est trouvé, essayer avec le format standard
      const standardFilename = `VS_${commune}_Règlement des constructions.pdf`;
      const standardPath = path.join(baseDir, standardFilename);
      
      if (fs.existsSync(standardPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${standardFilename}"`);
        res.sendFile(standardPath);
      } else {
        res.status(404).json({ 
          error: `Règlement non disponible pour la commune ${commune}`,
          message: 'Le fichier PDF du règlement communal n\'a pas été trouvé.',
          availableFiles: files.filter(f => f.endsWith('.pdf')).slice(0, 5).map(f => f.replace('.pdf', '')) // Montrer quelques exemples
        });
      }
    }
  } catch (error) {
    console.error('Erreur lors de la recherche du règlement:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la recherche du règlement.'
    });
  }
});

export default router; 