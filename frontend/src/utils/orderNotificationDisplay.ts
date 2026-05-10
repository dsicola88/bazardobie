import { etiquetaEstadoPedidoCliente } from "./buyerOrderFilters.js";

export type OrderStatusNotificationPayload = {
  kind: "ORDER_STATUS";
  audience?: string;
  orderId?: string;
  orderCode?: string | null;
  fromStatus?: string;
  toStatus?: string;
  fromLabel?: string;
  toLabel?: string;
  actorRole?: string;
  actorLabel?: string;
  primaryHref?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type NotificationVisualVariant = "neutral" | "positive" | "negative" | "progress";

export type PresentedNotification = {
  title: string;
  message: string;
  visualVariant: NotificationVisualVariant;
  showOrderStatusExtras: boolean;
};

const ENUM_ORDER_STATUS = [
  "PENDENTE",
  "CONFIRMADO",
  "EM_PREPARACAO",
  "EM_ENTREGA",
  "ENTREGUE",
  "CANCELADO",
] as const;

/** Referência legível: código curto do pedido ou prefixo do ID. */
export function orderRefFromNotificationPayload(p: Pick<OrderStatusNotificationPayload, "orderCode" | "orderId">): string {
  const code = p.orderCode != null && String(p.orderCode).trim() !== "" ? String(p.orderCode).trim() : null;
  if (code) return code;
  const id = p.orderId?.trim();
  if (id) return `#${id.slice(0, 10)}`;
  return "";
}

export function notificationVariantForOrderStatus(toStatus: string): NotificationVisualVariant {
  switch (toStatus) {
    case "ENTREGUE":
      return "positive";
    case "CANCELADO":
      return "negative";
    case "EM_ENTREGA":
    case "EM_PREPARACAO":
    case "CONFIRMADO":
      return "progress";
    default:
      return "neutral";
  }
}

/** Melhora textos antigos gravados com enums ou papéis crus (CLIENTE, SUPORTE, …). */
export function prettifyNotificationPlaintext(text: string): string {
  if (!text.trim()) return text;
  let out = text;
  for (const code of ENUM_ORDER_STATUS) {
    const label = etiquetaEstadoPedidoCliente(code);
    out = out.replace(new RegExp(`\\b${code}\\b`, "g"), label);
  }
  out = out.replace(/\bCLIENTE\b/g, "Comprador");
  out = out.replace(/\bSUPORTE\b/g, "Equipa BAZAR DO BIÉ");
  out = out.replace(/\bADMIN\b/g, "Equipa BAZAR DO BIÉ");
  out = out.replace(/\bVENDEDOR\b/g, "Loja parceira");
  out = out.replace(/\bLOGISTICA\b/g, "Logística da plataforma");
  return out;
}

function buyerHeadline(toStatus: string, ref: string): string {
  const suffix = ref ? ` · ${ref}` : "";
  switch (toStatus) {
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
      return ref ? `Actualização da encomenda · ${ref}` : "Actualização da encomenda";
  }
}

function buyerBody(ref: string, toStatus: string): string {
  const head = ref ? `Referência ${ref}. ` : "";
  switch (toStatus) {
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
      return prettifyNotificationPlaintext(`${head}O estado do pedido foi actualizado.`);
  }
}

function vendorHeadline(toStatus: string, ref: string): string {
  const suffix = ref ? ` · ${ref}` : "";
  switch (toStatus) {
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
      return ref ? `Actualização do pedido · ${ref}` : "Actualização do pedido";
  }
}

function vendorBody(ref: string, toStatus: string, actorLabel?: string): string {
  const head = ref ? `Ref. ${ref}. ` : "";
  const tail =
    actorLabel?.trim() && actorLabel.trim().length > 0 ? ` Quem registou a mudança: ${actorLabel.trim()}.` : "";
  switch (toStatus) {
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
      return prettifyNotificationPlaintext(`${head}O estado do pedido foi actualizado.${tail}`);
  }
}

/** Texto e ênfase visual para uma linha da lista de notificações (pedidos e restantes). */
export function presentNotificationRow(row: {
  title: string;
  message: string;
  payload?: unknown;
}): PresentedNotification {
  const p = row.payload;
  if (isRecord(p) && p.kind === "ORDER_STATUS" && typeof p.toStatus === "string") {
    const op = p as OrderStatusNotificationPayload;
    const ref = orderRefFromNotificationPayload(op);
    const audience = op.audience === "vendor" ? "vendor" : "buyer";

    if (audience === "vendor") {
      return {
        title: vendorHeadline(op.toStatus, ref),
        message: vendorBody(ref, op.toStatus, op.actorLabel),
        visualVariant: notificationVariantForOrderStatus(op.toStatus),
        showOrderStatusExtras: false,
      };
    }

    return {
      title: buyerHeadline(op.toStatus, ref),
      message: buyerBody(ref, op.toStatus),
      visualVariant: notificationVariantForOrderStatus(op.toStatus),
      showOrderStatusExtras: false,
    };
  }

  const op = isRecord(p) && p.kind === "ORDER_STATUS" ? (p as OrderStatusNotificationPayload) : null;
  const reconstructed = Boolean(op?.toStatus && String(op.toStatus).trim().length > 0);

  return {
    title: prettifyNotificationPlaintext(row.title),
    message: prettifyNotificationPlaintext(row.message),
    visualVariant: "neutral",
    showOrderStatusExtras: Boolean(op && !reconstructed),
  };
}
