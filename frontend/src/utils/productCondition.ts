export type ProductCondition =
  | "NEW"
  | "USED"
  | "REFURBISHED";

export function productConditionLabel(cond: string | null | undefined): string {
  if (cond === "NEW") return "Novo";
  if (cond === "USED") return "Usado";
  if (cond === "REFURBISHED") return "Recondicionado";
  return "Condição não indicada";
}
