-- Atributos por categoria + valores por variante (catálogo marketplace)
CREATE TYPE "CategoryAttributeInputType" AS ENUM ('TEXT', 'NUMBER', 'SELECT');

CREATE TABLE "CategoryAttribute" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "inputType" "CategoryAttributeInputType" NOT NULL DEFAULT 'TEXT',
    "optionsJson" TEXT,
    "helpText" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoryAttribute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoryAttribute_categoryId_key_key" ON "CategoryAttribute"("categoryId", "key");
CREATE INDEX "CategoryAttribute_categoryId_idx" ON "CategoryAttribute"("categoryId");

ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VariantStructuredValue" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" VARCHAR(500) NOT NULL,

    CONSTRAINT "VariantStructuredValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VariantStructuredValue_variantId_attributeId_key" ON "VariantStructuredValue"("variantId", "attributeId");
CREATE INDEX "VariantStructuredValue_variantId_idx" ON "VariantStructuredValue"("variantId");
CREATE INDEX "VariantStructuredValue_attributeId_idx" ON "VariantStructuredValue"("attributeId");

ALTER TABLE "VariantStructuredValue" ADD CONSTRAINT "VariantStructuredValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VariantStructuredValue" ADD CONSTRAINT "VariantStructuredValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "CategoryAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
