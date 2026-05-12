/** Sufixo de classe CSS (sem acentos) para tiers de qualidade da ficha. */
export function listingQualityGradeCssSuffix(grade: string): "excelente" | "alto" | "medio" | "baixo" {
  const g = grade.trim().toLowerCase();
  if (g === "médio" || g === "medio") return "medio";
  if (g === "excelente") return "excelente";
  if (g === "alto") return "alto";
  return "baixo";
}

/** Rótulo curto para vendedores (tom marketplace). */
export function listingQualitySellerTierPt(grade: string): string {
  const g = grade.trim().toLowerCase();
  if (g === "excelente") return "Excelente";
  if (g === "alto") return "Forte";
  if (g === "médio" || g === "medio") return "Boa";
  return "Básica";
}
