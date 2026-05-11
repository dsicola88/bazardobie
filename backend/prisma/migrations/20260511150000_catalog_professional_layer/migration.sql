-- Camada profissional: unidades, facetas, ranking, aliases, presets, valor numérico indexável

ALTER TABLE "CategoryAttribute" ADD COLUMN "unitCode" TEXT;
ALTER TABLE "CategoryAttribute" ADD COLUMN "facetEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CategoryAttribute" ADD COLUMN "primaryRank" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CategoryAttribute" ADD COLUMN "autoSuggest" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "VariantStructuredValue" ADD COLUMN "numericValue" DECIMAL(18,6);

CREATE INDEX "VariantStructuredValue_attributeId_value_idx" ON "VariantStructuredValue"("attributeId", "value");
CREATE INDEX "VariantStructuredValue_attributeId_numericValue_idx" ON "VariantStructuredValue"("attributeId", "numericValue");

CREATE INDEX "CategoryAttribute_categoryId_facetEnabled_idx" ON "CategoryAttribute"("categoryId", "facetEnabled");

CREATE TABLE "CategoryAttributeAlias" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,

    CONSTRAINT "CategoryAttributeAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoryAttributeAlias_categoryId_normalized_key" ON "CategoryAttributeAlias"("categoryId", "normalized");
CREATE INDEX "CategoryAttributeAlias_attributeId_idx" ON "CategoryAttributeAlias"("attributeId");

ALTER TABLE "CategoryAttributeAlias" ADD CONSTRAINT "CategoryAttributeAlias_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CategoryAttributeAlias" ADD CONSTRAINT "CategoryAttributeAlias_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "CategoryAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CategoryAttributePreset" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CategoryAttributePreset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoryAttributePreset_categoryId_slug_key" ON "CategoryAttributePreset"("categoryId", "slug");
CREATE INDEX "CategoryAttributePreset_categoryId_idx" ON "CategoryAttributePreset"("categoryId");

ALTER TABLE "CategoryAttributePreset" ADD CONSTRAINT "CategoryAttributePreset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CategoryAttributePresetItem" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoryAttributePresetItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoryAttributePresetItem_presetId_attributeId_key" ON "CategoryAttributePresetItem"("presetId", "attributeId");
CREATE INDEX "CategoryAttributePresetItem_presetId_sortOrder_idx" ON "CategoryAttributePresetItem"("presetId", "sortOrder");

ALTER TABLE "CategoryAttributePresetItem" ADD CONSTRAINT "CategoryAttributePresetItem_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "CategoryAttributePreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CategoryAttributePresetItem" ADD CONSTRAINT "CategoryAttributePresetItem_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "CategoryAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
