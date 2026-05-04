-- AlterTable: OAuth opcional (password nullable só para contas criadas por OAuth)
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "facebookId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_facebookId_key" ON "User"("facebookId");

-- AlterTable: rastreio da encomenda
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingCarrier" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;
