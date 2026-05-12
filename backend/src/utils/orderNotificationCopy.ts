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

/** Código de encomenda amigável ou identificador completo (sem truncar). */
export function orderRefForNotification(orderId: string, orderCode: string | null | undefined): string {
  const c = orderCode != null ? String(orderCode).trim() : "";
  if (c !== "") return c;
  return orderId.trim();
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

function buyerHeadlineForNotification(orderRef: string, nextStatus: string): string {
  const suffix = orderRef ? ` · ${orderRef}` : "";
  switch (nextStatus) {
    case "PENDENTE":
      return `Encomenda registada${suffix}`;
    case "CONFIRMADO":
      return `Pedido confirmado pela loja${suffix}`;
    case "EM_PREPARACAO":
      return `Em preparação para envio${suffix}`;
    case "EM_ENTREGA":
      return `Pedido em trânsito${suffix}`;
    case "ENTREGUE":
      return `Pedido entregue${suffix}`;
    case "CANCELADO":
      return `Pedido cancelado${suffix}`;
    default:
      return orderRef ? `Actualização da encomenda · ${orderRef}` : "Actualização da encomenda";
  }
}

function buyerMessageForNotification(orderRef: string, nextStatus: string): string {
  const head = orderRef ? `Referência ${orderRef}. ` : "";
  switch (nextStatus) {
    case "PENDENTE":
      return `${head}Registámos o seu pedido na plataforma. A loja parceira será notificada para confirmar.`;
    case "CONFIRMADO":
      return `${head}A loja confirmou o pedido e deve avançar com a preparação ou envio conforme combinado.`;
    case "EM_PREPARACAO":
      return `${head}O pedido está em preparação antes de seguir para entrega.`;
    case "EM_ENTREGA":
      return `${head}O pedido já seguiu para a morada ou ponto indicado. Pode acompanhar o estado na página do pedido.`;
    case "ENTREGUE":
      return `${head}Marcámos esta encomenda como entregue. Obrigado por comprar no BAZAR DO BIÉ.`;
    case "CANCELADO":
      return `${head}Esta encomenda foi cancelada. Abra o pedido para ver o motivo ou próximos passos.`;
    default:
      return `${head}O estado do pedido foi actualizado. Consulte a ficha para detalhes e chat.`;
  }
}

export function orderStatusChangeBuyerCopy(input: {
  orderRef: string;
  previous: string;
  next: string;
  actorRole: string;
}): { title: string; message: string } {
  const actor = actorLabelPt(input.actorRole);
  const title = buyerHeadlineForNotification(input.orderRef, input.next);
  let message = buyerMessageForNotification(input.orderRef, input.next);
  if (actor.kind === "buyer") {
    message += " (Actualização ligada à sua acção na plataforma.)";
  }
  return { title, message };
}

function vendorHeadlineForNotification(orderRef: string, nextStatus: string): string {
  const suffix = orderRef ? ` · ${orderRef}` : "";
  switch (nextStatus) {
    case "PENDENTE":
      return `Novo pedido${suffix}`;
    case "CONFIRMADO":
      return `Pedido confirmado${suffix}`;
    case "EM_PREPARACAO":
      return `Pedido em preparação${suffix}`;
    case "EM_ENTREGA":
      return `Pedido em trânsito${suffix}`;
    case "ENTREGUE":
      return `Pedido entregue${suffix}`;
    case "CANCELADO":
      return `Pedido cancelado${suffix}`;
    default:
      return orderRef ? `Actualização do pedido · ${orderRef}` : "Actualização do pedido";
  }
}

function vendorMessageForNotification(orderRef: string, nextStatus: string, actorLabel: string): string {
  const head = orderRef ? `Ref. ${orderRef}. ` : "";
  const tail = actorLabel.trim() ? ` Quem registou a mudança: ${actorLabel.trim()}.` : "";
  switch (nextStatus) {
    case "PENDENTE":
      return `${head}Há uma nova encomenda que aguarda confirmação da sua loja.${tail}`;
    case "CONFIRMADO":
      return `${head}O pedido foi confirmado; siga o fluxo normal no painel «Encomendas».${tail}`;
    case "EM_PREPARACAO":
      return `${head}O estado passou a «em preparação». Coordene embalagem e handoff conforme o tipo de envio.${tail}`;
    case "EM_ENTREGA":
      return `${head}O pedido está «em entrega». Mantenha o comprador informado pelo chat se necessário.${tail}`;
    case "ENTREGUE":
      return `${head}O pedido foi marcado como entregue.${tail}`;
    case "CANCELADO":
      return `${head}Este pedido foi cancelado. Consulte a ficha para detalhes.${tail}`;
    default:
      return `${head}O estado do pedido foi actualizado. Consulte «Encomendas» para rastreio e chat.${tail}`;
  }
}

export function orderStatusChangeVendorCopy(input: {
  orderRef: string;
  previous: string;
  next: string;
  actorRole: string;
}): { title: string; message: string } {
  const actor = actorLabelPt(input.actorRole);
  const title = vendorHeadlineForNotification(input.orderRef, input.next);
  const message = vendorMessageForNotification(input.orderRef, input.next, actor.label);
  return { title, message };
}
