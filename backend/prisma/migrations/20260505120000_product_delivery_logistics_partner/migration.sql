-- AlterTable
ALTER TABLE "ProductDeliveryOption" ADD COLUMN "logisticsPartnerId" TEXT;

-- CreateIndex
CREATE INDEX "ProductDeliveryOption_logisticsPartnerId_idx" ON "ProductDeliveryOption"("logisticsPartnerId");

-- AddForeignKey
ALTER TABLE "ProductDeliveryOption" ADD CONSTRAINT "ProductDeliveryOption_logisticsPartnerId_fkey" FOREIGN KEY ("logisticsPartnerId") REFERENCES "LogisticsPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
