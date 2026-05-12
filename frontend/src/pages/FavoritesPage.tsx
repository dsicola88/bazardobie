import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { ProductCard, type ProductCardData } from "../components/ProductCard.js";
import { buildSearchPath } from "../buildSearchPath.js";
import { variantDisplayBuyerLine } from "../utils/variantDisplay.js";
import { CATALOG_TERMS } from "../catalog/catalogTerminology.js";

type FavoriteRow = {
  id: string;
  productId: string;
  variantId: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    condition?: string | null;
    price: string;
    promoPrice?: string | null;
    displayPrice: string;
    soldCount: number;
    averageRating?: string | null;
    reviewCount: number;
    images: { url: string }[];
    shop: { id: string; name: string; city: string; province: string } | null;
  };
  variant: {
    id: string;
    name?: string | null;
    sku?: string;
    color?: string | null;
    size?: string | null;
    properties?: { label: string; value: string }[];
    variantStructuredValues?: { value: string; attribute: { label: string; sortOrder?: number } }[];
  } | null;
};

function toCardData(row: FavoriteRow): ProductCardData {
  const p = row.product;
  return {
    id: p.id,
    name: p.name,
    condition: p.condition,
    price: p.price,
    promoPrice: p.promoPrice,
    displayPrice: p.displayPrice,
    soldCount: p.soldCount,
    averageRating: p.averageRating,
    reviewCount: p.reviewCount,
    images: p.images,
  };
}

export default function FavoritesPage() {
  const { token, user } = useAuth();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<FavoriteRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  /** Evita que uma resposta antiga sobrescreva uma lista já actualizada (ex.: GET inicial vs. evento). */
  const fetchSeq = useRef(0);

  useEffect(() => {
    if (!token || user?.role !== "CLIENTE") return;
    let cancelled = false;
    const seq = ++fetchSeq.current;
    setRows(null);
    void (async () => {
      try {
        const list = await apiFetch<FavoriteRow[]>("/favorites", { token });
        if (cancelled || seq !== fetchSeq.current) return;
        setRows(list);
        setErr(null);
      } catch (e: unknown) {
        if (cancelled || seq !== fetchSeq.current) return;
        setErr(e instanceof Error ? e.message : "Não foi possível carregar a lista de interesse");
        setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.role]);

  const reloadSoft = useCallback(async () => {
    if (!token || user?.role !== "CLIENTE") return;
    const seq = ++fetchSeq.current;
    try {
      const list = await apiFetch<FavoriteRow[]>("/favorites", { token });
      if (seq !== fetchSeq.current) return;
      setRows(list);
      setErr(null);
    } catch (e: unknown) {
      if (seq !== fetchSeq.current) return;
      setErr(e instanceof Error ? e.message : "Não foi possível actualizar a lista");
    }
  }, [token, user?.role]);

  useEffect(() => {
    const fn = () => void reloadSoft();
    window.addEventListener("favorites-updated", fn);
    return () => window.removeEventListener("favorites-updated", fn);
  }, [reloadSoft]);

  async function remove(row: FavoriteRow) {
    if (!token) return;
    setRemovingId(row.id);
    try {
      const qs = new URLSearchParams({ productId: row.productId });
      if (row.variantId) qs.set("variantId", row.variantId);
      await apiFetch(`/favorites?${qs}`, { method: "DELETE", token });
      window.dispatchEvent(new Event("favorites-updated"));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível remover");
    } finally {
      setRemovingId(null);
    }
  }

  if (!token) {
    const next = params.get("next");
    const safe =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/favorites";
    return <Navigate to={`/login?next=${encodeURIComponent(safe)}`} replace />;
  }

  if (user?.role !== "CLIENTE") {
    return (
      <div className="page-panel ae-fav-gate">
        <h1 className="ae-fav-gate__title">Lista de interesse</h1>
        <p className="ae-muted">Esta área destina-se a compradores. Inicie sessão com uma conta de comprador para guardar artigos.</p>
        <Link to="/" className="btn btn-primary">
          Voltar ao início
        </Link>
      </div>
    );
  }

  if (rows === null) {
    return (
      <div className="ae-fav-shell">
        <p className="ae-muted">A carregar a sua lista de interesse…</p>
      </div>
    );
  }

  return (
    <div className="ae-fav-shell">
      <nav className="ae-breadcrumb ae-fav-breadcrumb">
        <Link to="/">Início</Link>
        <span>/</span>
        <span>Lista de interesse</span>
      </nav>

      <header className="ae-fav-head">
        <div>
          <h1 className="ae-fav-head__title">A minha lista de interesse</h1>
          <p className="ae-fav-head__sub">
            Artigos guardados na sua conta. Os preços e a disponibilidade são sempre os indicados pela loja parceira no
            momento da compra.
          </p>
        </div>
        <Link to="/search" className="btn btn-primary">
          Continuar a comprar
        </Link>
      </header>

      {err ? (
        <p className="ae-admin-alert ae-admin-alert--err" role="alert">
          {err}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <section className="page-panel ae-fav-empty" aria-labelledby="fav-empty-title">
          <div className="ae-fav-empty__icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="48" height="48">
              <path
                fill="currentColor"
                opacity="0.2"
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              />
            </svg>
          </div>
          <h2 id="fav-empty-title">Ainda não guardou artigos</h2>
          <p className="ae-muted">{CATALOG_TERMS.favoritesHowToSave}</p>
          <Link to="/search" className="btn btn-primary">
            Explorar catálogo
          </Link>
        </section>
      ) : (
        <>
          <p className="ae-fav-count">
            {rows.length} artigo{rows.length === 1 ? "" : "s"} guardado{rows.length === 1 ? "" : "s"}
          </p>
          <section className="ae-grid ae-fav-grid">
            {rows.map((row) => {
              const card = toCardData(row);
              const shop = row.product.shop;
              const vLine = row.variant ? variantDisplayBuyerLine(row.variant, row.product.name) : null;
              const vShow = vLine && vLine !== "Variante" ? vLine : null;
              const saved = new Date(row.createdAt).toLocaleDateString("pt-AO", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              return (
                <article key={row.id} className="ae-fav-card">
                  <div className="ae-fav-card__meta">
                    <span className="ae-fav-card__saved">Guardado em {saved}</span>
                    <button
                      type="button"
                      className="ae-fav-card__rm"
                      disabled={removingId === row.id}
                      onClick={() => void remove(row)}
                      aria-label={`Remover ${row.product.name} da lista de interesse`}
                    >
                      {removingId === row.id ? "A remover…" : "Remover"}
                    </button>
                  </div>
                  <ProductCard p={card} className="ae-fav-card__pcard" />
                  <div className="ae-fav-card__foot">
                    {vShow ? (
                      <span className="ae-fav-card__var">
                        Variação: <strong>{vShow}</strong>
                      </span>
                    ) : (
                      <span className="ae-fav-card__var ae-muted">Sem variação específica</span>
                    )}
                    {shop ? (
                      <Link
                        className="ae-fav-card__shop"
                        to={buildSearchPath("/search", new URLSearchParams(), { shopId: shop.id })}
                      >
                        Parceiro: {shop.name}
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
