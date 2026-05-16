import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { ProductCard, type ProductCardData } from "../components/ProductCard.js";
import { SearchPriceRange } from "../components/SearchPriceRange.js";
import { StarRating } from "../components/StarRating.js";
import { buildSearchPath } from "../buildSearchPath.js";
import { getPublicCategories, type PublicCategory } from "../data/publicCategoriesCache.js";
import { useSeo } from "../seo/useSeo.js";
import { parsePriceFilterInput } from "../utils/priceFilter.js";
import {
  getRangeFacet,
  parseStructuredFacetsParam,
  serializeStructuredFacets,
  toggleDiscreteValue,
  upsertRangeFacet,
  isDiscreteValueSelected,
} from "../utils/structuredFacetsUrl.js";
import {
  CATALOG_TERMS,
  catalogStructuredDiscreteFacetMoreLabel,
  catalogStructuredFiltersChipLabel,
  catalogStructuredRangeApplyAria,
  catalogStructuredRangeClearAria,
} from "../catalog/catalogTerminology.js";

type Category = PublicCategory;
type VisualSearchPayload = { items?: ProductCardData[]; total?: number };

const PAGE_SIZE = 36;

/** Valores iniciais visíveis por faceta discreta; o resto fica em «Ver mais». */
const DISCRETE_FACET_VISIBLE = 10;

const DEFAULT_PRICE_CEILING = 50_000_000;

type CatalogFacetPayload = {
  counts: Record<string, number>;
  total: number;
  priceFloor?: number;
  priceCeiling?: number;
};

type StructuredFacetApiDiscrete = {
  attributeId: string;
  key: string;
  label: string;
  inputType: string;
  facetKind: "discrete";
  values: { value: string; count: number }[];
};
type StructuredFacetApiRange = {
  attributeId: string;
  key: string;
  label: string;
  inputType: string;
  unitCode: string | null;
  facetKind: "range";
  min: number | null;
  max: number | null;
  valueCount: number;
};
type StructuredFacetApiPayload = { categoryId: string; facets: (StructuredFacetApiDiscrete | StructuredFacetApiRange)[] };

const CONDITION_FILTER_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "", label: "Todas as condições", hint: "Novo, usado e recondicionado" },
  { value: "NEW", label: "Novo", hint: "Artigos novos, sem uso" },
  { value: "USED", label: "Usado", hint: "Segunda mão ou com uso anterior" },
  { value: "REFURBISHED", label: "Recondicionado", hint: "Revisto ou renovado" },
];

const MIN_RATING_FILTER_OPTIONS: { value: string; showStars: number; title: string; hint: string }[] = [
  {
    value: "",
    showStars: 0,
    title: "Qualquer avaliação",
    hint: "Inclui produtos sem avaliações ou com média mais baixa",
  },
  {
    value: "4",
    showStars: 4,
    title: "4 estrelas e acima",
    hint: "Média da comunidade igual ou superior a 4 em 5",
  },
  {
    value: "3",
    showStars: 3,
    title: "3 estrelas e acima",
    hint: "Boa reputação ou melhor no histórico de reviews",
  },
  {
    value: "2",
    showStars: 2,
    title: "2 estrelas e acima",
    hint: "Aceita médias modestas; útil quando há poucos dados",
  },
  {
    value: "1",
    showStars: 1,
    title: "1 estrela e acima",
    hint: "Só artigos com média de reviews ≥ 1 (sem média ficam de fora)",
  },
];

const sorts: { k: string; label: string }[] = [
  { k: "recentes", label: "Novidades" },
  { k: "mais_vendidos", label: "Mais vendidos" },
  { k: "preco_asc", label: "Preço ↑" },
  { k: "preco_desc", label: "Preço ↓" },
  { k: "melhor_avaliados", label: "Melhor avaliados" },
];

function conditionShortLabel(c: string): string {
  if (c === "NEW") return "Novo";
  if (c === "USED") return "Usado";
  if (c === "REFURBISHED") return "Recondicionado";
  return c;
}

function cmpPublicCategory(a: Category, b: Category): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "pt");
}

/** `selId` é o próprio `nodeId` ou um descendente na árvore. */
function categoryMatchesSubtree(selId: string | undefined, nodeId: string, all: Category[]): boolean {
  if (!selId) return false;
  if (selId === nodeId) return true;
  let cur = all.find((c) => c.id === selId);
  while (cur?.parentId) {
    if (cur.parentId === nodeId) return true;
    cur = all.find((c) => c.id === cur.parentId);
  }
  return false;
}

function sumSubtreeCounts(
  catId: string,
  childrenByParent: Map<string, Category[]>,
  counts: Record<string, number>,
): number {
  let n = counts[catId] ?? 0;
  for (const ch of childrenByParent.get(catId) ?? []) {
    n += sumSubtreeCounts(ch.id, childrenByParent, counts);
  }
  return n;
}

function StructuredNumericFacetFilter({
  facet,
  structuredFacetsParam,
  params,
  setParams,
}: {
  facet: StructuredFacetApiRange;
  structuredFacetsParam: string;
  params: URLSearchParams;
  setParams: (next: URLSearchParams) => void;
}) {
  const clauses = useMemo(() => parseStructuredFacetsParam(structuredFacetsParam), [structuredFacetsParam]);
  const active = getRangeFacet(clauses, facet.attributeId);
  const [lo, setLo] = useState(() => (active?.min != null ? String(active.min) : ""));
  const [hi, setHi] = useState(() => (active?.max != null ? String(active.max) : ""));
  useEffect(() => {
    const a = getRangeFacet(parseStructuredFacetsParam(structuredFacetsParam), facet.attributeId);
    setLo(a?.min != null ? String(a.min) : "");
    setHi(a?.max != null ? String(a.max) : "");
  }, [structuredFacetsParam, facet.attributeId]);

  function apply() {
    const n = new URLSearchParams(params);
    const prev = parseStructuredFacetsParam(n.get("structuredFacets"));
    const minN = lo.trim() === "" ? undefined : Number(lo.replace(",", "."));
    const maxN = hi.trim() === "" ? undefined : Number(hi.replace(",", "."));
    const minOk = minN !== undefined && Number.isFinite(minN) ? minN : undefined;
    const maxOk = maxN !== undefined && Number.isFinite(maxN) ? maxN : undefined;
    if (minOk == null && maxOk == null) return;
    const next = upsertRangeFacet(prev, facet.attributeId, minOk, maxOk);
    n.set("structuredFacets", serializeStructuredFacets(next));
    setParams(n);
  }

  function clearRange() {
    const n = new URLSearchParams(params);
    const prev = parseStructuredFacetsParam(n.get("structuredFacets"));
    const next = prev.filter((c) => !(c.kind === "range" && c.attributeId === facet.attributeId));
    if (next.length === 0) n.delete("structuredFacets");
    else n.set("structuredFacets", serializeStructuredFacets(next));
    setParams(n);
  }

  const unitHint = facet.unitCode ? ` (${facet.unitCode})` : "";

  return (
    <div className="ae-struct-facet-range">
      <div className="ae-struct-facet-range__inputs">
        <label>
          {CATALOG_TERMS.searchStructuredRangeFrom}
          {unitHint}
          <input
            type="text"
            inputMode="decimal"
            value={lo}
            onChange={(e) => setLo(e.target.value)}
            placeholder={facet.min != null ? String(facet.min) : "—"}
          />
        </label>
        <label>
          {CATALOG_TERMS.searchStructuredRangeTo}
          {unitHint}
          <input
            type="text"
            inputMode="decimal"
            value={hi}
            onChange={(e) => setHi(e.target.value)}
            placeholder={facet.max != null ? String(facet.max) : "—"}
          />
        </label>
      </div>
      <div className="ae-struct-facet-range__actions">
        <button
          type="button"
          className="btn"
          onClick={() => apply()}
          aria-label={catalogStructuredRangeApplyAria(facet.label)}
        >
          {CATALOG_TERMS.searchStructuredRangeApply}
        </button>
        {active ? (
          <button
            type="button"
            className="btn"
            onClick={() => clearRange()}
            aria-label={catalogStructuredRangeClearAria(facet.label)}
          >
            {CATALOG_TERMS.searchStructuredRangeClear}
          </button>
        ) : null}
      </div>
    </div>
  );
}

type CategoryFacetNavProps = {
  params: URLSearchParams;
  cats: Category[];
  categoryId: string;
  facet: CatalogFacetPayload | null;
  facetLoading: boolean;
  visualMode: boolean;
};

function CategoryFacetNav({ params, cats, categoryId, facet, facetLoading, visualMode }: CategoryFacetNavProps) {
  const childrenByParent = useMemo(() => {
    const m = new Map<string, Category[]>();
    for (const c of cats) {
      if (!c.parentId) continue;
      const arr = m.get(c.parentId) ?? [];
      arr.push(c);
      m.set(c.parentId, arr);
    }
    for (const arr of m.values()) arr.sort(cmpPublicCategory);
    return m;
  }, [cats]);

  const roots = useMemo(() => cats.filter((c) => !c.parentId).sort(cmpPublicCategory), [cats]);

  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!categoryId || cats.length === 0) return;
    let cur = cats.find((c) => c.id === categoryId);
    const ancestors: string[] = [];
    while (cur?.parentId) {
      ancestors.push(cur.parentId);
      cur = cats.find((c) => c.id === cur.parentId);
    }
    if (ancestors.length === 0) return;
    setExpandedMap((prev) => {
      const next = { ...prev };
      for (const id of ancestors) next[id] = true;
      return next;
    });
  }, [categoryId, cats]);

  const counts = facet?.counts ?? {};
  const ready = facet != null && !visualMode;

  function formatCount(displayed: number): string {
    if (visualMode) return "—";
    if (!ready && facetLoading) return "…";
    if (!ready) return "—";
    return displayed.toLocaleString("pt-AO");
  }

  function renderBranch(cat: Category, depth: number): ReactNode {
    const children = childrenByParent.get(cat.id) ?? [];
    const hasKids = children.length > 0;
    const selBranch = categoryMatchesSubtree(categoryId, cat.id, cats);
    const userOpen = expandedMap[cat.id];
    const open = selBranch || Boolean(userOpen);
    const countShown = hasKids ? sumSubtreeCounts(cat.id, childrenByParent, counts) : counts[cat.id] ?? 0;

    return (
      <div className={`ae-cat-tree__branch ae-cat-tree__branch--depth-${Math.min(depth, 4)}`}>
        <div className="ae-cat-tree__row">
          {hasKids ? (
            <button
              type="button"
              className="ae-cat-tree__expand"
              aria-expanded={open}
              aria-controls={`ae-cat-sub-${cat.id}`}
              id={`ae-cat-btn-${cat.id}`}
              disabled={selBranch}
              title={selBranch ? "Subcategorias visíveis enquanto há filtro activo nesta área" : undefined}
              onClick={() => {
                if (selBranch) return;
                setExpandedMap((p) => ({ ...p, [cat.id]: !open }));
              }}
            >
              <span className="ae-cat-tree__chev" aria-hidden>
                {open ? "▼" : "▶"}
              </span>
            </button>
          ) : (
            <span className="ae-cat-tree__expand ae-cat-tree__expand--spacer" aria-hidden />
          )}
          <Link
            to={buildSearchPath("/search", params, { categoryId: cat.id, structuredFacets: null })}
            className={`ae-cat-tree__link${categoryId === cat.id ? " ae-on" : ""}`}
          >
            <span className="ae-cat-tree__name">{cat.name}</span>
            <span className="ae-cat-tree__count">{formatCount(countShown)}</span>
          </Link>
        </div>
        {hasKids && open ? (
          <div className="ae-cat-tree__subs" id={`ae-cat-sub-${cat.id}`} role="group">
            {children.map((ch) => (
              <div key={ch.id}>{renderBranch(ch, depth + 1)}</div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const totalLabel = formatCount(facet?.total ?? 0);

  return (
    <nav className="ae-cat-tree" aria-label="Categorias do catálogo">
      <Link
        to={buildSearchPath("/search", params, { categoryId: null, structuredFacets: null })}
        className={`ae-cat-tree__all${!categoryId ? " ae-on" : ""}`}
      >
        <span>Todas as categorias</span>
        <span className="ae-cat-tree__count">{totalLabel}</span>
      </Link>
      <div className="ae-cat-tree__roots">
        {roots.map((r) => (
          <div key={r.id}>{renderBranch(r, 0)}</div>
        ))}
      </div>
    </nav>
  );
}

export default function SearchPage() {
  const conditionGroupId = useId();
  const ratingGroupId = useId();
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const canonicalQuery = useMemo(() => {
    const s = params.toString();
    return s ? `?${s}` : "";
  }, [params]);
  const visualMode = params.get("visual") === "1";
  const featured = params.get("featured") === "true";
  const onSale = params.get("onSale") === "true";
  const q = params.get("q") ?? "";
  const categoryId = params.get("categoryId") ?? "";
  const sort = params.get("sort") ?? "recentes";
  const shopId = params.get("shopId") ?? "";
  const condition = params.get("condition") ?? "";
  const minRating = params.get("minRating") ?? "";
  const minPriceParam = params.get("minPrice");
  const maxPriceParam = params.get("maxPrice");
  const [minPrice, setMinPrice] = useState(() => params.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(() => params.get("maxPrice") ?? "");
  const [cats, setCats] = useState<Category[]>([]);
  const [data, setData] = useState<{ items: ProductCardData[]; total: number } | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [forYou, setForYou] = useState<ProductCardData[] | null>(null);
  const [visualRaw, setVisualRaw] = useState<ProductCardData[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [shopLabel, setShopLabel] = useState<string | null>(null);
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [facet, setFacet] = useState<CatalogFacetPayload | null>(null);
  const [facetLoading, setFacetLoading] = useState(false);
  const structuredFacetsParam = params.get("structuredFacets") ?? "";
  const structuredClausesParsed = useMemo(
    () => parseStructuredFacetsParam(structuredFacetsParam),
    [structuredFacetsParam],
  );

  const [structuredAttrFacets, setStructuredAttrFacets] = useState<(StructuredFacetApiDiscrete | StructuredFacetApiRange)[] | null>(
    null,
  );
  const [structuredFacetLoading, setStructuredFacetLoading] = useState(false);

  const seoTitle = q.trim()
    ? `Pesquisar "${q.trim()}" — BAZAR DO BIÉ`
    : onSale
      ? "Promoções no catálogo — BAZAR DO BIÉ"
      : featured
        ? "Seleção em destaque — BAZAR DO BIÉ"
        : shopId && shopLabel
          ? `Artigos de ${shopLabel} — BAZAR DO BIÉ`
          : shopId
            ? "Catálogo da loja — BAZAR DO BIÉ"
            : "Pesquisar produtos — BAZAR DO BIÉ";
  const seoDescription = q.trim()
    ? `Resultados para "${q.trim()}" no marketplace BAZAR DO BIÉ. Compare preços, avaliações e prazos de envio em Angola.`
    : onSale
      ? "Filtro activo: produtos em promoção. Compare preços e condições no BAZAR DO BIÉ."
      : featured
        ? "Seleção oficial em destaque no BAZAR DO BIÉ."
        : "Pesquise produtos, filtre por preço, avaliação e categoria no marketplace BAZAR DO BIÉ.";
  useSeo({
    title: visualMode ? "Pesquisa por imagem — BAZAR DO BIÉ" : seoTitle,
    description: visualMode
      ? "Resultados visuais com base na imagem enviada. Refine por filtros para encontrar o produto ideal."
      : seoDescription,
    canonicalPath: `/search${canonicalQuery}`,
  });

  useEffect(() => {
    setMinPrice(minPriceParam ?? "");
    setMaxPrice(maxPriceParam ?? "");
  }, [minPriceParam, maxPriceParam]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 280);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    void getPublicCategories().then(setCats);
  }, []);

  const facetQueryKey = useMemo(() => {
    const p = new URLSearchParams();
    const qt = debouncedQ.trim();
    if (qt) p.set("q", qt);
    if (condition) p.set("condition", condition);
    const mn = Number(minRating);
    if (mn >= 1 && mn <= 5) p.set("minRating", String(mn));
    const minP = parsePriceFilterInput(minPriceParam);
    const maxP = parsePriceFilterInput(maxPriceParam);
    if (minP != null) p.set("minPrice", String(minP));
    if (maxP != null) p.set("maxPrice", String(maxP));
    if (featured) p.set("featured", "true");
    if (onSale) p.set("onSale", "true");
    if (shopId) p.set("shopId", shopId);
    if (structuredFacetsParam.trim()) p.set("structuredFacets", structuredFacetsParam.trim());
    return p.toString();
  }, [debouncedQ, condition, minRating, minPriceParam, maxPriceParam, featured, onSale, shopId, structuredFacetsParam]);

  const structuredFacetApiQuery = useMemo(() => {
    if (!categoryId || visualMode) return "";
    const p = new URLSearchParams();
    p.set("categoryId", categoryId);
    const qt = debouncedQ.trim();
    if (qt) p.set("q", qt);
    if (condition) p.set("condition", condition);
    const mn = Number(minRating);
    if (mn >= 1 && mn <= 5) p.set("minRating", String(mn));
    const minP = parsePriceFilterInput(minPriceParam);
    const maxP = parsePriceFilterInput(maxPriceParam);
    if (minP != null) p.set("minPrice", String(minP));
    if (maxP != null) p.set("maxPrice", String(maxP));
    if (featured) p.set("featured", "true");
    if (onSale) p.set("onSale", "true");
    if (shopId) p.set("shopId", shopId);
    if (structuredFacetsParam.trim()) p.set("structuredFacets", structuredFacetsParam.trim());
    return p.toString();
  }, [
    categoryId,
    visualMode,
    debouncedQ,
    condition,
    minRating,
    minPriceParam,
    maxPriceParam,
    featured,
    onSale,
    shopId,
    structuredFacetsParam,
  ]);

  useEffect(() => {
    if (!structuredFacetApiQuery) {
      setStructuredAttrFacets(null);
      return;
    }
    let cancelled = false;
    setStructuredFacetLoading(true);
    void apiFetch<StructuredFacetApiPayload>(`/products/facet-structured-attributes?${structuredFacetApiQuery}`)
      .then((r) => {
        if (!cancelled) {
          console.log("[Structured Facets API Response]", r);
          setStructuredAttrFacets(r.facets ?? []);
        }
      })
      .catch((e) => {
        console.error("[Structured Facets API Error]", e);
        if (!cancelled) setStructuredAttrFacets(null);
      })
      .finally(() => {
        if (!cancelled) setStructuredFacetLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [structuredFacetApiQuery]);

  useEffect(() => {
    if (visualMode) return;
    let cancelled = false;
    setFacetLoading(true);
    void apiFetch<CatalogFacetPayload>(`/products/facet-categories?${facetQueryKey}`)
      .then((r) => {
        if (!cancelled)
          setFacet({
            counts: r.counts ?? {},
            total: Number(r.total) || 0,
            priceFloor: r.priceFloor != null && Number.isFinite(Number(r.priceFloor)) ? Number(r.priceFloor) : undefined,
            priceCeiling:
              r.priceCeiling != null && Number.isFinite(Number(r.priceCeiling)) ? Number(r.priceCeiling) : undefined,
          });
      })
      .catch(() => {
        /* mantém facet anterior em erro de rede */
      })
      .finally(() => {
        if (!cancelled) setFacetLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [facetQueryKey, visualMode]);

  useEffect(() => {
    if (!shopId) {
      setShopLabel(null);
      return;
    }
    let cancelled = false;
    void apiFetch<{ name: string }>(`/shops/${encodeURIComponent(shopId)}`)
      .then((s) => {
        if (!cancelled) setShopLabel(s.name);
      })
      .catch(() => {
        if (!cancelled) setShopLabel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const catalogQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (categoryId) p.set("categoryId", categoryId);
    if (sort) p.set("sort", sort);
    if (condition) p.set("condition", condition);
    const mn = Number(minRating);
    if (mn >= 1 && mn <= 5) p.set("minRating", String(mn));
    const minP = parsePriceFilterInput(minPriceParam);
    const maxP = parsePriceFilterInput(maxPriceParam);
    if (minP != null) p.set("minPrice", String(minP));
    if (maxP != null) p.set("maxPrice", String(maxP));
    if (featured) p.set("featured", "true");
    if (onSale) p.set("onSale", "true");
    if (shopId) p.set("shopId", shopId);
    if (structuredFacetsParam.trim()) p.set("structuredFacets", structuredFacetsParam.trim());
    p.set("take", String(PAGE_SIZE));
    return p.toString();
  }, [
    q,
    categoryId,
    sort,
    condition,
    minRating,
    minPriceParam,
    maxPriceParam,
    featured,
    onSale,
    shopId,
    structuredFacetsParam,
  ]);

  useEffect(() => {
    if (!visualMode) return;
    try {
      const raw = sessionStorage.getItem("ae_visual_search_v1");
      if (!raw) {
        setVisualRaw([]);
        return;
      }
      const parsed = JSON.parse(raw) as VisualSearchPayload;
      setVisualRaw(Array.isArray(parsed.items) ? parsed.items : []);
    } catch {
      setVisualRaw([]);
    }
  }, [visualMode]);

  useEffect(() => {
    if (visualMode) {
      setCatalogLoading(false);
      setCatalogError(false);
      return;
    }
    let cancelled = false;
    setData(null);
    setCatalogLoading(true);
    setCatalogError(false);
    void apiFetch<{ items: ProductCardData[]; total: number }>(`/products?${catalogQuery}`)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch(() => {
        if (!cancelled) {
          setData({ items: [], total: 0 });
          setCatalogError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [catalogQuery, visualMode]);

  useEffect(() => {
    if (!token || visualMode) {
      setForYou(null);
      return;
    }
    let cancelled = false;
    void apiFetch<{ items: ProductCardData[] }>("/personalization/for-you?take=8", { token })
      .then((r) => {
        if (!cancelled) setForYou(r.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setForYou([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, visualMode]);

  const loadMore = useCallback(async () => {
    if (visualMode || !data || loadingMore) return;
    if (data.items.length >= data.total) return;
    setLoadingMore(true);
    try {
      const p = new URLSearchParams(catalogQuery);
      p.set("skip", String(data.items.length));
      const more = await apiFetch<{ items: ProductCardData[]; total: number }>(`/products?${p.toString()}`);
      setData((prev) =>
        prev ? { total: more.total, items: [...prev.items, ...more.items] } : more,
      );
    } catch {
      /* ignorar — utilizador pode tentar de novo */
    } finally {
      setLoadingMore(false);
    }
  }, [visualMode, data, loadingMore, catalogQuery]);

  const visualFiltered = useMemo(() => {
    if (!visualMode) return null;
    const term = q.trim().toLowerCase();
    const minN = parsePriceFilterInput(minPriceParam);
    const maxN = parsePriceFilterInput(maxPriceParam);
    const ratingN = Number(minRating);
    const items = visualRaw
      .filter((p) => {
        if (term && !p.name.toLowerCase().includes(term)) return false;
        const priceN = Number(p.displayPrice ?? p.promoPrice ?? p.price ?? 0);
        if (minN != null && priceN < minN) return false;
        if (maxN != null && priceN > maxN) return false;
        if (Number.isFinite(ratingN) && ratingN >= 1 && Number(p.averageRating ?? 0) < ratingN) return false;
        if (condition && (p.condition ?? "") !== condition) return false;
        if (featured && !p.isFeatured) return false;
        if (onSale) {
          const promo = p.promoPrice != null ? Number(p.promoPrice) : NaN;
          if (!Number.isFinite(promo) || promo <= 0) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priceA = Number(a.displayPrice ?? a.promoPrice ?? a.price ?? 0);
        const priceB = Number(b.displayPrice ?? b.promoPrice ?? b.price ?? 0);
        if (sort === "preco_asc") return priceA - priceB;
        if (sort === "preco_desc") return priceB - priceA;
        if (sort === "mais_vendidos") return Number(b.soldCount || 0) - Number(a.soldCount || 0);
        if (sort === "melhor_avaliados") return Number(b.averageRating || 0) - Number(a.averageRating || 0);
        /* recentes: manter ordem por proximidade visual (relevância da pesquisa por imagem) */
        return 0;
      });
    return { items, total: items.length };
  }, [
    visualMode,
    visualRaw,
    q,
    minPriceParam,
    maxPriceParam,
    minRating,
    condition,
    sort,
    featured,
    onSale,
  ]);

  const effectiveData = visualMode ? visualFiltered ?? { items: [], total: 0 } : data;

  const rangeLabel = useMemo(() => {
    if (!effectiveData || effectiveData.total === 0 || effectiveData.items.length === 0) return null;
    const to = effectiveData.items.length;
    return `Mostrando 1–${to.toLocaleString("pt-AO")} de ${effectiveData.total.toLocaleString("pt-AO")}`;
  }, [effectiveData]);

  const categoryLabel = useMemo(() => {
    if (!categoryId) return "";
    return cats.find((c) => c.id === categoryId)?.name ?? "";
  }, [cats, categoryId]);

  const activeFilterChips = useMemo(() => {
    const out: { label: string; patch: Record<string, string | null> }[] = [];
    if (categoryId && categoryLabel) out.push({ label: categoryLabel, patch: { categoryId: null } });
    if (featured) out.push({ label: "Em destaque", patch: { featured: null } });
    if (onSale) out.push({ label: "Em promoção", patch: { onSale: null } });
    if (condition) out.push({ label: conditionShortLabel(condition), patch: { condition: null } });
    if (minRating)
      out.push({
        label: `Avaliação ≥ ${minRating}★`,
        patch: { minRating: null },
      });
    const minParsedChip = parsePriceFilterInput(minPriceParam);
    const maxParsedChip = parsePriceFilterInput(maxPriceParam);
    if (minParsedChip != null || maxParsedChip != null) {
      const bit = [
        minParsedChip != null ? `≥ ${minParsedChip.toLocaleString("pt-AO")}` : null,
        maxParsedChip != null ? `≤ ${maxParsedChip.toLocaleString("pt-AO")}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      out.push({ label: `Preço ${bit} Kz`, patch: { minPrice: null, maxPrice: null } });
    }
    if (shopId) out.push({ label: shopLabel ? `Loja: ${shopLabel}` : "Loja filtrada", patch: { shopId: null } });
    if (structuredClausesParsed.length > 0)
      out.push({
        label: catalogStructuredFiltersChipLabel(structuredClausesParsed.length),
        patch: { structuredFacets: null },
      });
    if (sort !== "recentes") {
      const sl = sorts.find((s) => s.k === sort)?.label ?? sort;
      out.push({ label: `Ordenação: ${sl}`, patch: { sort: null } });
    }
    return out;
  }, [
    categoryId,
    categoryLabel,
    featured,
    onSale,
    condition,
    minRating,
    minPriceParam,
    maxPriceParam,
    shopId,
    shopLabel,
    sort,
    structuredClausesParsed.length,
  ]);

  /** Texto explicativo quando a lista filtrada está vazia (filtros restritivos ≠ erro do site). */
  const searchEmptyStateHint = useMemo(() => {
    const constraints: string[] = [];
    if (q.trim()) constraints.push("termo de pesquisa");
    if (categoryId && categoryLabel) constraints.push(`categoria «${categoryLabel}»`);
    if (condition) constraints.push(`condição «${conditionShortLabel(condition)}»`);
    const minP = parsePriceFilterInput(minPriceParam);
    const maxP = parsePriceFilterInput(maxPriceParam);
    if (minP != null || maxP != null) constraints.push("filtro de preço");
    const mn = Number(minRating);
    if (mn >= 1 && mn <= 5) constraints.push("avaliação mínima");
    if (featured) constraints.push("só artigos em destaque");
    if (onSale) constraints.push("só artigos em promoção");
    if (shopId) constraints.push("uma loja específica");
    if (structuredClausesParsed.length > 0) constraints.push("filtros da ficha técnica");

    let combo = "";
    if (constraints.length === 1) combo = constraints[0];
    else if (constraints.length === 2) combo = `${constraints[0]} e ${constraints[1]}`;
    else if (constraints.length > 2)
      combo = `${constraints.slice(0, -1).join(", ")} e ${constraints[constraints.length - 1]}`;

    let s =
      "É frequente não haver resultados quando os critérios são apertados: só contam artigos homologados que cumpram todos os filtros ao mesmo tempo.";
    if (combo) s += ` Neste momento está a limitar por ${combo}.`;
    s +=
      " As «Sugestões para si» mais abaixo são recomendações paralelas — não aplicam automaticamente estes filtros. Experimente alargar preço ou condição, ou reformular o termo.";
    return s;
  }, [
    q,
    categoryId,
    categoryLabel,
    condition,
    minPriceParam,
    maxPriceParam,
    minRating,
    featured,
    onSale,
    shopId,
    structuredClausesParsed.length,
  ]);

  const showLoadMore =
    !visualMode &&
    !catalogLoading &&
    effectiveData != null &&
    effectiveData.items.length > 0 &&
    effectiveData.items.length < effectiveData.total;

  /** Limites reais do catálogo (faceta sem intervalo de preço): usados para normalizar query ao aplicar o slider. */
  const catalogPriceBounds = useMemo(() => {
    let pf =
      facet?.priceFloor != null && Number.isFinite(facet.priceFloor) ? Math.max(0, facet.priceFloor) : 0;
    let pt =
      facet?.priceCeiling != null && Number.isFinite(facet.priceCeiling)
        ? facet.priceCeiling
        : DEFAULT_PRICE_CEILING;
    if (pt < pf) [pf, pt] = [pt, pf];
    return { pf, pt };
  }, [facet?.priceFloor, facet?.priceCeiling]);

  /**
   * Domínio do slider: inclui sempre os valores já committed na URL, para não clampar o máximo
   * abaixo do chip (ex.: faceta USED até 185 k com maxPrice=5,6 M na URL) e evitar trilho degenerado
   * (ceiling ≤ floor ou ceiling === 0).
   */
  const sliderPriceBounds = useMemo(() => {
    const { pf, pt } = catalogPriceBounds;
    const amin = parsePriceFilterInput(minPriceParam);
    const amax = parsePriceFilterInput(maxPriceParam);
    let sf = Math.min(pf, amin ?? pf);
    sf = Math.max(0, sf);
    let st = Math.max(pt, amax ?? pt, amin ?? pt);
    if (st <= sf) st = sf + 1;
    return { sf, st };
  }, [catalogPriceBounds, minPriceParam, maxPriceParam]);

  const commitNumericPricesToUrl = useCallback(
    (rawMin?: number | null, rawMax?: number | null) => {
      const n = new URLSearchParams(params);
      let lo = rawMin === undefined || rawMin === null ? undefined : rawMin;
      let hi = rawMax === undefined || rawMax === null ? undefined : rawMax;

      const { pf, pt } = catalogPriceBounds;

      if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];

      const span = Math.max(pt - pf, 1);
      const eps = Math.max(span * 0.0005, 1);

      if (lo != null && lo <= pf + eps) lo = undefined;
      if (hi != null && hi >= pt - eps) hi = undefined;

      if (lo != null) n.set("minPrice", String(Math.round(lo)));
      else n.delete("minPrice");
      if (hi != null) n.set("maxPrice", String(Math.round(hi)));
      else n.delete("maxPrice");
      setParams(n);
    },
    [params, setParams, catalogPriceBounds],
  );

  function applyPrice() {
    commitNumericPricesToUrl(parsePriceFilterInput(minPrice), parsePriceFilterInput(maxPrice));
  }

  function clearFiltersKeepQuery() {
    const n = new URLSearchParams();
    if (q.trim()) n.set("q", q.trim());
    setParams(n);
  }

  return (
    <div className="ae-layout-search">
      <aside className={`ae-filters ${sideCollapsed ? "ae-filters--collapsed" : ""}`}>
        <button
          type="button"
          className="ae-filters__toggle"
          aria-expanded={mobileFiltersOpen}
          onClick={() => setMobileFiltersOpen((v) => !v)}
        >
          {CATALOG_TERMS.searchFiltersMobileToggle}
        </button>
        <button
          type="button"
          className="ae-filters__collapse"
          aria-expanded={!sideCollapsed}
          onClick={() => setSideCollapsed((v) => !v)}
        >
          {sideCollapsed ? CATALOG_TERMS.searchFiltersExpand : CATALOG_TERMS.searchFiltersCollapse}
        </button>
        <h3 className="ae-filters__panel-title">{CATALOG_TERMS.searchFiltersPanelHeading}</h3>
        <div
          className={`ae-filters__body ${mobileFiltersOpen ? "ae-filters__body--open" : ""} ${sideCollapsed ? "ae-filters__body--collapsed" : ""}`}
        >
          <section className="ae-filters__group" aria-labelledby="ae-filt-category">
            <strong id="ae-filt-category" className="ae-filters__group-title">
              {CATALOG_TERMS.searchCategoryGroupTitle}
            </strong>
            <p className="ae-filters__facet-hint ae-muted">
              {visualMode ? CATALOG_TERMS.searchCategoryFacetHintVisual : CATALOG_TERMS.searchCategoryFacetHintNormal}
            </p>
            <CategoryFacetNav
              params={params}
              cats={cats}
              categoryId={categoryId}
              facet={facet}
              facetLoading={facetLoading}
              visualMode={visualMode}
            />
          </section>
          <section className="ae-filters__group" aria-labelledby="ae-filt-structured">
            <strong id="ae-filt-structured" className="ae-filters__group-title">
              {CATALOG_TERMS.searchStructuredGroupTitle}
            </strong>
            <p className="ae-filters__facet-hint ae-muted">{CATALOG_TERMS.searchStructuredGroupHint}</p>
            {visualMode ? (
              <p className="ae-muted" style={{ fontSize: 13 }}>
                {CATALOG_TERMS.searchStructuredVisualUnavailable}
              </p>
            ) : !categoryId ? (
              <p className="ae-muted" style={{ fontSize: 13 }}>
                {CATALOG_TERMS.searchPickCategoryForStructured}
              </p>
            ) : structuredFacetLoading ? (
              <p className="ae-muted">{CATALOG_TERMS.searchLoadingStructured}</p>
            ) : !structuredAttrFacets || structuredAttrFacets.length === 0 ? (
              <p className="ae-muted" style={{ fontSize: 13 }}>
                {CATALOG_TERMS.searchNoStructuredFilters}
              </p>
            ) : (
              <div className="ae-struct-facets">
                {structuredAttrFacets.map((f) => {
                  console.log("[Rendering Facet]", f.label, f.facetKind, f.values?.length ?? 0, "values");
                  return f.facetKind === "discrete" ? (
                    <div key={f.attributeId} className="ae-struct-facet-block">
                      <div className="ae-struct-facet-block__title">{f.label}</div>
                      <div className="ae-filters__checks ae-struct-facet-checks">
                        {f.values.slice(0, DISCRETE_FACET_VISIBLE).map((row) => (
                          <label key={row.value} className="ae-filters__check">
                            <input
                              type="checkbox"
                              checked={isDiscreteValueSelected(structuredClausesParsed, f.attributeId, row.value)}
                              onChange={(e) => {
                                const n = new URLSearchParams(params);
                                const prev = parseStructuredFacetsParam(n.get("structuredFacets"));
                                const next = toggleDiscreteValue(prev, f.attributeId, row.value, e.target.checked);
                                if (next.length === 0) n.delete("structuredFacets");
                                else n.set("structuredFacets", serializeStructuredFacets(next));
                                setParams(n);
                              }}
                            />
                            <span>
                              {row.value}{" "}
                              <span className="ae-muted">({row.count.toLocaleString("pt-AO")})</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      {f.values.length > DISCRETE_FACET_VISIBLE ? (
                        <details className="ae-struct-facet-more">
                          <summary className="ae-struct-facet-more__summary">
                            {catalogStructuredDiscreteFacetMoreLabel(
                              f.values.length - DISCRETE_FACET_VISIBLE,
                            )}
                          </summary>
                          <div className="ae-filters__checks ae-struct-facet-checks">
                            {f.values.slice(DISCRETE_FACET_VISIBLE).map((row) => (
                              <label key={row.value} className="ae-filters__check">
                                <input
                                  type="checkbox"
                                  checked={isDiscreteValueSelected(
                                    structuredClausesParsed,
                                    f.attributeId,
                                    row.value,
                                  )}
                                  onChange={(e) => {
                                    const n = new URLSearchParams(params);
                                    const prev = parseStructuredFacetsParam(n.get("structuredFacets"));
                                    const next = toggleDiscreteValue(
                                      prev,
                                      f.attributeId,
                                      row.value,
                                      e.target.checked,
                                    );
                                    if (next.length === 0) n.delete("structuredFacets");
                                    else n.set("structuredFacets", serializeStructuredFacets(next));
                                    setParams(n);
                                  }}
                                />
                                <span>
                                  {row.value}{" "}
                                  <span className="ae-muted">({row.count.toLocaleString("pt-AO")})</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ) : (
                    <div key={f.attributeId} className="ae-struct-facet-block">
                      <div className="ae-struct-facet-block__title">
                        {f.label}
                        {f.unitCode ? <span className="ae-muted"> ({f.unitCode})</span> : null}
                        {f.valueCount > 0 ? (
                          <span className="ae-muted"> · {f.valueCount.toLocaleString("pt-AO")} valores</span>
                        ) : null}
                      </div>
                      <StructuredNumericFacetFilter
                        facet={f}
                        structuredFacetsParam={structuredFacetsParam}
                        params={params}
                        setParams={setParams}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <section
            className="ae-filters__group ae-filters__group--price"
            aria-labelledby="ae-filt-price"
          >
            <strong id="ae-filt-price" className="ae-filters__group-title">
              {CATALOG_TERMS.searchPriceGroupTitle}
            </strong>
            <p className="ae-filters__facet-hint ae-muted">
              {CATALOG_TERMS.searchPriceGroupHint}
              {visualMode ? CATALOG_TERMS.searchPriceGroupHintVisualSuffix : ""}
            </p>
            <SearchPriceRange
              disabled={visualMode}
              floor={sliderPriceBounds.sf}
              ceiling={sliderPriceBounds.st}
              minPriceParam={minPriceParam}
              maxPriceParam={maxPriceParam}
              minDraft={minPrice}
              maxDraft={maxPrice}
              onMinDraftChange={setMinPrice}
              onMaxDraftChange={setMaxPrice}
              onApplyTextInputs={applyPrice}
              commitSliderRange={(lo, hi) => commitNumericPricesToUrl(lo, hi)}
            />
          </section>
          <section className="ae-filters__group" aria-labelledby="ae-filt-condition">
            <strong id="ae-filt-condition" className="ae-filters__group-title">
              {CATALOG_TERMS.searchConditionGroupTitle}
            </strong>
            <p className="ae-filters__facet-hint ae-muted">{CATALOG_TERMS.searchConditionGroupHint}</p>
            <fieldset className="ae-filters__fieldset">
              <legend className="sr-only">{CATALOG_TERMS.searchConditionGroupTitle}</legend>
              <div className="ae-filters__radio-grid" role="presentation">
                {CONDITION_FILTER_OPTIONS.map((opt) => {
                  const selected = condition === opt.value;
                  return (
                    <label
                      key={opt.value || "any"}
                      className={`ae-filters__radio-row${selected ? " ae-filters__radio-row--checked" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`ae-search-condition-${conditionGroupId}`}
                        checked={selected}
                        onChange={() => {
                          const n = new URLSearchParams(params);
                          if (opt.value) n.set("condition", opt.value);
                          else n.delete("condition");
                          setParams(n);
                        }}
                      />
                      <span>
                        <span className="ae-filters__radio-main">{opt.label}</span>
                        <span className="ae-filters__radio-hint">{opt.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>
          <section className="ae-filters__group" aria-labelledby="ae-filt-rating">
            <strong id="ae-filt-rating" className="ae-filters__group-title">
              {CATALOG_TERMS.searchRatingGroupTitle}
            </strong>
            <p className="ae-filters__facet-hint ae-muted">{CATALOG_TERMS.searchRatingGroupHint}</p>
            <fieldset className="ae-filters__fieldset">
              <legend className="sr-only">{CATALOG_TERMS.searchRatingGroupTitle}</legend>
              <div className="ae-filters__radio-grid" role="presentation">
                {MIN_RATING_FILTER_OPTIONS.map((opt) => {
                  const selected = minRating === opt.value;
                  return (
                    <label
                      key={opt.value || "rating-any"}
                      className={`ae-filters__radio-row ae-filters__radio-row--rating${selected ? " ae-filters__radio-row--checked" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`ae-search-rating-${ratingGroupId}`}
                        checked={selected}
                        aria-label={
                          opt.value === ""
                            ? opt.title
                            : `${opt.title} — média de avaliações igual ou superior a ${opt.value} em cinco`
                        }
                        onChange={() => {
                          const n = new URLSearchParams(params);
                          if (opt.value) n.set("minRating", opt.value);
                          else n.delete("minRating");
                          setParams(n);
                        }}
                      />
                      <span className="ae-filters__rating-radio-body">
                        {opt.showStars > 0 ? (
                          <span className="ae-filters__rating-strip">
                            <StarRating value={opt.showStars} size="sm" tone="gold" className="ae-filters__rating-strip-visual" />
                            <span className="ae-filters__radio-main">{opt.title}</span>
                          </span>
                        ) : (
                          <span className="ae-filters__radio-main">{opt.title}</span>
                        )}
                        <span className="ae-filters__radio-hint">{opt.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>
          <section className="ae-filters__group" aria-labelledby="ae-filt-curation">
            <strong id="ae-filt-curation" className="ae-filters__group-title">
              {CATALOG_TERMS.searchCurationGroupTitle}
            </strong>
            <p className="ae-filters__facet-hint ae-muted">{CATALOG_TERMS.searchCurationGroupHint}</p>
            <div className="ae-filters__checks">
              <label className="ae-filters__check">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => {
                    const n = new URLSearchParams(params);
                    if (e.target.checked) n.set("featured", "true");
                    else n.delete("featured");
                    setParams(n);
                  }}
                />
                {CATALOG_TERMS.searchFeaturedOnly}
              </label>
              <label className="ae-filters__check">
                <input
                  type="checkbox"
                  checked={onSale}
                  onChange={(e) => {
                    const n = new URLSearchParams(params);
                    if (e.target.checked) n.set("onSale", "true");
                    else n.delete("onSale");
                    setParams(n);
                  }}
                />
                {CATALOG_TERMS.searchPromoOnly}
              </label>
            </div>
          </section>
        </div>
      </aside>

      <div className="ae-layout-search__main">
        <div className="ae-toolbar">
          <div className="ae-sort" role="group" aria-label="Ordenação dos resultados">
            {sorts.map((s) => (
              <button
                key={s.k}
                type="button"
                className={sort === s.k ? "ae-on" : ""}
                aria-pressed={sort === s.k}
                onClick={() => {
                  const n = new URLSearchParams(params);
                  n.set("sort", s.k);
                  setParams(n);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="ae-toolbar__meta">
            {rangeLabel ? <span className="ae-toolbar__range">{rangeLabel}</span> : null}
            <span className="ae-toolbar__count">
              {effectiveData != null ? (
                <>
                  {effectiveData.total.toLocaleString("pt-AO")} resultado(s)
                  {featured ? <span className="ae-toolbar__pill ae-toolbar__pill--accent">Destaque</span> : null}
                  {onSale ? <span className="ae-toolbar__pill ae-toolbar__pill--promo">Promoções</span> : null}
                  {shopId ? <span className="ae-toolbar__pill">Uma loja</span> : null}
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
        </div>

        {activeFilterChips.length > 0 ? (
          <div
            className="ae-active-filters"
            role="group"
            aria-label={CATALOG_TERMS.searchActiveFiltersGroupAria}
          >
            <span className="ae-active-filters__label">{CATALOG_TERMS.searchActiveFiltersBarTitle}:</span>
            {activeFilterChips.map((chip, i) => (
              <Link
                key={`f-${i}-${chip.label}`}
                to={buildSearchPath("/search", params, chip.patch)}
                className="ae-active-filters__chip"
              >
                {chip.label}
                <span aria-hidden> ×</span>
              </Link>
            ))}
            <button
              type="button"
              className="ae-active-filters__clear"
              onClick={clearFiltersKeepQuery}
              title={CATALOG_TERMS.searchClearAllFiltersHint}
            >
              {CATALOG_TERMS.searchClearAllFilters}
            </button>
          </div>
        ) : null}

        {shopId ? (
          <div className="ae-shop-filter-banner page-panel">
            <p style={{ margin: 0, fontSize: 14 }}>
              <strong>Catálogo filtrado por loja:</strong> {shopLabel ?? "A carregar…"}{" "}
              <Link to={`/loja/${encodeURIComponent(shopId)}`}>Abrir página da loja</Link>
              {" · "}
              <Link to={buildSearchPath("/search", params, { shopId: null })}>Remover filtro</Link>
            </p>
          </div>
        ) : null}
        {visualMode ? (
          <p className="ae-catalog-note">Pesquisa por imagem activa. Para nova imagem, use o ícone de câmara na barra de pesquisa.</p>
        ) : null}
        <p className="ae-catalog-note">
          Apresentamos apenas artigos homologados e lojas com registo comercial válido na plataforma. Referências pendentes
          de validação não são exibidas.
        </p>
        {catalogError ? (
          <div className="page-panel ae-search-empty" role="alert">
            Não foi possível carregar o catálogo. Verifique a ligação e tente actualizar a página.
          </div>
        ) : null}

        {!visualMode && catalogLoading ? (
          <section className="ae-grid" aria-busy="true" aria-label="A carregar resultados">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="ae-skel ae-skel-pcard" />
            ))}
          </section>
        ) : !effectiveData ? (
          <p className="ae-muted">A consultar o catálogo…</p>
        ) : effectiveData.items.length === 0 ? (
          <div className="page-panel ae-empty-center ae-search-empty">
            <p className="ae-search-empty__lead">Não foram encontradas referências com os critérios seleccionados.</p>
            <p className="ae-muted ae-search-empty__hint">{searchEmptyStateHint}</p>
          </div>
        ) : (
          <>
            <section className="ae-grid">
              {effectiveData.items.map((p, idx) => (
                <ProductCard key={p.id} p={p} imagePriority={idx < 6} />
              ))}
            </section>
            {showLoadMore ? (
              <button type="button" className="ae-search-load-more" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? "A carregar…" : `Carregar mais (${(data?.total ?? 0) - (data?.items.length ?? 0)} restantes)`}
              </button>
            ) : null}
          </>
        )}

        {!visualMode && forYou !== null && forYou.length > 0 ? (
          <section className="ae-search-reco" aria-labelledby="ae-search-reco-title">
            <div className="ae-search-reco__head">
              <h2 id="ae-search-reco-title">Sugestões para si</h2>
              <p className="ae-muted">Com base na sua actividade e preferências na plataforma.</p>
              <Link to="/#ae-home-foryou">Ver recomendações completas na página inicial</Link>
            </div>
            <div className="ae-grid">
              {forYou.map((p) => (
                <ProductCard key={`reco-${p.id}`} p={p} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
