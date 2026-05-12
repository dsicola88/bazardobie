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
  /** Referência da encomenda em linha própria (evita títulos truncados). */
  orderRef?: string;
  visualVariant: NotificationVisualVariant;
  showOrderStatusExtras: boolean;
};

export type ChatNotificationPayload = {
  kind: "CHAT";
  orderId?: string;
  orderCode?: string | null;
  preview?: string;
};

export type TrackingNotificationPayload = {
  kind: "TRACKING";
  orderId?: string;
  orderCode?: string | null;
};

const ENUM_ORDER_STATUS = [
  "PENDENTE",
  "CONFIRMADO",
  "EM_PREPARACAO",
  "EM_ENTREGA",
  "ENTREGUE",
  "CANCELADO",
] as const;

/** Código de encomenda ou ID completo (sem truncar). */
export function orderRefFromNotificationPayload(p: Pick<OrderStatusNotificationPayload, "orderCode" | "orderId">): string {
  const code = p.orderCode != null && String(p.orderCode).trim() !== "" ? String(p.orderCode).trim() : null;
  if (code) return code;
  const id = p.orderId?.trim();
  if (id) return id;
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Corrige mensagens antigas onde o ID aparecia truncado com «…» (ex.: Pedido abc123xyz0…). */
export function expandStoredNotificationOrderRef(
  message: string,
  orderId: string,
  orderCode: string | null | undefined
): string {
  const id = orderId.trim();
  if (!id) return message;
  const ref = orderCode != null && String(orderCode).trim() !== "" ? String(orderCode).trim() : id;
  const short = id.slice(0, 10);
  if (short.length < 8) return message;
  let out = message;
  const reShort = escapeRegExp(short);
  const tail = "(?:\\.\\.\\.|…)";
  out = out.replace(new RegExp(`Pedido\\s+${reShort}${tail}`, "gi"), `Pedido ${ref}`);
  out = out.replace(new RegExp(`Encomenda\\s+#?${reShort}${tail}`, "gi"), `Encomenda ${ref}`);
  out = out.replace(new RegExp(`Referência\\s+${reShort}${tail}`, "gi"), `Referência ${ref}`);
  out = out.replace(new RegExp(`#${reShort}${tail}`, "g"), ref.startsWith("#") ? ref : `#${ref}`);
  return out;
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

function buyerHeadline(toStatus: string): string {
  switch (toStatus) {
    case "PENDENTE":
      return "Encomenda registada";
    case "CONFIRMADO":
      return "Pedido confirmado pela loja";
    case "EM_PREPARACAO":
      return "Em preparação para envio";
    case "EM_ENTREGA":
      return "Pedido em trânsito";
    case "ENTREGUE":
      return "Pedido entregue";
    case "CANCELADO":
      return "Pedido cancelado";
    default:
      return "Actualização da encomenda";
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

function vendorHeadline(toStatus: string): string {
  switch (toStatus) {
    case "PENDENTE":
      return "Novo pedido";
    case "CONFIRMADO":
      return "Pedido confirmado";
    case "EM_PREPARACAO":
      return "Pedido em preparação";
    case "EM_ENTREGA":
      return "Pedido em trânsito";
    case "ENTREGUE":
      return "Pedido entregue";
    case "CANCELADO":
      return "Pedido cancelado";
    default:
      return "Actualização do pedido";
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

  if (isRecord(p) && p.kind === "ORDER_STATUS") {
    const op = p as OrderStatusNotificationPayload;
    const toStatusRaw = op.toStatus;
    const toStatusOk =
      typeof toStatusRaw === "string" && toStatusRaw.trim().length > 0 ? toStatusRaw.trim() : null;

    if (toStatusOk) {
      const ref = orderRefFromNotificationPayload(op);
      const orderRef = ref || undefined;
      const audience = op.audience === "vendor" ? "vendor" : "buyer";

      if (audience === "vendor") {
        return {
          title: vendorHeadline(toStatusOk),
          message: vendorBody("", toStatusOk, op.actorLabel),
          orderRef,
          visualVariant: notificationVariantForOrderStatus(toStatusOk),
          showOrderStatusExtras: false,
        };
      }

      return {
        title: buyerHeadline(toStatusOk),
        message: buyerBody("", toStatusOk),
        orderRef,
        visualVariant: notificationVariantForOrderStatus(toStatusOk),
        showOrderStatusExtras: false,
      };
    }

    const ref = orderRefFromNotificationPayload(op);
    const orderRef = ref || undefined;
    const audience = op.audience === "vendor" ? "vendor" : "buyer";
    const hasLabels = Boolean(
      (typeof op.fromLabel === "string" && op.fromLabel.trim()) ||
        (typeof op.toLabel === "string" && op.toLabel.trim())
    );
    const rawMsg = prettifyNotificationPlaintext(row.message);
    const messageWithRef =
      typeof op.orderId === "string" && op.orderId.trim()
        ? expandStoredNotificationOrderRef(rawMsg, op.orderId, op.orderCode)
        : rawMsg;

    const titleBuyer = prettifyNotificationPlaintext(row.title.trim());
    const messageBody =
      messageWithRef.trim() !== ""
        ? messageWithRef
        : hasLabels
          ? "Resumo da mudança de estado:"
          : "O estado do pedido foi actualizado na plataforma.";

    return {
      title:
        audience === "vendor"
          ? "Actualização do pedido"
          : titleBuyer.replace(/^Actualização de estado da encomenda\.?$/i, "Actualização da encomenda"),
      message: messageBody,
      orderRef,
      visualVariant: "neutral",
      showOrderStatusExtras: hasLabels,
    };
  }

  if (isRecord(p) && p.kind === "CHAT") {
    const cp = p as ChatNotificationPayload;
    const ref = orderRefFromNotificationPayload({
      orderId: typeof cp.orderId === "string" ? cp.orderId : "",
      orderCode: cp.orderCode,
    });
    const preview = typeof cp.preview === "string" ? cp.preview.trim() : "";
    return {
      title: "Nova mensagem no chat da encomenda",
      message: preview || "Abra o chat para ler a mensagem completa.",
      orderRef: ref || undefined,
      visualVariant: "neutral",
      showOrderStatusExtras: false,
    };
  }

  if (isRecord(p) && p.kind === "TRACKING") {
    const tp = p as TrackingNotificationPayload;
    const ref = orderRefFromNotificationPayload({
      orderId: typeof tp.orderId === "string" ? tp.orderId : "",
      orderCode: tp.orderCode,
    });
    return {
      title: "Rastreio actualizado",
      message: prettifyNotificationPlaintext(row.message),
      orderRef: ref || undefined,
      visualVariant: "progress",
      showOrderStatusExtras: false,
    };
  }

  return {
    title: prettifyNotificationPlaintext(row.title),
    message: prettifyNotificationPlaintext(row.message),
    visualVariant: "neutral",
    showOrderStatusExtras: false,
  };
}
