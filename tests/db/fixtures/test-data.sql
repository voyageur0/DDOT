-- Fixtures pour les tests
-- Données de test pour peupler la base locale Supabase

-- Communes de test
INSERT INTO communes (id, name, bfs_code) VALUES
  ('123e4567-e89b-12d3-a456-426614174000', 'riddes', 6033),
  ('123e4567-e89b-12d3-a456-426614174001', 'sion', 6266),
  ('123e4567-e89b-12d3-a456-426614174002', 'martigny', 6136)
ON CONFLICT (name) DO NOTHING;

-- Zones de test
INSERT INTO zones (id, commune_id, code_norm, label) VALUES
  ('223e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174000', 'HAB_RES_20', 'Zone résidentielle 20'),
  ('223e4567-e89b-12d3-a456-426614174001', '123e4567-e89b-12d3-a456-426614174000', 'HAB_COLL_3', 'Zone habitat collectif 3'),
  ('223e4567-e89b-12d3-a456-426614174002', '123e4567-e89b-12d3-a456-426614174001', 'CENTRE_1', 'Zone centre-ville'),
  ('223e4567-e89b-12d3-a456-426614174003', '123e4567-e89b-12d3-a456-426614174002', 'ZONE_MIXTE', 'Zone mixte')
ON CONFLICT (commune_id, code_norm) DO NOTHING;

-- Sources de test
INSERT INTO regulation_sources (id, pdf_path, pdf_page) VALUES
  ('423e4567-e89b-12d3-a456-426614174000', 'data/pdfs/reglement_riddes.pdf', 42),
  ('423e4567-e89b-12d3-a456-426614174001', 'data/pdfs/RCCZ_Sion.pdf', 15)
ON CONFLICT DO NOTHING;

-- Règlements de test
INSERT INTO regulations (
  zone_id, version, indice_u, ibus, emprise_max, h_max_m, 
  niveaux_max, recul_min_m, source_id, is_active
) VALUES
  -- Riddes HAB_RES_20
  ('223e4567-e89b-12d3-a456-426614174000', '2024-01-01', 0.5, 0.6, 0.4, 12, 3, 5, '423e4567-e89b-12d3-a456-426614174000', true),
  -- Riddes HAB_COLL_3
  ('223e4567-e89b-12d3-a456-426614174001', '2024-01-01', 0.8, 1.0, 0.5, 18, 5, 6, '423e4567-e89b-12d3-a456-426614174000', true),
  -- Sion CENTRE_1
  ('223e4567-e89b-12d3-a456-426614174002', '2024-01-01', 1.2, 1.5, 0.7, 25, 7, 4, '423e4567-e89b-12d3-a456-426614174001', true),
  -- Version ancienne (inactive)
  ('223e4567-e89b-12d3-a456-426614174000', '2023-01-01', 0.4, 0.5, 0.3, 10, 3, 5, '423e4567-e89b-12d3-a456-426614174000', false)
ON CONFLICT (zone_id, version) DO NOTHING;

-- Rafraîchir la vue matérialisée
REFRESH MATERIALIZED VIEW v_regulations_latest;