-- Gateway / pagamentos online nos pedidos
CREATE TYPE "GatewayPayStatus" AS ENUM ('NAO_APLICA', 'AGUARDANDO_PAGAMENTO', 'PROCESSANDO', 'PAGO', 'FALHOU');

ALTER TABLE "Order" ADD COLUMN "gatewayPayStatus" "GatewayPayStatus" NOT NULL DEFAULT 'NAO_APLICA';

ALTER TABLE "Order" ADD COLUMN "gatewayProvider" TEXT;

ALTER TABLE "Order" ADD COLUMN "gatewayExternalId" TEXT;

CREATE INDEX "Order_gatewayPayStatus_idx" ON "Order"("gatewayPayStatus");
