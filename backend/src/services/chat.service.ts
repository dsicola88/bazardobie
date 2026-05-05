import type { ChatMessageType, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";

type Actor = { userId: string; role: UserRole };

async function assertOrderChatAccess(orderId: string, actor: Actor) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      items: { select: { shop: { select: { userId: true } } } },
    },
  });
  if (!order) throw new HttpError(404, "Pedido não encontrado");

  if (actor.role === "CLIENTE") {
    if (order.userId !== actor.userId) throw new HttpError(403, "Sem acesso ao chat desta encomenda.");
    return;
  }

  if (actor.role === "VENDEDOR") {
    const ownsAnyLine = order.items.some((it) => it.shop.userId === actor.userId);
    if (!ownsAnyLine) throw new HttpError(403, "Este pedido não inclui a sua loja.");
    return;
  }

  throw new HttpError(403, "Chat disponível apenas para comprador e vendedor.");
}

function detectType(mediaUrl?: string, text?: string): ChatMessageType {
  if (mediaUrl && /\.(mp4|webm|mov)(\?.*)?$/i.test(mediaUrl)) return "VIDEO";
  if (mediaUrl) return "IMAGE";
  if (text) return "TEXT";
  return "TEXT";
}

export const chatService = {
  async listOrderMessages(orderId: string, actor: Actor) {
    await assertOrderChatAccess(orderId, actor);
    return prisma.orderChatMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
  },

  async postOrderMessage(orderId: string, actor: Actor, body: { text?: string; mediaUrl?: string }) {
    await assertOrderChatAccess(orderId, actor);
    const text = body.text?.trim() || null;
    const mediaUrl = body.mediaUrl?.trim() || null;
    const type = detectType(mediaUrl ?? undefined, text ?? undefined);
    return prisma.orderChatMessage.create({
      data: {
        orderId,
        senderId: actor.userId,
        text,
        mediaUrl,
        type,
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
  },
};
