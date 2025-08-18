-- Migration: Add migrated column to regulations_normalized
-- Version: V20250722_2
-- Description: Ajoute une colonne pour tracker les lignes déjà migrées vers le nouveau modèle

-- Ajouter la colonne migrated si elle n'existe pas
ALTER TABLE regulations_normalized 
ADD COLUMN IF NOT EXISTS migrated boolean DEFAULT false;

-- Index pour filtrer rapidement les lignes non migrées
CREATE INDEX IF NOT EXISTS idx_regulations_normalized_migrated 
ON regulations_normalized(migrated) 
WHERE migrated = false;

-- Commentaire
COMMENT ON COLUMN regulations_normalized.migrated IS 'Indique si la ligne a été migrée vers le nouveau modèle unifié';