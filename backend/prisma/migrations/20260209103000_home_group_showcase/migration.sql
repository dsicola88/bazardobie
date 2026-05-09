-- Homepage groups: vitrine SHOWCASE + badges + CTA personalizável (admin/suporte)

CREATE TYPE "HomeGroupLayoutStyle" AS ENUM ('GRID', 'SHOWCASE');

CREATE TYPE "HomeGroupBadgeType" AS ENUM ('NONE', 'TEXT', 'TIMER');

CREATE TYPE "HomeGroupCardEmphasis" AS ENUM ('BALANCED', 'DISCOUNT', 'RATING');

ALTER TABLE "HomeProductGroup" ADD COLUMN "layoutStyle" "HomeGroupLayoutStyle" NOT NULL DEFAULT 'GRID';

ALTER TABLE "HomeProductGroup" ADD COLUMN "badgeType" "HomeGroupBadgeType" NOT NULL DEFAULT 'NONE';

ALTER TABLE "HomeProductGroup" ADD COLUMN "badgeText" TEXT;

ALTER TABLE "HomeProductGroup" ADD COLUMN "badgeEndAt" TIMESTAMP(3);

ALTER TABLE "HomeProductGroup" ADD COLUMN "ctaLabel" TEXT;

ALTER TABLE "HomeProductGroup" ADD COLUMN "ctaHref" TEXT;

ALTER TABLE "HomeProductGroup" ADD COLUMN "productCardEmphasis" "HomeGroupCardEmphasis" NOT NULL DEFAULT 'BALANCED';

-- Defaults visuais para os dois grupos seed
UPDATE "HomeProductGroup"
SET
  "layoutStyle" = 'SHOWCASE',
  "badgeType" = 'TEXT',
  "badgeText" = 'Seleção editorial · preços em kwanzas',
  "productCardEmphasis" = 'RATING',
  "ctaLabel" = 'Ver selecção em destaque'
WHERE "slug" = 'SUPER_OFERTAS';

UPDATE "HomeProductGroup"
SET
  "layoutStyle" = 'SHOWCASE',
  "badgeType" = 'TEXT',
  "badgeText" = 'Poupe nas melhores ofertas do dia',
  "productCardEmphasis" = 'DISCOUNT',
  "ctaLabel" = 'Ver todas as promoções'
WHERE "slug" = 'PRODUTOS_DESCONTO';
