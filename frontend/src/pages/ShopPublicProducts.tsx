import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { buildSearchPath } from "../buildSearchPath.js";
import { ProductCard, type ProductCardData } from "../components/ProductCard.js";
import { useSeo } from "../seo/useSeo.js";
import type { ShopFrontOutletContext } from "./ShopPublicOutlet.js";

const PAGE = 24;

const SORTS: { k: string; label: string }[] = [
  { k: "recentes", label: "Novidades" },
  { k: "mais_vendidos", label: "Mais vendidos" },
  { k: "preco_asc", label: "Preço ↑" },
  { k: "preco_desc", label: "Preço ↓" },
  { k: "melhor_avaliados", label: "Melhor avaliados" },
];

export default function ShopPublicProducts() {
  const { shopId } = useParams();
  const ctx = useOutletContext<ShopFrontOutletContext>();
  const nome = ctx.sobre?.loja.name ?? "Loja";

  const [sort, setSort] = useState("recentes");
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useSeo({
    title: `${nome} — Produtos — BAZAR DO BIÉ`,
    description: `Catálogo filtrado da loja ${nome} no BAZAR DO BIÉ.`,
    canonicalPath: shopId ? `/loja/${shopId}/produtos` : "/loja",
  });

  const load = useCallback(
    async (nextSkip: number, replace: boolean) => {
      if (!shopId) return;
      setLoading(true);
      setErr(null);
      const qs = new URLSearchParams({
        shopId,
        sort,
        take: String(PAGE),
        skip: String(nextSkip),
      });
      try {
        const r = await apiFetch<{ items: ProductCardData[]; total: number }>(`/products?${qs.toString()}`);
        setTotal(r.total ?? 0);
        setSkip(nextSkip);
        if (replace) setItems(r.items ?? []);
        else setItems((prev) => [...prev, ...(r.items ?? [])]);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Não foi possível carregar o catálogo.");
        if (replace) setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [shopId, sort],
  );

  useEffect(() => {
    if (!shopId) return;
    void load(0, true);
  }, [shopId, sort, load]);

  const catalogWide = shopId ? buildSearchPath("/search", new URLSearchParams(), { shopId }) : "/search";
  const hasMore = items.length < total;

  return (
    <div className="ae-storefront-body">
      <section className="page-panel ae-storefront-panel">
        <header className="ae-storefront-strip-head">
          <div>
            <h2 className="ae-storefront-h2">Todos os produtos</h2>
            <p className="ae-muted ae-storefront-strip-dek">
              Ordenação dedicada à loja. Para filtros avançados por categoria, preço ou condição, abra o catálogo completo.
            </p>
          </div>
          <Link className="ae-linkbtn ae-storefront-strip-more" to={catalogWide}>
            Abrir na pesquisa global
          </Link>
        </header>

        <div className="ae-storefront-toolbar">
          <label className="ae-storefront-field">
            <span className="ae-muted">Ordenar por</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="ae-storefront-select">
              {SORTS.map((s) => (
                <option key={s.k} value={s.k}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {!loading ? (
            <p className="ae-muted ae-storefront-toolbar-meta">
              Mostrando <strong>{items.length}</strong>
              {total > 0 ? (
                <>
                  {" "}
                  de <strong>{total.toLocaleString("pt-PT")}</strong> artigos públicos nesta loja
                </>
              ) : (
                <> resultados</>
              )}
              .
            </p>
          ) : (
            <p className="ae-muted ae-storefront-toolbar-meta">A sincronizar com o catálogo…</p>
          )}
        </div>

        {err ? (
          <p style={{ color: "#b00020" }}>{err}</p>
        ) : items.length === 0 && !loading ? (
          <p className="ae-muted">Sem artigos listados nesta vista.</p>
        ) : (
          <div className="ae-grid">
            {items.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}

        {hasMore ? (
          <div className="ae-storefront-more-row">
            <button type="button" className="btn" disabled={loading} onClick={() => void load(skip + PAGE, false)}>
              {loading ? "A carregar…" : "Carregar mais artigos"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
