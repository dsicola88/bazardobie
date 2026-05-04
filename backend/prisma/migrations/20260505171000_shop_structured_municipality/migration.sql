-- Localização oficial da loja (município do catálogo Angola)
ALTER TABLE "Shop" ADD COLUMN "municipalityId" TEXT;

CREATE INDEX "Shop_municipalityId_idx" ON "Shop"("municipalityId");

ALTER TABLE "Shop" ADD CONSTRAINT "Shop_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "AngolaMunicipality"("id") ON DELETE SET NULL ON UPDATE CASCADE;
