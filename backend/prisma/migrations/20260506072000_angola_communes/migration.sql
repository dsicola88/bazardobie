CREATE TABLE "AngolaCommune" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AngolaCommune_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AngolaCommune_municipalityId_code_key" ON "AngolaCommune"("municipalityId", "code");
CREATE INDEX "AngolaCommune_municipalityId_active_sortOrder_idx" ON "AngolaCommune"("municipalityId", "active", "sortOrder");

ALTER TABLE "AngolaCommune"
ADD CONSTRAINT "AngolaCommune_municipalityId_fkey"
FOREIGN KEY ("municipalityId") REFERENCES "AngolaMunicipality"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
