-- Metadados estruturados para UI de notificações.
ALTER TABLE "Notification" ADD COLUMN "payload" JSONB;

-- Dimensões opcionais de avaliação (produto / comunicação / entrega); `rating` = experiência global (obrigatória).
ALTER TABLE "Review" ADD COLUMN "ratingQuality" INTEGER;
ALTER TABLE "Review" ADD COLUMN "ratingSellerCommunication" INTEGER;
ALTER TABLE "Review" ADD COLUMN "ratingDelivery" INTEGER;
