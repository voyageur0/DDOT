import { Router } from 'express';
import { getLabel, getLabels } from '../i18n/labelServiceLocal';
import { truncateSentence } from '../i18n/summarizer';

const router = Router();

router.get('/test-labels', async (req, res) => {
  try {
    console.log('🧪 Test des labels...');
    
    // Test de récupération de labels
    const tests = [
      { code: 'R1', type: 'zone' as const },
      { code: 'opb_noise_DS_III', type: 'constraint' as const },
      { code: 'indice_u', type: 'field' as const }
    ];
    
    const results: any[] = [];
    
    for (const test of tests) {
      const labelShort = await getLabel(test.code, test.type, 'fr', false);
      const labelLong = await getLabel(test.code, test.type, 'fr', true);
      
      results.push({
        code: test.code,
        type: test.type,
        label_short: labelShort,
        label_long: labelLong
      });
    }
    
    // Test de troncature
    const longText = "Ceci est un texte très long qui contient beaucoup plus de douze mots et qui devrait être tronqué pour respecter la limite imposée";
    const truncated = await truncateSentence(longText, 12);
    
    // Test de contraintes simulées
    const testConstraints = [
      {
        title: "Hauteur maximale des constructions dans la zone résidentielle R2",
        description: "La hauteur maximale des constructions dans la zone résidentielle est limitée à 12 mètres selon le règlement communal en vigueur",
        category: "Gabarits & reculs"
      },
      {
        title: "Indice de densité (IBUS)",
        description: "L'indice de densité pour la zone résidentielle est fixé à 0.5 selon les dispositions du plan d'aménagement local",
        category: "Densité constructible"
      }
    ];
    
    const normalizedConstraints = [];
    for (const c of testConstraints) {
      normalizedConstraints.push({
        original_title: c.title,
        original_desc: c.description,
        normalized_title: await truncateSentence(c.title, 12),
        normalized_desc: await truncateSentence(c.description, 12),
        title_words: c.title.split(' ').length,
        desc_words: c.description.split(' ').length,
        normalized_title_words: (await truncateSentence(c.title, 12)).split(' ').length,
        normalized_desc_words: (await truncateSentence(c.description, 12)).split(' ').length,
        category: c.category
      });
    }
    
    res.json({
      labels: results,
      truncation_test: {
        original: longText,
        truncated: truncated,
        original_words: longText.split(' ').length,
        truncated_words: truncated.split(' ').length
      },
      constraints_normalization: normalizedConstraints
    });
    
  } catch (error: any) {
    console.error('Erreur test labels:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;