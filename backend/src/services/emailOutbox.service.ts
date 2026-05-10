import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { mailerService } from "./mailer.service.js";

const BATCH_DEFAULT = 12;

export const emailOutboxService = {
  /**
   * Enfileira e-mail transaccional. `dedupeKey` + `templateKey` únicos evitam duplicados (ex.: mesmo checkout).
   */
  async enqueueTransactionalEmail(input: {
    templateKey: string;
    dedupeKey: string;
    toEmail: string;
    toName?: string | null;
    subject: string;
    html: string;
    text?: string;
    scheduledAt?: Date;
  }): Promise<{ created: boolean }> {
    try {
      await prisma.emailOutbox.create({
        data: {
          templateKey: input.templateKey,
          dedupeKey: input.dedupeKey,
          toEmail: input.toEmail,
          toName: input.toName?.trim() || null,
          subject: input.subject,
          htmlBody: input.html,
          textBody: input.text?.trim() || null,
          scheduledAt: input.scheduledAt ?? new Date(),
        },
      });
      return { created: true };
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { created: false };
      }
      throw e;
    }
  },

  async processEmailQueueBatch(limit = BATCH_DEFAULT): Promise<{ processed: number; sent: number; failed: number }> {
    if (!mailerService.isDeliveryConfigured()) {
      return { processed: 0, sent: 0, failed: 0 };
    }

    const now = new Date();
    const pending = await prisma.emailOutbox.findMany({
      where: {
        status: "PENDING",
        scheduledAt: { lte: now },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    let sent = 0;
    let failed = 0;

    for (const row of pending) {
      const claim = await prisma.emailOutbox.updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: "SENDING" },
      });
      if (claim.count !== 1) continue;

      try {
        await mailerService.sendRawEmail({
          to: row.toEmail,
          toName: row.toName,
          subject: row.subject,
          html: row.htmlBody,
          text: row.textBody ?? undefined,
        });
        await prisma.emailOutbox.update({
          where: { id: row.id },
          data: { status: "SENT", sentAt: new Date(), lastError: null },
        });
        sent += 1;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const attempts = row.attempts + 1;
        const giveUp = attempts >= row.maxAttempts;
        const backoffMs = Math.min(900_000, Math.pow(2, Math.min(attempts, 8)) * 15_000);
        await prisma.emailOutbox.update({
          where: { id: row.id },
          data: {
            status: giveUp ? "FAILED" : "PENDING",
            attempts,
            lastError: msg.slice(0, 4000),
            scheduledAt: giveUp ? row.scheduledAt : new Date(Date.now() + backoffMs),
          },
        });
        failed += 1;
      }
    }

    return { processed: pending.length, sent, failed };
  },
};
