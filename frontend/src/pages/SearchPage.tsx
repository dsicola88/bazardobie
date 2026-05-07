import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { ProductCard, type ProductCardData } from "../components/ProductCard.js";
import { buildSearchPath } from "../buildSearchPath.js";
import { useSeo } from "../seo/useSeo.js";

type Category = { id: string; name: string; slug: string; parentId: string | null };

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
  const q = params.get("q") ?? "";
  const categoryId = params.get("categoryId") ?? "";
  const sort = params.get("sort") ?? "recentes";
  const minRating = params.get("minRating") ?? "";
  const minPriceParam = params.get("minPrice");
  const maxPriceParam = params.get("maxPrice");
  const [minPrice, setMinPrice] = useState(() => params.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(() => params.get("maxPrice") ?? "");
  const [cats, setCats] = useState<Category[]>([]);
  const [data, setData] = useState<{ items: ProductCardData[]; total: number } | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);

  const seoTitle = q.trim()
    ? `Pesquisar "${q.trim()}" — BAZAR DO BIÉ`
    : "Pesquisar produtos — BAZAR DO BIÉ";
  const seoDescription = q.trim()
    ? `Resultados para "${q.trim()}" no marketplace BAZAR DO BIÉ. Compare preços, avaliações e prazos de envio em Angola.`
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

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (categoryId) p.set("categoryId", categoryId);
    if (sort) p.set("sort", sort);
    const mn = Number(minRating);
    if (mn >= 1 && mn <= 5) p.set("minRating", String(mn));
    if (minPrice) p.set("minPrice", minPrice);
    if (maxPrice) p.set("maxPrice", maxPrice);
    p.set("take", "36");
    return p.toString();
  }, [q, categoryId, sort, minRating, minPrice, maxPrice]);

  useEffect(() => {
    if (visualMode) {
      try {
        const raw = sessionStorage.getItem("ae_visual_search_v1");
        if (!raw) {
          setData({ items: [], total: 0 });
          return;
        }
        const parsed = JSON.parse(raw) as { items?: ProductCardData[]; total?: number };
        setData({
          items: Array.isArray(parsed.items) ? parsed.items : [],
          total: Number(parsed.total || (Array.isArray(parsed.items) ? parsed.items.length : 0)),
        });
      } catch {
        setData({ items: [], total: 0 });
      }
      return;
    }
    void apiFetch<{ items: ProductCardData[]; total: number }>(`/products?${qs}`)
      .then(setData)
      .catch(() => setData({ items: [], total: 0 }));
  }, [qs, visualMode]);

  function applyPrice() {
    const n = new URLSearchParams(params);
    n.delete("visual");
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
          <strong>Avaliação mín.</strong>
          <select
            className="ae-filters__select"
            value={minRating}
            onChange={(e) => {
              const v = e.target.value;
              const n = new URLSearchParams(params);
              n.delete("visual");
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
                  n.delete("visual");
                  n.set("sort", s.k);
                  setParams(n);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="ae-toolbar__count">{data?.total ?? "—"} resultado(s)</span>
        </div>
        {visualMode ? (
          <p className="ae-catalog-note">Pesquisa por imagem activa. Para nova imagem, use o ícone de câmara na barra de pesquisa.</p>
        ) : null}
        <p className="ae-catalog-note">
          Apresentamos apenas artigos homologados e lojas com registo comercial válido na plataforma. Referências pendentes
          de validação não são exibidas.
        </p>
        {!data ? (
          <p className="ae-muted">A consultar o catálogo…</p>
        ) : data.items.length === 0 ? (
          <div className="page-panel ae-empty-center ae-search-empty">
            Não foram encontradas referências com os critérios seleccionados. Ajuste filtros ou o termo de pesquisa.
          </div>
        ) : (
          <section className="ae-grid">
            {data.items.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
