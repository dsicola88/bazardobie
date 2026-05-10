import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { ProductCard, type ProductCardData } from "../components/ProductCard.js";
import { buildSearchPath } from "../buildSearchPath.js";
import { useSeo } from "../seo/useSeo.js";

type Category = { id: string; name: string; slug: string; parentId: string | null };
type VisualSearchPayload = { items?: ProductCardData[]; total?: number };

const sorts: { k: string; label: string }[] = [
  { k: "recentes", label: "Novidades" },
  { k: "mais_vendidos", label: "Mais vendidos" },
  { k: "preco_asc", label: "Preço ↑" },
  { k: "preco_desc", label: "Preço ↓" },
  { k: "melhor_avaliados", label: "Melhor avaliados" },
];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
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
  const [visualRaw, setVisualRaw] = useState<ProductCardData[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [shopLabel, setShopLabel] = useState<string | null>(null);

  const seoTitle = q.trim()
    ? `Pesquisar "${q.trim()}" — BAZAR DO BIÉ`
    : onSale
      ? "Promoções no catálogo — BAZAR DO BIÉ"
      : featured
        ? "Seleção em destaque — BAZAR DO BIÉ"
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
    canonicalPath: `/search${window.location.search}`,
  });

  useEffect(() => {
    setMinPrice(minPriceParam ?? "");
    setMaxPrice(maxPriceParam ?? "");
  }, [minPriceParam, maxPriceParam]);

  useEffect(() => {
    void apiFetch<Category[]>("/categories").then(setCats).catch(() => setCats([]));
  }, []);

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

  const qs = useMemo(() => {
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
    p.set("take", "36");
    return p.toString();
  }, [q, categoryId, sort, condition, minRating, minPrice, maxPrice, featured, onSale, shopId]);

  useEffect(() => {
    if (visualMode) {
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
      return;
    }
    setVisualRaw([]);
    void apiFetch<{ items: ProductCardData[]; total: number }>(`/products?${qs}`)
      .then(setData)
      .catch(() => setData({ items: [], total: 0 }));
  }, [qs, visualMode]);

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
        return true;
      })
      .sort((a, b) => {
        const priceA = Number(a.displayPrice ?? a.promoPrice ?? a.price ?? 0);
        const priceB = Number(b.displayPrice ?? b.promoPrice ?? b.price ?? 0);
        if (sort === "preco_asc") return priceA - priceB;
        if (sort === "preco_desc") return priceB - priceA;
        if (sort === "mais_vendidos") return Number(b.soldCount || 0) - Number(a.soldCount || 0);
        if (sort === "melhor_avaliados") return Number(b.averageRating || 0) - Number(a.averageRating || 0);
        return Number(b.soldCount || 0) - Number(a.soldCount || 0);
      });
    return { items, total: items.length };
  }, [visualMode, visualRaw, q, minPrice, maxPrice, minRating, condition, sort]);

  const effectiveData = visualMode ? visualFiltered ?? { items: [], total: 0 } : data;

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

  const roots = cats.filter((c) => !c.parentId);

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
            <nav className="ae-chip-list" style={{ marginTop: 8 }}>
              <Link to={buildSearchPath("/search", params, { categoryId: null })} className={!categoryId ? "ae-on" : ""}>
                Todas
              </Link>
              {roots.map((c) => (
                <Link
                  key={c.id}
                  to={buildSearchPath("/search", params, { categoryId: c.id })}
                  className={categoryId === c.id ? "ae-on" : ""}
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="ae-filters__group">
            <strong>Preço (Kz)</strong>
            <div className="ae-filters__price-row">
              <input
                className="ae-filters__input"
                type="number"
                inputMode="numeric"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <input
                className="ae-filters__input"
                type="number"
                inputMode="numeric"
                placeholder="Máx"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn-primary ae-filters__apply" onClick={applyPrice}>
              Aplicar
            </button>
          </div>
          <div className="ae-filters__group">
            <strong>Condição</strong>
            <select
              className="ae-filters__select"
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
            <strong>Avaliação mín.</strong>
            <select
              className="ae-filters__select"
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
        </div>
      </aside>

      <div className="ae-layout-search__main">
        <div className="ae-toolbar">
          <div className="ae-sort">
            {sorts.map((s) => (
              <button
                key={s.k}
                type="button"
                className={sort === s.k ? "ae-on" : ""}
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
          <span className="ae-toolbar__count">
            {effectiveData?.total ?? "—"} resultado(s)
            {featured ? <span className="ae-toolbar__pill ae-toolbar__pill--accent">Destaque</span> : null}
            {onSale ? <span className="ae-toolbar__pill ae-toolbar__pill--promo">Promoções</span> : null}
            {shopId ? <span className="ae-toolbar__pill">Uma loja</span> : null}
          </span>
        </div>
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
        {!effectiveData ? (
          <p className="ae-muted">A consultar o catálogo…</p>
        ) : effectiveData.items.length === 0 ? (
          <div className="page-panel ae-empty-center ae-search-empty">
            Não foram encontradas referências com os critérios seleccionados. Ajuste filtros ou o termo de pesquisa.
          </div>
        ) : (
          <section className="ae-grid">
            {effectiveData.items.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
