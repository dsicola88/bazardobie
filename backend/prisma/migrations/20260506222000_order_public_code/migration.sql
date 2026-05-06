-- Código público de encomenda gerado no backend.
ALTER TABLE "Order" ADD COLUMN "orderCode" TEXT;
CREATE UNIQUE INDEX "Order_orderCode_key" ON "Order"("orderCode");
