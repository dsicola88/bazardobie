-- Angola: província / município estrutural + pontos fixos para frete/recolha (sem texto livre no cálculo)
CREATE TABLE "AngolaProvince" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AngolaProvince_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AngolaProvince_code_key" ON "AngolaProvince"("code");
CREATE INDEX "AngolaProvince_active_sortOrder_idx" ON "AngolaProvince"("active", "sortOrder");

CREATE TABLE "AngolaMunicipality" (
    "id" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "latitude" DECIMAL(11,8),
    "longitude" DECIMAL(11,8),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AngolaMunicipality_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AngolaMunicipality_provinceId_code_key" ON "AngolaMunicipality"("provinceId", "code");
CREATE INDEX "AngolaMunicipality_provinceId_active_sortOrder_idx" ON "AngolaMunicipality"("provinceId", "active", "sortOrder");

ALTER TABLE "AngolaMunicipality" ADD CONSTRAINT "AngolaMunicipality_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "AngolaProvince"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DeliveryPickupPoint" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "refCode" TEXT,
    "latitude" DECIMAL(11,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryPickupPoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryPickupPoint_municipalityId_active_idx" ON "DeliveryPickupPoint"("municipalityId", "active");

ALTER TABLE "DeliveryPickupPoint" ADD CONSTRAINT "DeliveryPickupPoint_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "AngolaMunicipality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Pedido: destino por ID de município (snapshot textual conservado em shippingProvince/shippingCity)
ALTER TABLE "Order" ADD COLUMN "shippingMunicipalityId" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingPickupPointId" TEXT;
ALTER TABLE "Order" ALTER COLUMN "shippingAddress" DROP NOT NULL;

CREATE INDEX "Order_shippingMunicipalityId_idx" ON "Order"("shippingMunicipalityId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingMunicipalityId_fkey" FOREIGN KEY ("shippingMunicipalityId") REFERENCES "AngolaMunicipality"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingPickupPointId_fkey" FOREIGN KEY ("shippingPickupPointId") REFERENCES "DeliveryPickupPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Zona de frete opcionalmente amarrada a um município (prioridade sobre texto legado province/city)
ALTER TABLE "ShippingZone" ADD COLUMN "municipalityId" TEXT;

CREATE UNIQUE INDEX "ShippingZone_municipalityId_key" ON "ShippingZone"("municipalityId");

ALTER TABLE "ShippingZone" ADD CONSTRAINT "ShippingZone_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "AngolaMunicipality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ShippingZone_municipalityId_idx" ON "ShippingZone"("municipalityId");

-- Âncoras GPS modo distância → município
ALTER TABLE "FreightLocality" ADD COLUMN "municipalityId" TEXT;

CREATE UNIQUE INDEX "FreightLocality_municipalityId_key" ON "FreightLocality"("municipalityId");

ALTER TABLE "FreightLocality" ADD CONSTRAINT "FreightLocality_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "AngolaMunicipality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "FreightLocality_municipalityId_idx" ON "FreightLocality"("municipalityId");
