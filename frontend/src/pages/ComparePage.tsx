import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { ListingBadge } from "../components/ListingBadge.js";
import { MediaPlaceholder } from "../components/MediaPlaceholder.js";
import { useSeo } from "../seo/useSeo.js";
import {
  clearCompare,
  COMPARE_MAX,
  getCompareIds,
  parseCompareIdsParam,
  removeCompareId,
  setCompareIds,
} from "../utils/compareSelection.js";
import { formatKz, formatRating } from "../utils/format.js";
import { resolveMediaUrl } from "../utils/media.js";
import { productConditionLabel } from "../utils/productCondition.js";
import { variantCompareAtUnitKz, variantEffectiveUnitKz } from "../utils/variantPrice.js";
import { variantPdpSpecRows } from "../utils/variantDisplay.js";

type CompareVariant = {
  id: string;
  sku: string;
  stock: number;
  name?: string | null;
  color?: string | null;
  size?: string | null;
  imageUrl?: string | null;
  salePrice?: string | null;
  priceAdjust?: string | null;
  properties?: { label: string; value: string }[] | null;
  variantStructuredValues?: Array<{
    value: string;
    attribute: {
      label: string;
      sortOrder: number;
      primaryRank?: number;
      inputType?: string;
      unitCode?: string | null;
    };
  }> | null;
};

export type CompareProduct = {
  id: string;
  name: string;
  sku?: string | null;
  price: string | number;
  promoPrice?: string | number | null;
  displayPrice: string | number;
  soldCount: number;
  condition?: string | null;
  images: { url: string }[];
  category?: { id: string; name: string } | null;
  shop?: { id: string; name: string; city?: string; province?: string } | null;
  variants: CompareVariant[];
  reviewCount: number;
  averageRating?: string | number | null;
  ratingTrustShortPt?: string | null;
  ratingTrustHintPt?: string | null;
  listingBadges?: { id: string; label: string }[];
};

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normVal(s: string): string {
  return s.trim().toLowerCase();
}

function pickVariant(p: CompareProduct): CompareVariant | null {
  const v = p.variants ?? [];
  if (v.length === 0) return null;
  return v.find((x) => x.stock > 0) ?? v[0];
}

function buildSpecMatrix(products: CompareProduct[]): { label: string; values: string[] }[] {
  const maps = products.map((p) => {
    const v = pickVariant(p);
    const m = new Map<string, string>();
    if (!v) return m;
    for (const row of variantPdpSpecRows(v, p.name)) {
      m.set(normKey(row.label), row.value);
    }
    return m;
  });
  const allNorm = new Set<string>();
  for (const m of maps) {
    for (const k of m.keys()) allNorm.add(k);
  }
  const collator = new Intl.Collator("pt-AO", { sensitivity: "base" });
  const displayFor = (nk: string): string => {
    for (const p of products) {
      const v = pickVariant(p);
      if (!v) continue;
      for (const r of variantPdpSpecRows(v, p.name)) {
        if (normKey(r.label) === nk) return r.label;
      }
    }
    return nk;
  };
  const sortedNorm = [...allNorm].sort((a, b) => collator.compare(displayFor(a), displayFor(b)));
  return sortedNorm.map((nk) => ({
    label: displayFor(nk),
    values: maps.map((m) => m.get(nk) ?? "—"),
  }));
}

function rowHighlights(values: string[]): boolean {
  const base = values.map((v) => normVal(v === "—" ? "" : v));
  const distinct = new Set(base.filter((x) => x.length > 0));
  if (distinct.size <= 1) return false;
  return true;
}

function escapeCsvField(val: string): string {
  const s = val.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const idsKey = searchParams.get("ids") ?? "";

  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (idsKey.trim()) {
      const parsed = parseCompareIdsParam(idsKey);
      if (parsed.length) {
        const cur = getCompareIds();
        if (cur.join(",") !== parsed.join(",")) setCompareIds(parsed);
      }
      return;
    }
    const stored = getCompareIds();
    if (stored.length) setSearchParams({ ids: stored.join(",") }, { replace: true });
  }, [idsKey, setSearchParams]);

  useEffect(() => {
    const ids = parseCompareIdsParam(searchParams.get("ids"));
    if (ids.length === 0) {
      setProducts([]);
      setLoadState("idle");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    void apiFetch<{ products: CompareProduct[] }>(`/products/compare?ids=${encodeURIComponent(ids.join(","))}`)
      .then((r) => {
        if (!cancelled) {
          setProducts(Array.isArray(r.products) ? r.products : []);
          setLoadState("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const specRows = useMemo(() => buildSpecMatrix(products), [products]);

  const resumoRows = useMemo(() => {
    return products.map((p) => {
      const v = pickVariant(p);
      const unit = v ? variantEffectiveUnitKz(p, v) : Number(p.displayPrice);
      const was = v ? variantCompareAtUnitKz(p, v) : null;
      let priceCell = formatKz(unit);
      if (was != null && was > unit) {
        priceCell = `${formatKz(unit)} (antes ${formatKz(was)})`;
      }
      const ratingCell =
        p.averageRating != null
          ? `${formatRating(p.averageRating)} ★ · ${p.reviewCount.toLocaleString("pt-PT")} opiniões`
          : p.reviewCount > 0
            ? `${p.reviewCount.toLocaleString("pt-PT")} opiniões · ${p.ratingTrustShortPt ?? "—"}`
            : p.ratingTrustShortPt ?? "Sem avaliações";
      const variantNote = p.variants.length > 1 && v ? `Variante em stock: ${v.sku}` : v ? `SKU ${v.sku}` : "—";
      return {
        priceCell,
        shopCell: p.shop?.name?.trim() || "—",
        shopId: p.shop?.id,
        categoryCell: p.category?.name?.trim() || "—",
        conditionCell: productConditionLabel(p.condition),
        soldCell: `${p.soldCount.toLocaleString("pt-PT")} vendido${p.soldCount === 1 ? "" : "s"}`,
        ratingCell,
        skuNote: variantNote,
      };
    });
  }, [products]);

  const metaParts = useMemo(() => products.map((p) => p.name).slice(0, 4), [products]);
  const seoTitle =
    products.length > 0
      ? `Comparar ${products.length} artigo${products.length === 1 ? "" : "s"} | BAZAR DO BIÉ`
      : "Comparar produtos | BAZAR DO BIÉ";
  const seoDescription =
    products.length > 0
      ? `Compare ${metaParts.join(", ")}. Preços em Kz, ficha técnica e lojas no BAZAR DO BIÉ.`
      : "Compare produtos lado a lado: preço, especificações e vendedores no BAZAR DO BIÉ.";

  useSeo({
    title: seoTitle,
    description: seoDescription.slice(0, 160),
    canonicalPath: "/compare",
  });

  const onRemove = useCallback(
    (productId: string) => {
      removeCompareId(productId);
      const next = getCompareIds();
      if (next.length) setSearchParams({ ids: next.join(",") }, { replace: true });
      else setSearchParams({}, { replace: true });
    },
    [setSearchParams],
  );

  const onClear = useCallback(() => {
    clearCompare();
    setSearchParams({}, { replace: true });
    setProducts([]);
  }, [setSearchParams]);

  const downloadCsv = useCallback(() => {
    if (products.length === 0) return;
    const cols = products.map((p) => p.name.trim().replace(/\s+/g, " "));
    const rows: string[][] = [["Característica", ...cols]];
    const push = (label: string, values: string[]) => {
      rows.push([label, ...values]);
    };
    push("Preço (referência)", resumoRows.map((r) => r.priceCell));
    push("Loja", resumoRows.map((r) => r.shopCell));
    push("Categoria", resumoRows.map((r) => r.categoryCell));
    push("Condição", resumoRows.map((r) => r.conditionCell));
    push("Réf. / variante", resumoRows.map((r) => r.skuNote));
    push("Reputação", resumoRows.map((r) => r.ratingCell));
    push("Vendas na plataforma", resumoRows.map((r) => r.soldCell));
    for (const sp of specRows) {
      push(sp.label, sp.values);
    }
    const csv = rows.map((line) => line.map(escapeCsvField).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bazar-comparar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [products, resumoRows, specRows]);

  const requestIds = parseCompareIdsParam(searchParams.get("ids"));
  const missingCount = requestIds.length - products.length;

  return (
    <div className="ae-compare-page ae-shell">
      <nav className="ae-compare-breadcrumb" aria-label="Navegação">
        <Link to="/">Início</Link>
        <span aria-hidden="true"> / </span>
        <span>Comparar</span>
      </nav>

      <header className="ae-compare-head">
        <h1 className="ae-compare-head__title">Comparar produtos</h1>
        <p className="ae-compare-head__sub ae-muted">
          Até {COMPARE_MAX} artigos, com ficha técnica e preços lado a lado. As diferenças entre colunas são realçadas
          suavemente.
        </p>
      </header>

      {requestIds.length > 0 ? (
        <div className="ae-compare-toolbar">
          <span className="ae-compare-toolbar__count">
            <strong>{products.length}</strong> na comparação
            {requestIds.length >= COMPARE_MAX ? (
              <span className="ae-muted"> · limite atingido</span>
            ) : (
              <span className="ae-muted"> · até {COMPARE_MAX}</span>
            )}
          </span>
          <div className="ae-compare-toolbar__actions">
            <Link to="/search" className="ae-btn-subtle">
              Continuar a descobrir
            </Link>
            {products.length > 0 ? (
              <button type="button" className="ae-btn-subtle" onClick={() => downloadCsv()}>
                Descarregar CSV
              </button>
            ) : null}
            {products.length > 0 ? (
              <button type="button" className="ae-btn-subtle" onClick={onClear}>
                Limpar lista
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {loadState === "loading" ? (
        <p className="ae-muted ae-compare-state">A carregar artigos…</p>
      ) : loadState === "error" ? (
        <p className="ae-compare-state ae-compare-state--err" role="alert">
          Não foi possível carregar a comparação.{" "}
          <button type="button" className="ae-linkbtn" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
        </p>
      ) : null}

      {requestIds.length === 0 ? (
        <div className="ae-compare-empty">
          <h2 className="ae-compare-empty__title">Lista vazia</h2>
          <p className="ae-muted">
            Abra uma ficha de produto ou use <strong>«Comparar»</strong> nos cartões da pesquisa. Guarde até {COMPARE_MAX}{" "}
            artigos para ver especificações e preços em paralelo.
          </p>
          <Link to="/search" className="ae-btn-lg ae-btn-buy">
            Explorar catálogo
          </Link>
        </div>
      ) : products.length === 0 && loadState !== "loading" ? (
        <div className="ae-compare-empty">
          <h2 className="ae-compare-empty__title">Nenhum artigo disponível</h2>
          <p className="ae-muted">Os identificadores não são válidos ou os artigos deixaram de estar na vitrine.</p>
          <button type="button" className="ae-btn-lg ae-btn-buy" onClick={onClear}>
            Repor comparador
          </button>
        </div>
      ) : products.length === 1 ? (
        <div className="ae-compare-hint ae-compare-hint--soft">
          <p>
            Adicione pelo mais um artigo para comparar lado a lado. Pode escolher outra referência na{" "}
            <Link to="/search">pesquisa</Link> ou numa ficha relacionada.
          </p>
        </div>
      ) : null}

      {missingCount > 0 && products.length > 0 ? (
        <p className="ae-compare-missing ae-muted" role="status">
          {missingCount === 1
            ? "Um artigo pedido já não está disponível na vitrine."
            : `${missingCount} artigos pedidos já não estão disponíveis na vitrine.`}
        </p>
      ) : null}

      {products.length > 0 ? (
        <div className="ae-compare-table-wrap">
          <table className="ae-compare-table">
            <thead>
              <tr>
                <th className="ae-compare-table__corner" scope="col">
                  <span className="sr-only">Produtos</span>
                </th>
                {products.map((p) => {
                  const v = pickVariant(p);
                  const img = resolveMediaUrl(v?.imageUrl?.trim() || p.images[0]?.url || "");
                  return (
                    <th key={p.id} className="ae-compare-table__colhead" scope="col">
                      <div className="ae-compare-cardhead">
                        <button
                          type="button"
                          className="ae-compare-cardhead__remove"
                          aria-label={`Remover ${p.name} da comparação`}
                          onClick={() => onRemove(p.id)}
                        >
                          ×
                        </button>
                        <div className="ae-compare-cardhead__media">
                          {img ? (
                            <img src={img} alt="" decoding="async" />
                          ) : (
                            <MediaPlaceholder variant="card" />
                          )}
                        </div>
                        <Link to={`/product/${encodeURIComponent(p.id)}`} className="ae-compare-cardhead__title">
                          {p.name}
                        </Link>
                        {p.listingBadges?.length ? (
                          <div className="ae-compare-cardhead__badges">
                            {p.listingBadges.map((b) => (
                              <ListingBadge key={b.id} badge={b} compact />
                            ))}
                          </div>
                        ) : null}
                        <Link to={`/product/${encodeURIComponent(p.id)}`} className="ae-compare-cardhead__cta">
                          Ver ficha completa
                        </Link>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr className="ae-compare-table__section">
                <th colSpan={products.length + 1} scope="colgroup">
                  Resumo
                </th>
              </tr>
              {(
                [
                  ["Preço (referência)", resumoRows.map((r) => r.priceCell)],
                  ["Loja", resumoRows.map((r) => r.shopCell)],
                  ["Categoria", resumoRows.map((r) => r.categoryCell)],
                  ["Condição", resumoRows.map((r) => r.conditionCell)],
                  ["Réf. / variante", resumoRows.map((r) => r.skuNote)],
                  ["Reputação", resumoRows.map((r) => r.ratingCell)],
                  ["Vendas na plataforma", resumoRows.map((r) => r.soldCell)],
                ] as const
              ).map(([label, values]) => (
                <tr key={label} className={rowHighlights(values as string[]) ? "ae-compare-row--diff" : ""}>
                  <th scope="row" className="ae-compare-table__label">
                    {label}
                  </th>
                  {(values as string[]).map((cell, i) => (
                    <td key={`${label}-${products[i]?.id ?? i}`} className="ae-compare-table__cell">
                      {label === "Loja" && resumoRows[i]?.shopId ? (
                        <Link to={`/loja/${encodeURIComponent(resumoRows[i].shopId!)}`}>{cell}</Link>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {specRows.length > 0 ? (
                <>
                  <tr className="ae-compare-table__section">
                    <th colSpan={products.length + 1} scope="colgroup">
                      Ficha técnica e características
                    </th>
                  </tr>
                  {specRows.map((row) => (
                    <tr key={row.label} className={rowHighlights(row.values) ? "ae-compare-row--diff" : ""}>
                      <th scope="row" className="ae-compare-table__label">
                        {row.label}
                      </th>
                      {row.values.map((cell, i) => (
                        <td key={`${row.label}-${products[i]?.id ?? i}`} className="ae-compare-table__cell">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
