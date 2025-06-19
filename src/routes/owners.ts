import { Router } from 'express';
import { getOwners } from '../automation/parcelOwner';
import { searchParcel } from '../lib/geoAdmin';

const router = Router();

// GET /owners?commune=Anniviers&parcel=3333
// GET /owners?search=Vétroz 13455
router.get('/owners', async (req, res) => {
  let commune = (req.query.commune as string || '').trim();
  let parcel = (req.query.parcel as string || '').trim();
  const search = (req.query.search as string || '').trim();

  // Si on a une recherche combinée, essayer d'extraire commune et parcelle
  if (search && (!commune || !parcel)) {
    const parts = search.split(/\s+/);
    if (parts.length >= 2) {
      commune = parts[0];
      parcel = parts[parts.length - 1]; // Dernier élément est souvent le numéro
    }
  }

  if (!commune || !parcel) {
    return res.status(400).json({ 
      error: 'Paramètres insuffisants',
      help: 'Utilisez ?commune=X&parcel=Y ou ?search="Commune Parcelle"'
    });
  }

  try {
    const result = await getOwners(commune, parcel);
    return res.json(result);
  } catch (err: any) {
    console.error('Erreur route /owners:', err);
    
    // Si erreur "Parcelle introuvable", retourner 404
    if (err.message?.includes('introuvable')) {
      return res.status(404).json({ 
        error: 'Parcelle non trouvée',
        searched: { commune, parcel }
      });
    }
    
    return res.status(500).json({ 
      error: err.message || 'Erreur interne',
      searched: { commune, parcel }
    });
  }
});

export default router; 