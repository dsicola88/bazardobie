-- Faixas de frete por distância + localidades (centroides para cálculo)
CREATE TABLE "ShippingDistanceBand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minDistanceKm" DECIMAL(12,3) NOT NULL,
    "maxDistanceKm" DECIMAL(12,3) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingDistanceBand_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShippingDistanceBand_active_sortOrder_idx" ON "ShippingDistanceBand"("active", "sortOrder");

CREATE TABLE "FreightLocality" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DECIMAL(11,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreightLocality_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FreightLocality_province_city_key" ON "FreightLocality"("province", "city");
CREATE INDEX "FreightLocality_province_active_idx" ON "FreightLocality"("province", "active");

ALTER TABLE "Shop" ADD COLUMN "freightOriginLatitude" DECIMAL(11,8);
ALTER TABLE "Shop" ADD COLUMN "freightOriginLongitude" DECIMAL(11,8);

ALTER TABLE "Order" ADD COLUMN "freightComputedDistanceKm" DECIMAL(12,3);
ALTER TABLE "Order" ADD COLUMN "freightDistanceBandId" TEXT;

ALTER TABLE "Order" ADD CONSTRAINT "Order_freightDistanceBandId_fkey" FOREIGN KEY ("freightDistanceBandId") REFERENCES "ShippingDistanceBand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
