import { Router } from 'express';
import axios from 'axios';

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

export default router; 