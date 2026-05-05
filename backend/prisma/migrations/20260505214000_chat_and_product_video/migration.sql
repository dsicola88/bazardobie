-- Product optional short demo video
ALTER TABLE "Product" ADD COLUMN "demoVideoUrl" TEXT;

-- Chat message media type
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO');

-- Buyer <-> seller chat per order
CREATE TABLE "OrderChatMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "mediaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderChatMessage_orderId_createdAt_idx" ON "OrderChatMessage"("orderId", "createdAt");
CREATE INDEX "OrderChatMessage_senderId_createdAt_idx" ON "OrderChatMessage"("senderId", "createdAt");

ALTER TABLE "OrderChatMessage" ADD CONSTRAINT "OrderChatMessage_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderChatMessage" ADD CONSTRAINT "OrderChatMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
