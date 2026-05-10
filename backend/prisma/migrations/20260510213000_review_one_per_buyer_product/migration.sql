-- Uma avaliação por (utilizador, produto). Mantém a revisão mais antiga se existirem duplicados.

DELETE FROM "Review" r
WHERE r.ctid NOT IN (
  SELECT DISTINCT ON ("userId", "productId") ctid
  FROM "Review"
  ORDER BY "userId", "productId", "createdAt" ASC
);

DROP INDEX IF EXISTS "Review_userId_productId_orderId_key";

CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");
