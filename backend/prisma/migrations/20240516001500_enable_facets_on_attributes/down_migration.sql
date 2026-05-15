-- Down Migration: Restaurar facetEnabled ao estado original (rollback seguro)
-- Reverte as alterações da migration principal usando backup
-- Objetivo: Restaurar estado anterior exato sem afetar atributos previamente ativos

-- Passo 1: Restaurar estado original a partir do backup
UPDATE "CategoryAttribute" 
SET "facetEnabled" = "facetEnabled_backup"
WHERE "facetEnabled_backup" IS NOT NULL;

-- Passo 2: Remover coluna temporária de backup
ALTER TABLE "CategoryAttribute" DROP COLUMN "facetEnabled_backup";
