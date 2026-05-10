import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { ProductCard, type ProductCardData } from "../components/ProductCard.js";
import { buildSearchPath } from "../buildSearchPath.js";
import { getPublicCategories, type PublicCategory } from "../data/publicCategoriesCache.js";
import { useSeo } from "../seo/useSeo.js";

type Category = PublicCategory;
type VisualSearchPayload = { items?: ProductCardData[]; total?: number };

const PAGE_SIZE = 36;

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

type CategoryFacetNavProps = {
  params: URLSearchParams;
  cats: Category[];
  categoryId: string;
  facet: { counts: Record<string, number>; total: number } | null;
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
            to={buildSearchPath("/search", params, { categoryId: cat.id })}
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
        to={buildSearchPath("/search", params, { categoryId: null })}
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
  const [facet, setFacet] = useState<{ counts: Record<string, number>; total: number } | null>(null);
  const [facetLoading, setFacetLoading] = useState(false);

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
    if (minPrice) p.set("minPrice", minPrice);
    if (maxPrice) p.set("maxPrice", maxPrice);
    if (featured) p.set("featured", "true");
    if (onSale) p.set("onSale", "true");
    if (shopId) p.set("shopId", shopId);
    return p.toString();
  }, [debouncedQ, condition, minRating, minPrice, maxPrice, featured, onSale, shopId]);

  useEffect(() => {
    if (visualMode) return;
    let cancelled = false;
    setFacetLoading(true);
    void apiFetch<{ counts: Record<string, number>; total: number }>(`/products/facet-categories?${facetQueryKey}`)
      .then((r) => {
        if (!cancelled) setFacet({ counts: r.counts ?? {}, total: Number(r.total) || 0 });
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
    if (minPrice) p.set("minPrice", minPrice);
    if (maxPrice) p.set("maxPrice", maxPrice);
    if (featured) p.set("featured", "true");
    if (onSale) p.set("onSale", "true");
    if (shopId) p.set("shopId", shopId);
    p.set("take", String(PAGE_SIZE));
    return p.toString();
  }, [q, categoryId, sort, condition, minRating, minPrice, maxPrice, featured, onSale, shopId]);

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
    const minN = Number(minPrice);
    const maxN = Number(maxPrice);
    const ratingN = Number(minRating);
    const items = visualRaw
      .filter((p) => {
        if (term && !p.name.toLowerCase().includes(term)) return false;
        const priceN = Number(p.displayPrice ?? p.promoPrice ?? p.price ?? 0);
        if (Number.isFinite(minN) && minPrice !== "" && priceN < minN) return false;
        if (Number.isFinite(maxN) && maxPrice !== "" && priceN > maxN) return false;
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
  }, [visualMode, visualRaw, q, minPrice, maxPrice, minRating, condition, sort, featured, onSale]);

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
    if (minRating) out.push({ label: `${minRating}+ estrelas`, patch: { minRating: null } });
    if (minPrice || maxPrice) {
      const bit = [minPrice ? `≥ ${minPrice}` : null, maxPrice ? `≤ ${maxPrice}` : null]
        .filter(Boolean)
        .join(" · ");
      out.push({ label: `Preço ${bit} Kz`, patch: { minPrice: null, maxPrice: null } });
    }
    if (shopId) out.push({ label: shopLabel ? `Loja: ${shopLabel}` : "Loja filtrada", patch: { shopId: null } });
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
    minPrice,
    maxPrice,
    shopId,
    shopLabel,
    sort,
  ]);

  const showLoadMore =
    !visualMode &&
    !catalogLoading &&
    effectiveData != null &&
    effectiveData.items.length > 0 &&
    effectiveData.items.length < effectiveData.total;

  function applyPrice() {
    const n = new URLSearchParams(params);
    const minN = minPrice ? Number(minPrice) : undefined;
    const maxN = maxPrice ? Number(maxPrice) : undefined;
    const safeMin =
      minN != null && Number.isFinite(minN) && minN >= 0
        ? maxN != null && Number.isFinite(maxN) && maxN >= 0 && minN > maxN
          ? maxN
          : minN
        : undefined;
    const safeMax =
      maxN != null && Number.isFinite(maxN) && maxN >= 0
        ? minN != null && Number.isFinite(minN) && minN >= 0 && maxN < minN
          ? minN
          : maxN
        : undefined;
    if (safeMin != null) n.set("minPrice", String(safeMin));
    else n.delete("minPrice");
    if (safeMax != null) n.set("maxPrice", String(safeMax));
    else n.delete("maxPrice");
    setParams(n);
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
          Filtros e categorias
        </button>
        <button
          type="button"
          className="ae-filters__collapse"
          aria-expanded={!sideCollapsed}
          onClick={() => setSideCollapsed((v) => !v)}
        >
          {sideCollapsed ? "Expandir filtros" : "Encolher filtros"}
        </button>
        <h3>Critérios</h3>
        <div
          className={`ae-filters__body ${mobileFiltersOpen ? "ae-filters__body--open" : ""} ${sideCollapsed ? "ae-filters__body--collapsed" : ""}`}
        >
          <div className="ae-filters__group">
            <strong>Curadoria da plataforma</strong>
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
                Só em destaque
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
                Só em promoção
              </label>
            </div>
          </div>
          <div className="ae-filters__group">
            <strong>Categoria</strong>
            <p className="ae-filters__facet-hint ae-muted">
              {visualMode
                ? "Contagens não aplicáveis à pesquisa por imagem."
                : "Números com os filtros actuais (exceto categoria)."}
            </p>
            <CategoryFacetNav
              params={params}
              cats={cats}
              categoryId={categoryId}
              facet={facet}
              facetLoading={facetLoading}
              visualMode={visualMode}
            />
          </div>
          <div className="ae-filters__group">
            <strong>Condição do artigo</strong>
            <select
              className="ae-filters__select"
              aria-label="Filtrar por condição do artigo"
              value={condition}
              onChange={(e) => {
                const v = e.target.value;
                const n = new URLSearchParams(params);
                if (v) n.set("condition", v);
                else n.delete("condition");
                setParams(n);
              }}
            >
              <option value="">Qualquer</option>
              <option value="NEW">Novo</option>
              <option value="USED">Usado</option>
              <option value="REFURBISHED">Recondicionado</option>
            </select>
          </div>
          <div className="ae-filters__group">
            <strong>Avaliação mínima</strong>
            <select
              className="ae-filters__select"
              aria-label="Filtrar por avaliação mínima"
              value={minRating}
              onChange={(e) => {
                const v = e.target.value;
                const n = new URLSearchParams(params);
                if (v) n.set("minRating", v);
                else n.delete("minRating");
                setParams(n);
              }}
            >
              <option value="">Qualquer</option>
              {[4, 3, 2, 1].map((n) => (
                <option key={n} value={String(n)}>
                  {n}+ estrelas
                </option>
              ))}
            </select>
          </div>
          <div className="ae-filters__group">
            <strong>Preço (Kz)</strong>
            <div className="ae-filters__price-row">
              <input
                className="ae-filters__input"
                type="number"
                inputMode="numeric"
                placeholder="Mín."
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyPrice();
                  }
                }}
              />
              <input
                className="ae-filters__input"
                type="number"
                inputMode="numeric"
                placeholder="Máx."
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyPrice();
                  }
                }}
              />
            </div>
            <button type="button" className="btn btn-primary ae-filters__apply" onClick={applyPrice}>
              Aplicar intervalo
            </button>
          </div>
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
          <div className="ae-active-filters" aria-label="Filtros activos">
            <span className="ae-active-filters__label">Filtros:</span>
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
            <button type="button" className="ae-active-filters__clear" onClick={clearFiltersKeepQuery}>
              Limpar filtros
            </button>
          </div>
        ) : null}

        {shopId ? (
          <div className="ae-shop-filter-banner page-panel">
            <p style={{ margin: 0, fontSize: 14 }}>
              <strong>Catálogo filtrado por loja:</strong> {shopLabel ?? "A carregar…"}{" "}
              <Link to={`/loja/${encodeURIComponent(shopId)}/sobre`}>Perfil e confiança</Link>
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
            Não foram encontradas referências com os critérios seleccionados. Ajuste filtros ou o termo de pesquisa.
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
