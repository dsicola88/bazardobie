-- Escrow ledger + disputes (marketplace dinheiro seguro)

CREATE TYPE "EscrowState" AS ENUM (
  'NOT_APPLICABLE',
  'AWAITING_FUNDS',
  'HELD',
  'PENDING_BUYER_CONFIRM',
  'RELEASED',
  'REFUNDED'
);

CREATE TYPE "EscrowReleaseReason" AS ENUM (
  'BUYER_CONFIRMED',
  'AUTO_CONFIRM_TIMEOUT',
  'DISPUTE_FULL_REFUND',
  'DISPUTE_PARTIAL_SETTLEMENT'
);

CREATE TYPE "LedgerEntryKind" AS ENUM (
  'ESCROW_HOLD',
  'RELEASE_TO_SHOP',
  'REFUND_TO_BUYER'
);

CREATE TYPE "DisputeStatus" AS ENUM (
  'OPEN',
  'CLOSED_REJECTED',
  'CLOSED_FULL_REFUND',
  'CLOSED_PARTIAL_REFUND'
);

ALTER TABLE "Order"
  ADD COLUMN "escrowState" "EscrowState" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "buyerConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "escrowAutoConfirmAt" TIMESTAMP(3),
  ADD COLUMN "escrowReleasedAt" TIMESTAMP(3),
  ADD COLUMN "escrowReleaseReason" "EscrowReleaseReason";

UPDATE "Order" SET "escrowState" = CASE
  WHEN "paymentMethod"::text = 'PAGAMENTO_ONLINE'
    AND "gatewayPayStatus"::text = 'PAGO'
    THEN 'HELD'::"EscrowState"
  WHEN "paymentMethod"::text = 'PAGAMENTO_ONLINE'
    THEN 'AWAITING_FUNDS'::"EscrowState"
  ELSE 'NOT_APPLICABLE'::"EscrowState"
END;

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "kind" "LedgerEntryKind" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LedgerEntry_orderId_idx" ON "LedgerEntry"("orderId");
CREATE INDEX "LedgerEntry_shopId_idx" ON "LedgerEntry"("shopId");

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Dispute" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "openedByUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "refundAmount" DECIMAL(12,2),
  "resolutionNote" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolverAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Dispute_orderId_idx" ON "Dispute"("orderId");
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedByUserId_fkey"
  FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolverAdminId_fkey"
  FOREIGN KEY ("resolverAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "LedgerEntry" ("id", "orderId", "shopId", "kind", "amount", "note", "createdAt")
SELECT 
  concat('bk_', "Order"."id"),
  "Order"."id",
  (SELECT i."shopId" FROM "OrderItem" i WHERE i."orderId" = "Order"."id" LIMIT 1),
  'ESCROW_HOLD'::"LedgerEntryKind",
  "Order"."grandTotal",
  'Migração — captura retrospectiva',
  "Order"."createdAt"
FROM "Order"
WHERE "Order"."paymentMethod"::text = 'PAGAMENTO_ONLINE'
  AND "Order"."gatewayPayStatus"::text = 'PAGO'
  AND EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = "Order"."id")
  AND NOT EXISTS (
    SELECT 1 FROM "LedgerEntry" le WHERE le."orderId" = "Order"."id"
  );
