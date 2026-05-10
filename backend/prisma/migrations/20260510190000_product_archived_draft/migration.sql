-- ciclo de vida profissional: rascunhos e arquivo pelo vendedor
ALTER TABLE "Product" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Product_archivedAt_idx" ON "Product"("archivedAt");
CREATE INDEX "Product_isDraft_idx" ON "Product"("isDraft");
