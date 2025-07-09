-- =================================================================
-- MIGRATION INITIALE SUPABASE - PROJET DDOT
-- =================================================================

-- Extension pour UUID (optionnel, Supabase l'active par défaut)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================
-- TABLE USERS
-- =================================================================
CREATE TABLE IF NOT EXISTS "Users" (
    "id" SERIAL PRIMARY KEY,
    "email" VARCHAR(120) UNIQUE NOT NULL,
    "passwordHash" VARCHAR(128) NOT NULL,
    "stripeCustomerId" VARCHAR(100),
    "stripeSubscriptionId" VARCHAR(100),
    "isPremium" BOOLEAN DEFAULT false,
    "subscriptionEndDate" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "Users"("email");
CREATE INDEX IF NOT EXISTS "idx_users_stripe_customer" ON "Users"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "idx_users_premium" ON "Users"("isPremium");

-- =================================================================
-- TABLE DOCUMENTS
-- =================================================================
CREATE TABLE IF NOT EXISTS "Documents" (
    "id" SERIAL PRIMARY KEY,
    "filename" VARCHAR(255) NOT NULL,
    "originalFilename" VARCHAR(255),
    "commune" VARCHAR(100),
    "documentType" VARCHAR(50) DEFAULT 'reglement',
    "rawText" TEXT,
    "extractedData" JSONB,
    "userId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS "idx_documents_user" ON "Documents"("userId");
CREATE INDEX IF NOT EXISTS "idx_documents_commune" ON "Documents"("commune");
CREATE INDEX IF NOT EXISTS "idx_documents_type" ON "Documents"("documentType");
CREATE INDEX IF NOT EXISTS "idx_documents_extracted_data" ON "Documents" USING GIN ("extractedData");

-- =================================================================
-- TABLE DOCUMENT EMBEDDINGS
-- =================================================================
CREATE TABLE IF NOT EXISTS "DocumentEmbeddings" (
    "id" SERIAL PRIMARY KEY,
    "documentId" INTEGER NOT NULL REFERENCES "Documents"("id") ON DELETE CASCADE,
    "chunkIndex" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    "embedding" TEXT, -- Stockage des vecteurs en JSON
    "metadata" JSONB
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS "idx_embeddings_document" ON "DocumentEmbeddings"("documentId");
CREATE INDEX IF NOT EXISTS "idx_embeddings_chunk" ON "DocumentEmbeddings"("documentId", "chunkIndex");
CREATE INDEX IF NOT EXISTS "idx_embeddings_metadata" ON "DocumentEmbeddings" USING GIN ("metadata");

-- =================================================================
-- TABLE ANALYSES
-- =================================================================
CREATE TABLE IF NOT EXISTS "Analyses" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "documentId" INTEGER NOT NULL REFERENCES "Documents"("id") ON DELETE CASCADE,
    "analysisType" VARCHAR(50) NOT NULL,
    "inputData" JSONB,
    "result" TEXT,
    "tokensUsed" INTEGER,
    "costUsd" FLOAT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS "idx_analyses_user" ON "Analyses"("userId");
CREATE INDEX IF NOT EXISTS "idx_analyses_document" ON "Analyses"("documentId");
CREATE INDEX IF NOT EXISTS "idx_analyses_type" ON "Analyses"("analysisType");
CREATE INDEX IF NOT EXISTS "idx_analyses_created" ON "Analyses"("createdAt");

-- =================================================================
-- ROW LEVEL SECURITY (RLS) - SÉCURITÉ ESSENTIELLE
-- =================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentEmbeddings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Analyses" ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- POLITIQUES RLS POUR USERS
-- =================================================================

-- Les utilisateurs peuvent voir et modifier seulement leurs propres données
CREATE POLICY "users_select_own" ON "Users"
    FOR SELECT USING (auth.uid()::text = "id"::text);

CREATE POLICY "users_update_own" ON "Users"
    FOR UPDATE USING (auth.uid()::text = "id"::text);

-- Permettre l'insertion pour l'enregistrement (géré par auth)
CREATE POLICY "users_insert_own" ON "Users"
    FOR INSERT WITH CHECK (true);

-- =================================================================
-- POLITIQUES RLS POUR DOCUMENTS
-- =================================================================

-- Les utilisateurs peuvent voir seulement leurs propres documents
CREATE POLICY "documents_select_own" ON "Documents"
    FOR SELECT USING (auth.uid()::text = "userId"::text);

CREATE POLICY "documents_insert_own" ON "Documents"
    FOR INSERT WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "documents_update_own" ON "Documents"
    FOR UPDATE USING (auth.uid()::text = "userId"::text);

CREATE POLICY "documents_delete_own" ON "Documents"
    FOR DELETE USING (auth.uid()::text = "userId"::text);

-- =================================================================
-- POLITIQUES RLS POUR DOCUMENT EMBEDDINGS
-- =================================================================

-- Les embeddings suivent les droits du document parent
CREATE POLICY "embeddings_select_via_document" ON "DocumentEmbeddings"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "Documents" 
            WHERE "Documents"."id" = "DocumentEmbeddings"."documentId" 
            AND auth.uid()::text = "Documents"."userId"::text
        )
    );

CREATE POLICY "embeddings_insert_via_document" ON "DocumentEmbeddings"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "Documents" 
            WHERE "Documents"."id" = "DocumentEmbeddings"."documentId" 
            AND auth.uid()::text = "Documents"."userId"::text
        )
    );

CREATE POLICY "embeddings_update_via_document" ON "DocumentEmbeddings"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM "Documents" 
            WHERE "Documents"."id" = "DocumentEmbeddings"."documentId" 
            AND auth.uid()::text = "Documents"."userId"::text
        )
    );

CREATE POLICY "embeddings_delete_via_document" ON "DocumentEmbeddings"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM "Documents" 
            WHERE "Documents"."id" = "DocumentEmbeddings"."documentId" 
            AND auth.uid()::text = "Documents"."userId"::text
        )
    );

-- =================================================================
-- POLITIQUES RLS POUR ANALYSES
-- =================================================================

-- Les utilisateurs peuvent voir seulement leurs propres analyses
CREATE POLICY "analyses_select_own" ON "Analyses"
    FOR SELECT USING (auth.uid()::text = "userId"::text);

CREATE POLICY "analyses_insert_own" ON "Analyses"
    FOR INSERT WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "analyses_update_own" ON "Analyses"
    FOR UPDATE USING (auth.uid()::text = "userId"::text);

CREATE POLICY "analyses_delete_own" ON "Analyses"
    FOR DELETE USING (auth.uid()::text = "userId"::text);

-- =================================================================
-- TRIGGERS POUR UPDATED_AT AUTOMATIQUE
-- =================================================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Appliquer le trigger aux tables qui ont updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "Users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON "Documents"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analyses_updated_at BEFORE UPDATE ON "Analyses"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- COMMENTAIRES POUR LA DOCUMENTATION
-- =================================================================

COMMENT ON TABLE "Users" IS 'Utilisateurs de l''application avec gestion des abonnements premium';
COMMENT ON TABLE "Documents" IS 'Documents PDF uploadés par les utilisateurs (règlements communaux)';
COMMENT ON TABLE "DocumentEmbeddings" IS 'Embeddings vectoriels des chunks de documents pour la recherche sémantique';
COMMENT ON TABLE "Analyses" IS 'Analyses IA effectuées sur les documents (résumés, questions, etc.)';

-- =================================================================
-- VUES UTILES (OPTIONNEL)
-- =================================================================

-- Vue pour les statistiques utilisateur
CREATE OR REPLACE VIEW "UserStats" AS
SELECT 
    u."id",
    u."email",
    u."isPremium",
    COUNT(DISTINCT d."id") as "documentCount",
    COUNT(DISTINCT a."id") as "analysisCount",
    MAX(a."createdAt") as "lastAnalysisDate"
FROM "Users" u
LEFT JOIN "Documents" d ON u."id" = d."userId"
LEFT JOIN "Analyses" a ON u."id" = a."userId"
GROUP BY u."id", u."email", u."isPremium";

-- =================================================================
-- FIN DE LA MIGRATION
-- =================================================================

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE 'Migration Supabase DDOT terminée avec succès !';
    RAISE NOTICE 'Row Level Security (RLS) activé sur toutes les tables.';
    RAISE NOTICE 'N''oubliez pas de configurer l''authentification Supabase.';
END $$; 