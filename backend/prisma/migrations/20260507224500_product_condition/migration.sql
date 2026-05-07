-- Add marketplace product condition (new/used/refurbished).
CREATE TYPE "ProductCondition" AS ENUM (
  'NEW',
  'USED',
  'REFURBISHED'
);

ALTER TABLE "Product"
ADD COLUMN "condition" "ProductCondition" NOT NULL DEFAULT 'NEW',
ADD COLUMN "conditionDetail" TEXT;
