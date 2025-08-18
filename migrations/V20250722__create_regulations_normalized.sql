-- Migration: Create regulations_normalized table
-- Version: V20250722
-- Description: Table normalisée pour stocker les règlements communaux extraits des PDFs

CREATE TABLE IF NOT EXISTS regulations_normalized (
  id SERIAL PRIMARY KEY,
  commune_id          TEXT NOT NULL,
  zone_code_source    TEXT NOT NULL,
  zone_code_norm      TEXT NOT NULL,
  indice_u            NUMERIC,
  ibus                NUMERIC,
  emprise_max         NUMERIC,
  h_max_m             NUMERIC,
  niveaux_max         INT,
  toit_types          JSONB,
  pente_toit_min_max  JSONB,
  recul_min_m         NUMERIC,
  remarques           TEXT,
  source_pdf_path     TEXT NOT NULL,
  source_page         INT,
  inserted_at         TIMESTAMP DEFAULT now()
);

-- Index pour les recherches fréquentes par commune et zone
CREATE INDEX idx_regulations_normalized_commune_zone 
ON regulations_normalized (commune_id, zone_code_norm);

-- Index pour retrouver rapidement les données d'une source PDF
CREATE INDEX idx_regulations_normalized_source 
ON regulations_normalized (source_pdf_path, source_page);

-- Contrainte d'unicité pour éviter les doublons
CREATE UNIQUE INDEX idx_regulations_normalized_unique 
ON regulations_normalized (commune_id, zone_code_source, source_pdf_path, source_page);

-- Commentaires sur les colonnes
COMMENT ON TABLE regulations_normalized IS 'Table normalisée des règlements communaux extraits des PDFs';
COMMENT ON COLUMN regulations_normalized.commune_id IS 'Identifiant de la commune (ex: riddes, sion)';
COMMENT ON COLUMN regulations_normalized.zone_code_source IS 'Code de zone original extrait du PDF (ex: R1, T0.3)';
COMMENT ON COLUMN regulations_normalized.zone_code_norm IS 'Code de zone normalisé via dictionnaire (ex: HAB_COLL_1, TOUR_0_3)';
COMMENT ON COLUMN regulations_normalized.indice_u IS 'Indice d''utilisation (ratio 0-1)';
COMMENT ON COLUMN regulations_normalized.ibus IS 'Indice brut d''utilisation du sol (ratio 0-1)';
COMMENT ON COLUMN regulations_normalized.emprise_max IS 'Emprise au sol maximale (ratio 0-1)';
COMMENT ON COLUMN regulations_normalized.h_max_m IS 'Hauteur maximale en mètres';
COMMENT ON COLUMN regulations_normalized.niveaux_max IS 'Nombre maximum de niveaux';
COMMENT ON COLUMN regulations_normalized.toit_types IS 'Types de toiture autorisés (JSON array)';
COMMENT ON COLUMN regulations_normalized.pente_toit_min_max IS 'Pente de toit min/max en degrés {min: x, max: y}';
COMMENT ON COLUMN regulations_normalized.recul_min_m IS 'Recul minimal à la limite en mètres';
COMMENT ON COLUMN regulations_normalized.remarques IS 'Remarques ou conditions spéciales';
COMMENT ON COLUMN regulations_normalized.source_pdf_path IS 'Chemin relatif du PDF source';
COMMENT ON COLUMN regulations_normalized.source_page IS 'Numéro de page dans le PDF source';