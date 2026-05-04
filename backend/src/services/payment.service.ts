import { randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { GatewayPayStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { env } from "../config/env.js";
import { recordHoldAfterOnlinePaymentPaid } from "./escrow.service.js";

const SESSION_MIN = 20;

type PayMockPayload = JwtPayload & {
  pmock: true;
  gid: string;
  uid: string;
  ext: string;
};

function parseMockPayload(raw: string): PayMockPayload | null {
  try {
    const decoded = jwt.verify(raw.trim(), env.JWT_SECRET);
    if (typeof decoded !== "object" || decoded === null) return null;
    const p = decoded as PayMockPayload & Record<string, unknown>;
    if (p.pmock !== true) return null;
    if (!p.gid || !p.uid || !p.ext || typeof p.gid !== "string" || typeof p.uid !== "string" || typeof p.ext !== "string") {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export const paymentService = {
  /** Sessão MOCK; PayPal/Multicaixa retornará 501 até integrar SDK/webhook. */
  async createCheckoutGroupSession(userId: string, checkoutGroupId: string, provider: "MOCK" | "PAYPAL") {
    if (provider === "PAYPAL") {
      throw new HttpError(
        501,
        "PayPal ou Multicaixa Express ainda não ligados ao servidor. Para testar use provider MOCK."
      );
    }

    const orders = await prisma.order.findMany({
      where: { checkoutGroupId, userId },
    });

    if (orders.length === 0) {
      throw new HttpError(404, "Grupo de checkout não encontrado ou não pertence a esta conta");
    }

    if (orders.some((o) => o.paymentMethod !== PaymentMethod.PAGAMENTO_ONLINE)) {
      throw new HttpError(
        400,
        "Este grupo não usa pagamento online — não é preciso iniciar sessão no gateway."
      );
    }

    if (orders.every((o) => o.gatewayPayStatus === GatewayPayStatus.PAGO)) {
      throw new HttpError(400, "Este grupo já está pago.");
    }

    if (orders.some((o) => o.gatewayPayStatus === GatewayPayStatus.FALHOU)) {
      throw new HttpError(400, "Pedido marcado como pagamento falhado — crie novo checkout ou contacte suporte.");
    }

    const ext = randomUUID();

    await prisma.order.updateMany({
      where: {
        checkoutGroupId,
        userId,
        paymentMethod: PaymentMethod.PAGAMENTO_ONLINE,
      },
      data: {
        gatewayProvider: "MOCK",
        gatewayExternalId: ext,
        gatewayPayStatus: GatewayPayStatus.PROCESSANDO,
      },
    });

    const issued = jwt.sign(
      {
        pmock: true,
        gid: checkoutGroupId,
        uid: userId,
        ext,
      },
      env.JWT_SECRET,
      { expiresIn: `${SESSION_MIN}m` } as SignOptions
    );

    const approveUrl = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/payments/mock/callback?token=${encodeURIComponent(issued)}`;

    return {
      provider: "MOCK" as const,
      approveUrl,
      gatewayExternalId: ext,
      expiresInMinutes: SESSION_MIN,
      message:
        "Em produção esta URL será o redirect oficial (PayPal, Multicaixa, etc.). O estado ficará atualizado por webhook.",
    };
  },

  /** Após clicar «Pagar» no mock do fornecedor; devolve sempre redirect URL seguro no controller. */
  async finalizeMockFromToken(rawToken: string): Promise<{ ok: true; gid: string } | { ok: false }> {
    const payload = parseMockPayload(rawToken);
    if (!payload) return { ok: false };

    const res = await prisma.order.updateMany({
      where: {
        checkoutGroupId: payload.gid,
        userId: payload.uid,
        gatewayExternalId: payload.ext,
        paymentMethod: PaymentMethod.PAGAMENTO_ONLINE,
        gatewayPayStatus: { in: [GatewayPayStatus.PROCESSANDO, GatewayPayStatus.AGUARDANDO_PAGAMENTO] },
      },
      data: { gatewayPayStatus: GatewayPayStatus.PAGO },
    });

    if (res.count === 0) return { ok: false };
    await recordHoldAfterOnlinePaymentPaid(payload.gid, payload.uid);
    return { ok: true, gid: payload.gid };
  },

  /** Estado agregado do gateway para ecrãs de cliente */
  async getGroupGatewayOverview(userId: string, checkoutGroupId: string) {
    const rows = await prisma.order.findMany({
      where: { checkoutGroupId, userId },
      select: {
        id: true,
        paymentMethod: true,
        gatewayPayStatus: true,
        gatewayProvider: true,
        gatewayExternalId: true,
      },
    });
    if (rows.length === 0) throw new HttpError(404, "Grupo não encontrado");
    return { checkoutGroupId, orders: rows };
  },
};
