import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { buildSearchPath } from "../buildSearchPath.js";
import { ProductCard, type ProductCardData } from "../components/ProductCard.js";
import { useSeo } from "../seo/useSeo.js";
import type { ShopFrontOutletContext } from "./ShopPublicOutlet.js";

export default function ShopPublicHome() {
  const { shopId } = useParams();
  const ctx = useOutletContext<ShopFrontOutletContext>();
  const nome = ctx.sobre?.loja.name ?? "Loja";

  const [tops, setTops] = useState<ProductCardData[] | null>(null);
  const [nouv, setNouv] = useState<ProductCardData[] | null>(null);

  useSeo({
    title: `${nome} — Início da loja — BAZAR DO BIÉ`,
    description: ctx.sobre ? `Destaques e novidades da loja ${nome} no BAZAR DO BIÉ.` : "Loja no BAZAR DO BIÉ.",
    canonicalPath: shopId ? `/loja/${shopId}` : "/loja",
  });

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    void Promise.all([
      apiFetch<{ items: ProductCardData[] }>(`/products?shopId=${encodeURIComponent(shopId)}&sort=mais_vendidos&take=10`),
      apiFetch<{ items: ProductCardData[] }>(`/products?shopId=${encodeURIComponent(shopId)}&sort=recentes&take=10`),
    ])
      .then(([a, b]) => {
        if (!cancelled) {
          setTops(a.items ?? []);
          setNouv(b.items ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTops([]);
          setNouv([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const catalogHref = shopId ? buildSearchPath("/search", new URLSearchParams(), { shopId }) : "/search";
  const lojaHref = shopId ? `/loja/${encodeURIComponent(shopId)}` : "/search";

  return (
    <div className="ae-storefront-body">
      {ctx.sobre?.metricas.reputacaoHintPt ? (
        <section className="page-panel ae-storefront-panel">
          <p className="ae-muted" style={{ margin: 0, maxWidth: 860, fontSize: 14, lineHeight: 1.55 }}>
            {ctx.sobre.metricas.reputacaoHintPt}
          </p>
        </section>
      ) : null}

      <section className="page-panel ae-storefront-panel" aria-labelledby="sf-hot-heading">
        <header className="ae-storefront-strip-head">
          <div>
            <h2 id="sf-hot-heading" className="ae-storefront-h2">
              Destaques
            </h2>
            <p className="ae-muted ae-storefront-strip-dek">Os artigos mais procurados e com maior ritmo de venda registado nesta loja.</p>
          </div>
          <Link className="ae-linkbtn ae-storefront-strip-more" to={catalogHref}>
            Ver todos
          </Link>
        </header>
        {!tops ? (
          <p className="ae-muted">A carregar…</p>
        ) : tops.length === 0 ? (
          <p className="ae-muted">
            Esta loja ainda não tem produtos destacados disponíveis.{" "}
            <Link className="ae-linkbtn" to={catalogHref}>
              Explore o catálogo filtrado
            </Link>
            .
          </p>
        ) : (
          <div className="ae-grid ae-storefront-mini-grid">
            {tops.slice(0, 8).map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>

      <section className="page-panel ae-storefront-panel" aria-labelledby="sf-new-heading">
        <header className="ae-storefront-strip-head">
          <div>
            <h2 id="sf-new-heading" className="ae-storefront-h2">
              Novidades
            </h2>
            <p className="ae-muted ae-storefront-strip-dek">Anúncios recentemente activos nesta margem da loja parceira.</p>
          </div>
          <Link className="ae-linkbtn ae-storefront-strip-more" to={`${lojaHref}/produtos`}>
            Pesquisar e ordenar na loja
          </Link>
        </header>
        {!nouv ? (
          <p className="ae-muted">A carregar…</p>
        ) : nouv.length === 0 ? (
          <p className="ae-muted">Sem novidades listadas neste momento.</p>
        ) : (
          <div className="ae-grid ae-storefront-mini-grid">
            {nouv.slice(0, 8).map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
