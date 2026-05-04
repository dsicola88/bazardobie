/** Separadores da área «As minhas encomendas» — fluxo completo do comprador. */

export type BuyerOrdersTab =
  | "todos"
  | "pagar"
  | "espera_loja"
  | "preparacao"
  | "transito"
  | "entregue"
  | "cancelado";

export type OrderForBuyerTab = {
  status: string;
  paymentMethod: string;
  gatewayPayStatus?: string;
};

export const BUYER_ORDER_TAB_LABELS: Record<BuyerOrdersTab, string> = {
  todos: "Todas",
  pagar: "À pagar",
  espera_loja: "Aguardar loja",
  preparacao: "Confirmado · preparação",
  transito: "Em trânsito",
  entregue: "Entregues",
  cancelado: "Canceladas",
};

/** Pagamento online ainda não liquidado no gateway (inclui falha para nova tentativa). */
export function orderNeedsOnlinePayment(o: OrderForBuyerTab): boolean {
  if (o.paymentMethod !== "PAGAMENTO_ONLINE") return false;
  const g = o.gatewayPayStatus ?? "";
  return g === "AGUARDANDO_PAGAMENTO" || g === "PROCESSANDO" || g === "FALHOU";
}

export function orderMatchesBuyerTab(o: OrderForBuyerTab, tab: BuyerOrdersTab): boolean {
  if (tab === "todos") return true;
  if (o.status === "CANCELADO") return tab === "cancelado";
  if (tab === "cancelado") return false;

  if (orderNeedsOnlinePayment(o)) return tab === "pagar";
  if (tab === "pagar") return false;

  switch (tab) {
    case "espera_loja":
      return o.status === "PENDENTE";
    case "preparacao":
      return o.status === "CONFIRMADO" || o.status === "EM_PREPARACAO";
    case "transito":
      return o.status === "EM_ENTREGA";
    case "entregue":
      return o.status === "ENTREGUE";
    default:
      return true;
  }
}

export function etiquetaEstadoPedidoCliente(status: string): string {
  const map: Record<string, string> = {
    PENDENTE: "À espera da loja",
    CONFIRMADO: "Confirmado pela loja",
    EM_PREPARACAO: "Em preparação",
    EM_ENTREGA: "Em trânsito / entrega",
    ENTREGUE: "Entregue",
    CANCELADO: "Cancelado",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

export const BUYER_ORDER_TABS_FLOW: BuyerOrdersTab[] = [
  "todos",
  "pagar",
  "espera_loja",
  "preparacao",
  "transito",
  "entregue",
  "cancelado",
];

/** Lê `?tab=` na URL da lista de encomendas. */
export function parseBuyerOrdersTabParam(raw: string | null): BuyerOrdersTab | null {
  if (!raw) return null;
  const v = raw.trim() as BuyerOrdersTab;
  return BUYER_ORDER_TABS_FLOW.includes(v) ? v : null;
}

/**
 * Separador principal desta encomenda na lista (para links «Ver na lista»).
 * Ordem alinhada com `orderMatchesBuyerTab`.
 */
export function primaryBuyerTabForOrder(o: OrderForBuyerTab): BuyerOrdersTab {
  if (o.status === "CANCELADO") return "cancelado";
  if (orderNeedsOnlinePayment(o)) return "pagar";
  if (o.status === "PENDENTE") return "espera_loja";
  if (o.status === "CONFIRMADO" || o.status === "EM_PREPARACAO") return "preparacao";
  if (o.status === "EM_ENTREGA") return "transito";
  if (o.status === "ENTREGUE") return "entregue";
  return "todos";
}
