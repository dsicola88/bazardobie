import type { OrderStatus } from "@prisma/client";

const STATUS_PT: Record<OrderStatus, string> = {
  PENDENTE: "Registado · aguarda confirmação",
  CONFIRMADO: "Confirmado pela loja",
  EM_PREPARACAO: "Em preparação",
  EM_ENTREGA: "Em entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

export function orderStatusLabelPt(status: string | null | undefined): string {
  if (!status || status === "—") return "Estado inicial";
  const k = status as OrderStatus;
  return STATUS_PT[k] ?? status;
}

export function actorLabelPt(actorRole: string): { label: string; kind: "buyer" | "seller" | "platform" | "support" | "logistics" | "other" } {
  switch (actorRole) {
    case "CLIENTE":
      return { label: "Comprador", kind: "buyer" };
    case "VENDEDOR":
      return { label: "Loja parceira", kind: "seller" };
    case "ADMIN":
    case "SUPORTE":
      return { label: "Equipa BAZAR DO BIÉ", kind: "support" };
    case "LOGISTICA":
      return { label: "Logística da plataforma", kind: "logistics" };
    default:
      return { label: "Plataforma", kind: "platform" };
  }
}

export function orderStatusChangeBuyerCopy(input: {
  orderRef: string;
  previous: string;
  next: string;
  actorRole: string;
}): { title: string; message: string } {
  const from = orderStatusLabelPt(input.previous);
  const to = orderStatusLabelPt(input.next);
  const actor = actorLabelPt(input.actorRole);
  const title = `Encomenda ${input.orderRef}: ${to}`;
  let message = `O estado do seu pedido passou de «${from}» para «${to}».`;
  if (actor.kind === "buyer") {
    message += " Esta actualização está ligada à sua própria acção na plataforma.";
  } else if (actor.kind === "seller") {
    message += " A loja parceira actualizou o progresso.";
  } else if (actor.kind === "logistics") {
    message += " A logística da plataforma actualizou o envio.";
  } else {
    message += ` ${actor.label} actualizou o estado.`;
  }
  message += " Abra a ficha do pedido para ver detalhes, prazos e chat.";
  return { title, message };
}

export function orderStatusChangeVendorCopy(input: {
  orderRef: string;
  previous: string;
  next: string;
  actorRole: string;
}): { title: string; message: string } {
  const from = orderStatusLabelPt(input.previous);
  const to = orderStatusLabelPt(input.next);
  const actor = actorLabelPt(input.actorRole);
  const title = `Pedido ${input.orderRef} · ${to}`;
  let message = `O estado passou de «${from}» para «${to}».`;
  message += ` Quem actualizou: ${actor.label}.`;
  message += " Consulte «Encomendas» no painel comercial para rastreio e chat com o comprador.";
  return { title, message };
}
