-- Frete fixo por zona administrativa (província + cidade na morada do cliente)
CREATE TABLE "ShippingZone" (
    "id" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "label" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShippingZone_province_city_key" ON "ShippingZone"("province", "city");
CREATE INDEX "ShippingZone_active_sortOrder_idx" ON "ShippingZone"("active", "sortOrder");

ALTER TABLE "Order" ADD COLUMN "shippingNeighborhood" TEXT;
ALTER TABLE "Order" ADD COLUMN "freightShippingZoneId" TEXT;

ALTER TABLE "Order" ADD CONSTRAINT "Order_freightShippingZoneId_fkey" FOREIGN KEY ("freightShippingZoneId") REFERENCES "ShippingZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
