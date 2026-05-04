/** Passos da linha temporal — envio pela loja (vendedor faz trânsito). */
export const TRACK_STEPS_VENDOR_PT = [
  { key: "confirmado", label: "Confirmado na loja" },
  { key: "prep", label: "Em preparação" },
  { key: "transito", label: "Enviado · trânsito nacional" },
  { key: "entrega", label: "Entregue" },
] as const;

/** Passos quando o envio é operado pela plataforma após preparação na loja. */
export const TRACK_STEPS_PLATFORM_PT = [
  { key: "confirmado", label: "Confirmado na loja" },
  { key: "prep", label: "Preparado para recolha" },
  { key: "transito", label: "Recolha e entrega (BAZAR DO BIÉ)" },
  { key: "entrega", label: "Entregue ao cliente" },
] as const;

export type LogisticsKind = "PLATAFORMA" | "VENDEDOR";

/** @deprecated use TRACK_STEPS_VENDOR_PT */
export const TRACK_STEPS_PT = TRACK_STEPS_VENDOR_PT;

export function trackStepsForLogistics(kind: LogisticsKind) {
  return kind === "PLATAFORMA" ? TRACK_STEPS_PLATFORM_PT : TRACK_STEPS_VENDOR_PT;
}

/** Índice 1–4 para o último passo já alcançado; 0 cancelado; -1 desconhecido */
export function pedidoUltimoPasso(status: string): number {
  switch (status) {
    case "PENDENTE":
    case "CONFIRMADO":
      return 1;
    case "EM_PREPARACAO":
      return 2;
    case "EM_ENTREGA":
      return 3;
    case "ENTREGUE":
      return 4;
    case "CANCELADO":
      return 0;
    default:
      return -1;
  }
}
