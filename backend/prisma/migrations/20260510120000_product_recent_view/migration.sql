-- Tabela de vistas recentes por identidade (cliente autenticado ou visitante com X-Cart-Session)

CREATE TABLE "ProductRecentView" (
    "id" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "ProductRecentView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductRecentView_identityKey_productId_key" ON "ProductRecentView"("identityKey", "productId");

CREATE INDEX "ProductRecentView_identityKey_viewedAt_idx" ON "ProductRecentView"("identityKey", "viewedAt");

CREATE INDEX "ProductRecentView_userId_viewedAt_idx" ON "ProductRecentView"("userId", "viewedAt");

ALTER TABLE "ProductRecentView" ADD CONSTRAINT "ProductRecentView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductRecentView" ADD CONSTRAINT "ProductRecentView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
