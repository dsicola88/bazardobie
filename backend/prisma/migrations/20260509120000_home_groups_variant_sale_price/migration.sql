-- Preço opcional por variante + secções curatoriais na homepage

ALTER TABLE "ProductVariant" ADD COLUMN "salePrice" DECIMAL(12,2);

CREATE TABLE "HomeProductGroup" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxDisplay" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeProductGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomeProductGroup_slug_key" ON "HomeProductGroup"("slug");

CREATE INDEX "HomeProductGroup_active_sortOrder_idx" ON "HomeProductGroup"("active", "sortOrder");

CREATE TABLE "HomeProductGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomeProductGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomeProductGroupMember_groupId_productId_key" ON "HomeProductGroupMember"("groupId", "productId");

CREATE INDEX "HomeProductGroupMember_groupId_sortOrder_idx" ON "HomeProductGroupMember"("groupId", "sortOrder");

ALTER TABLE "HomeProductGroupMember" ADD CONSTRAINT "HomeProductGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "HomeProductGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeProductGroupMember" ADD CONSTRAINT "HomeProductGroupMember_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "HomeProductGroup" ("id", "slug", "title", "subtitle", "sortOrder", "active", "maxDisplay", "createdAt", "updatedAt")
VALUES
  ('hpg_super_ofertas', 'SUPER_OFERTAS', 'Super ofertas', 'Selecção da equipa para preços destacados.', 10, true, 12, NOW(), NOW()),
  ('hpg_produtos_desconto', 'PRODUTOS_DESCONTO', 'Produtos com desconto', 'Artigos com preço promocional.', 20, true, 12, NOW(), NOW());
