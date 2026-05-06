-- Endereço estruturado no perfil do comprador para frete consistente
ALTER TABLE "User"
ADD COLUMN "municipalityId" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "neighborhood" TEXT,
ADD COLUMN "addressLine" TEXT;

CREATE INDEX "User_municipalityId_idx" ON "User"("municipalityId");

ALTER TABLE "User"
ADD CONSTRAINT "User_municipalityId_fkey"
FOREIGN KEY ("municipalityId") REFERENCES "AngolaMunicipality"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
