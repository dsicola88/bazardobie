import type { LogisticsKind } from "./orderTracking.js";

/**
 * Estados que o vendedor pode seleccionar num único passo a partir do estado actual.
 * Com envio pela plataforma, após «Em preparação» só logística ou admin avançam o pedido.
 */
export function vendorSelectableStatuses(current: string, logistics: LogisticsKind): string[] {
  const terminal = new Set(["ENTREGUE", "CANCELADO"]);
  if (terminal.has(current)) return [current];

  const next: string[] = [current];
  switch (current) {
    case "PENDENTE":
      next.push("CONFIRMADO", "CANCELADO");
      break;
    case "CONFIRMADO":
      next.push("EM_PREPARACAO", "CANCELADO");
      break;
    case "EM_PREPARACAO":
      if (logistics === "VENDEDOR") next.push("EM_ENTREGA", "CANCELADO");
      else next.push("CANCELADO");
      break;
    case "EM_ENTREGA":
      if (logistics === "VENDEDOR") next.push("ENTREGUE", "CANCELADO");
      break;
    default:
      break;
  }
  return [...new Set(next)].sort((a, b) => {
    const ia = STAT_ORDER.indexOf(a);
    const ib = STAT_ORDER.indexOf(b);
    if (ia < 0 || ib < 0) return String(a).localeCompare(String(b));
    return ia - ib;
  });
}

const STAT_ORDER = ["PENDENTE", "CONFIRMADO", "EM_PREPARACAO", "EM_ENTREGA", "ENTREGUE", "CANCELADO"];

export function orderLogisticsFromItems(items: { deliveryTipo?: string }[]): LogisticsKind {
  const t = items[0]?.deliveryTipo;
  return t === "PLATAFORMA" ? "PLATAFORMA" : "VENDEDOR";
}

/** Estados que a equipa de logística pode escolher (pedidos envio BAZAR DO BIÉ). */
export function logisticsSelectableStatuses(current: string): string[] {
  switch (current) {
    case "EM_PREPARACAO":
      return ["EM_PREPARACAO", "EM_ENTREGA"];
    case "EM_ENTREGA":
      return ["EM_ENTREGA", "ENTREGUE"];
    default:
      return [current];
  }
}
