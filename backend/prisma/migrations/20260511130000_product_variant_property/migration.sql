-- Características por variante (rótulo/valor): género, material, etc.
CREATE TABLE "ProductVariantProperty" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariantProperty_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductVariantProperty_variantId_idx" ON "ProductVariantProperty"("variantId");

ALTER TABLE "ProductVariantProperty" ADD CONSTRAINT "ProductVariantProperty_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
