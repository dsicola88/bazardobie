/**
 * Executa um lote da fila de e-mails (útil com cron externo).
 * Desligue ENABLE_EMAIL_QUEUE_PROCESSOR na API se só usar este comando.
 */
import { prisma } from "../src/lib/prisma.js";
import { emailOutboxService } from "../src/services/emailOutbox.service.js";

async function main() {
  const out = await emailOutboxService.processEmailQueueBatch(40);
  console.log("[email-queue-once]", out);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
