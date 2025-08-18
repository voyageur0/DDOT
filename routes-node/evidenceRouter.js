/**
 * Routes API pour la consultation des preuves et scores de qualité
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialisation Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/evidence/:parcelId
 * Récupère toutes les preuves pour une parcelle
 */
router.get('/:parcelId', async (req, res) => {
  try {
    const { parcelId } = req.params;
    const { field, ref_type } = req.query;

    // Construction de la requête
    let query = supabase
      .from('evidence_items')
      .select(`
        *,
        regulations!evidence_items_ref_id_fkey (
          id,
          commune,
          version,
          validity_from
        ),
        context_layers!evidence_items_ref_id_fkey (
          id,
          layer_name,
          source_url
        )
      `)
      .eq('parcel_id', parcelId)
      .order('reliability', { ascending: true })
      .order('field');

    // Filtres optionnels
    if (field) {
      query = query.eq('field', field);
    }
    if (ref_type) {
      query = query.eq('ref_type', ref_type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erreur récupération evidence:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    // Formater la réponse
    const formattedData = data.map(item => ({
      id: item.id,
      field: item.field,
      value: item.value_num || item.value_text || item.value_json,
      reliability: item.reliability,
      source: formatSource(item),
      comment: item.comment,
      created_at: item.created_at
    }));

    res.json({
      parcel_id: parcelId,
      evidence_count: formattedData.length,
      evidence_items: formattedData
    });

  } catch (error) {
    console.error('Erreur API evidence:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/evidence/:parcelId/quality
 * Récupère le score de qualité pour une parcelle
 */
router.get('/:parcelId/quality', async (req, res) => {
  try {
    const { parcelId } = req.params;
    const { date } = req.query;

    // Requête de base
    let query = supabase
      .from('analysis_quality')
      .select('*')
      .eq('parcel_id', parcelId)
      .order('calc_date', { ascending: false })
      .limit(1);

    // Si date spécifiée
    if (date) {
      query = query.eq('calc_date', date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erreur récupération quality:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ 
        error: 'Aucun score de qualité trouvé pour cette parcelle' 
      });
    }

    const quality = data[0];

    // Calculer des statistiques additionnelles
    const totalEvidence = quality.direct_count + quality.derived_count + 
                         quality.estimated_count + quality.missing_count;
    
    const reliabilityDistribution = {
      direct: quality.direct_count,
      derived: quality.derived_count,
      estimated: quality.estimated_count,
      missing: quality.missing_count
    };

    res.json({
      parcel_id: parcelId,
      calc_date: quality.calc_date,
      scores: {
        global: quality.score_global,
        regulations: quality.score_regulations || null,
        context: quality.score_context || null,
        calculations: quality.score_calculations || null
      },
      reliability_distribution: reliabilityDistribution,
      total_fields: quality.total_fields,
      total_evidence: totalEvidence,
      field_scores: quality.details,
      analysis_version: quality.analysis_version
    });

  } catch (error) {
    console.error('Erreur API quality:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/evidence/:parcelId/summary
 * Résumé consolidé des preuves par champ
 */
router.get('/:parcelId/summary', async (req, res) => {
  try {
    const { parcelId } = req.params;

    // Récupérer toutes les preuves
    const { data: evidence, error: evidenceError } = await supabase
      .from('evidence_items')
      .select('field, reliability, value_num, value_text, ref_type')
      .eq('parcel_id', parcelId);

    if (evidenceError) {
      console.error('Erreur récupération evidence:', evidenceError);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    // Récupérer le score de qualité
    const { data: quality, error: qualityError } = await supabase
      .from('analysis_quality')
      .select('score_global, calc_date')
      .eq('parcel_id', parcelId)
      .order('calc_date', { ascending: false })
      .limit(1);

    if (qualityError) {
      console.error('Erreur récupération quality:', qualityError);
    }

    // Grouper par champ
    const fieldSummary = {};
    for (const item of evidence) {
      if (!fieldSummary[item.field]) {
        fieldSummary[item.field] = {
          value: item.value_num || item.value_text,
          reliability: item.reliability,
          sources: []
        };
      }
      fieldSummary[item.field].sources.push(item.ref_type);
    }

    // Compter par type de source
    const sourceStats = {
      regulation: evidence.filter(e => e.ref_type === 'regulation').length,
      context: evidence.filter(e => e.ref_type === 'context').length,
      calculation: evidence.filter(e => e.ref_type === 'calculation').length
    };

    res.json({
      parcel_id: parcelId,
      quality_score: quality?.[0]?.score_global || null,
      last_analysis: quality?.[0]?.calc_date || null,
      evidence_count: evidence.length,
      source_distribution: sourceStats,
      fields: fieldSummary
    });

  } catch (error) {
    console.error('Erreur API summary:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/evidence/stats
 * Statistiques globales sur la qualité des données
 */
router.get('/stats/global', async (req, res) => {
  try {
    const { commune, date_from, date_to } = req.query;

    // Utiliser la vue v_quality_summary
    let query = supabase
      .from('v_quality_summary')
      .select('*')
      .order('calc_date', { ascending: false })
      .limit(30);

    if (date_from) {
      query = query.gte('calc_date', date_from);
    }
    if (date_to) {
      query = query.lte('calc_date', date_to);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erreur récupération stats:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    // Calculer des métriques agrégées
    const totalParcels = data.reduce((sum, row) => sum + row.parcels_analyzed, 0);
    const avgGlobalScore = data.reduce((sum, row) => sum + row.avg_global_score, 0) / data.length;

    res.json({
      period: {
        from: data[data.length - 1]?.calc_date || null,
        to: data[0]?.calc_date || null
      },
      summary: {
        total_parcels_analyzed: totalParcels,
        average_global_score: Math.round(avgGlobalScore * 100) / 100,
        days_with_data: data.length
      },
      daily_stats: data.map(row => ({
        date: row.calc_date,
        parcels: row.parcels_analyzed,
        scores: {
          global: Math.round(row.avg_global_score * 100) / 100,
          regulations: Math.round(row.avg_regulations_score * 100) / 100,
          context: Math.round(row.avg_context_score * 100) / 100,
          calculations: Math.round(row.avg_calculations_score * 100) / 100
        },
        evidence_distribution: {
          direct: row.total_direct,
          derived: row.total_derived,
          estimated: row.total_estimated,
          missing: row.total_missing
        }
      }))
    });

  } catch (error) {
    console.error('Erreur API stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Helper: Formater la source selon le type
 */
function formatSource(item) {
  switch (item.ref_type) {
    case 'regulation':
      if (item.regulations) {
        return {
          type: 'regulation',
          name: `${item.regulations.commune} v${item.regulations.version}`,
          path: item.source_path
        };
      }
      break;
    
    case 'context':
      if (item.context_layers) {
        return {
          type: 'context',
          name: item.context_layers.layer_name,
          path: item.source_path,
          url: item.context_layers.source_url
        };
      }
      break;
    
    case 'calculation':
      return {
        type: 'calculation',
        name: 'Calcul interne',
        path: item.source_path
      };
  }
  
  return {
    type: item.ref_type,
    path: item.source_path
  };
}

module.exports = router;