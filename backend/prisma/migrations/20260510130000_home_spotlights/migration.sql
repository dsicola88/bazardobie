-- CreateEnum
CREATE TYPE "HomeSpotlightLayout" AS ENUM ('GRID_2X2', 'HERO_THREE', 'ROW_SCROLL');

-- CreateTable
CREATE TABLE "HomeSpotlightSection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "layout" "HomeSpotlightLayout" NOT NULL DEFAULT 'GRID_2X2',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cardAccent" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "maxTiles" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSpotlightSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeSpotlightTile" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT NOT NULL,
    "label" TEXT,
    "href" TEXT NOT NULL,
    "captionBg" TEXT,

    CONSTRAINT "HomeSpotlightTile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomeSpotlightSection_slug_key" ON "HomeSpotlightSection"("slug");

-- CreateIndex
CREATE INDEX "HomeSpotlightSection_active_sortOrder_idx" ON "HomeSpotlightSection"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "HomeSpotlightTile_sectionId_sortOrder_idx" ON "HomeSpotlightTile"("sectionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "HomeSpotlightTile" ADD CONSTRAINT "HomeSpotlightTile_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HomeSpotlightSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
