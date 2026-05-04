-- CreateTable
CREATE TABLE "LogisticsPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nif" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactName" TEXT,
    "province" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogisticsPartner_active_idx" ON "LogisticsPartner"("active");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "logisticsPartnerId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "logisticsPartnerId" TEXT;

-- CreateIndex
CREATE INDEX "Order_logisticsPartnerId_idx" ON "Order"("logisticsPartnerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_logisticsPartnerId_fkey" FOREIGN KEY ("logisticsPartnerId") REFERENCES "LogisticsPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_logisticsPartnerId_fkey" FOREIGN KEY ("logisticsPartnerId") REFERENCES "LogisticsPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
