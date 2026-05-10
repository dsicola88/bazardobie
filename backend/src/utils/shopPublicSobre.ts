import type { Shop } from "@prisma/client";

/** Linhas da checklist «Sobre a loja» — só declarações verificáveis, sem expor documentos. */
export type SinalConfiancaPublico = {
  id: string;
  label: string;
  ok: boolean;
};

export function sinaisConfiancaPublicos(shop: Shop, opts: { locale?: string } = {}): SinalConfiancaPublico[] {
  const lng = opts.locale ?? "pt-PT";
  const n2 = !!shop.tier2ApprovedAt;
  const n3 = !!shop.tier3ApprovedAt;
  const desde = new Intl.DateTimeFormat(lng, { month: "long", year: "numeric" }).format(shop.createdAt);

  return [
    { id: "verificada", label: "Loja verificada pelo BAZAR DO BIÉ", ok: n2 },
    { id: "identidade", label: "Identidade validada pela equipa (nível 2)", ok: n2 },
    { id: "nif", label: "NIF e dados empresariais validados (nível 3)", ok: n3 },
    { id: "banco", label: "Dados bancários para repasse confirmados (nível 3)", ok: n3 },
    { id: "activa", label: `Loja activa desde ${desde}`, ok: true },
  ];
}
