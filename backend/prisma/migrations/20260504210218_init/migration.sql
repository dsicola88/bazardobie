-- DropIndex
DROP INDEX "Order_gatewayPayStatus_idx";

-- AlterTable
ALTER TABLE "AngolaMunicipality" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AngolaProvince" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DeliveryPickupPoint" ALTER COLUMN "updatedAt" DROP DEFAULT;
