-- Credibilidade em 3 níveis (Shop)

ALTER TABLE "Shop" ADD COLUMN "ownerResponsibleName" TEXT;

UPDATE "Shop" s
SET "ownerResponsibleName" = u."name"
FROM "User" u
WHERE u.id = s."userId";

UPDATE "Shop" SET "ownerResponsibleName" = 'Responsável' WHERE "ownerResponsibleName" IS NULL OR TRIM("ownerResponsibleName") = '';

ALTER TABLE "Shop" ALTER COLUMN "ownerResponsibleName" SET NOT NULL;

UPDATE "Shop" SET "whatsapp" = COALESCE(NULLIF(TRIM("whatsapp"), ''), "phone");

ALTER TABLE "Shop" ALTER COLUMN "whatsapp" SET NOT NULL;

ALTER TABLE "Shop" ADD COLUMN "tier1CompletedAt" TIMESTAMP(3);

UPDATE "Shop" SET "tier1CompletedAt" = "createdAt" WHERE "tier1CompletedAt" IS NULL AND "isApproved" = true;

UPDATE "Shop" SET "tier1CompletedAt" = CURRENT_TIMESTAMP WHERE "tier1CompletedAt" IS NULL;

ALTER TABLE "Shop" ADD COLUMN "biPhotoUrl" TEXT;

ALTER TABLE "Shop" ADD COLUMN "selfiePhotoUrl" TEXT;

ALTER TABLE "Shop" ADD COLUMN "storePhotoUrl" TEXT;

ALTER TABLE "Shop" ADD COLUMN "tier2SubmittedAt" TIMESTAMP(3);

ALTER TABLE "Shop" ADD COLUMN "tier2ApprovedAt" TIMESTAMP(3);

ALTER TABLE "Shop" ADD COLUMN "tier2RejectedReason" TEXT;

ALTER TABLE "Shop" ADD COLUMN "nif" TEXT;

ALTER TABLE "Shop" ADD COLUMN "companyDocUrl" TEXT;

ALTER TABLE "Shop" ADD COLUMN "bankHolderName" TEXT;

ALTER TABLE "Shop" ADD COLUMN "bankName" TEXT;

ALTER TABLE "Shop" ADD COLUMN "bankIban" TEXT;

ALTER TABLE "Shop" ADD COLUMN "tier3SubmittedAt" TIMESTAMP(3);

ALTER TABLE "Shop" ADD COLUMN "tier3ApprovedAt" TIMESTAMP(3);

ALTER TABLE "Shop" ADD COLUMN "tier3RejectedReason" TEXT;

ALTER TABLE "Shop" ADD COLUMN "searchRankBoost" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Shop_tier2SubmittedAt_idx" ON "Shop"("tier2SubmittedAt");

CREATE INDEX "Shop_tier3SubmittedAt_idx" ON "Shop"("tier3SubmittedAt");

CREATE INDEX "Shop_searchRankBoost_idx" ON "Shop"("searchRankBoost");
