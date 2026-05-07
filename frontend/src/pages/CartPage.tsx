import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, cartSessionHeaders } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { formatKz, formatFreteKz } from "../utils/format.js";
import { resolveMediaUrl } from "../utils/media.js";
import { CartThumbWithZoom } from "../components/CartThumbWithZoom.js";
import { productConditionLabel } from "../utils/productCondition.js";

type CartItem = {
  id: string;
  quantity: number;
  product: { id: string; name: string; condition?: string | null; stock: number; images?: { url: string }[] };
  variant?: {
    id: string;
    name?: string | null;
    sku?: string | null;
    color?: string | null;
    size?: string | null;
    stock: number;
    imageUrl?: string | null;
  } | null;
  productDeliveryOption: {
    tipoEntrega: string;
    custoEntrega: string;
    prazoEstimado: number;
    logisticsPartner?: { id: string; name: string } | null;
  };
};

function cartVariantLine(variant: NonNullable<CartItem["variant"]>): string {
  const parts = [variant.color, variant.size, variant.name].map((x) => (x ?? "").trim()).filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return (variant.sku ?? "").trim() || "Variante seleccionada";
}

export default function CartPage() {
  const { token, user } = useAuth();
  const [cart, setCart] = useState<{ items: CartItem[] } | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [thumbTryIndexByItemId, setThumbTryIndexByItemId] = useState<Record<string, number>>({});
  const [fallbackThumbByProductId, setFallbackThumbByProductId] = useState<
    Record<string, { productUrl?: string; variantThumbById?: Record<string, string> }>
  >({});
  /** Clique nas miniaturas laterais — qual URL mostrar ao centro com zoom (estilo vitrine AE). */
  const [cartHeroRawByLineId, setCartHeroRawByLineId] = useState<Record<string, string>>({});

  async function reload() {
    const c = await apiFetch<{ items: CartItem[] }>("/cart", { headers: cartSessionHeaders(), token });
    setCart(c);
  }

  useEffect(() => {
    void reload().catch(() => setCart(null));
  }, [token]);

  async function remove(id: string) {
    await apiFetch(`/cart/items/${id}`, { method: "DELETE", headers: cartSessionHeaders(), token });
    window.dispatchEvent(new Event("cart-updated"));
    await reload();
  }

  async function changeQty(item: CartItem, nextQty: number) {
    const maxStock = item.variant ? item.variant.stock : item.product.stock;
    const clamped = Math.max(1, Math.min(maxStock, nextQty));
    if (clamped === item.quantity) return;
    setBusyItemId(item.id);
    try {
      await apiFetch(`/cart/items/${item.id}`, {
        method: "PATCH",
        headers: cartSessionHeaders(),
        token,
        body: JSON.stringify({ quantity: clamped }),
      });
      window.dispatchEvent(new Event("cart-updated"));
      await reload();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Não foi possível actualizar a quantidade.");
    } finally {
      setBusyItemId(null);
    }
  }

  function uniqThumbRaws(parts: (string | undefined | null)[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (let x of parts) {
      x = String(x ?? "").trim();
      if (!x || seen.has(x)) continue;
      seen.add(x);
      out.push(x);
    }
    return out;
  }

  function baselineThumbRaws(item: CartItem): string[] {
    const extra = fallbackThumbByProductId[item.product.id];
    const byId = item.variant?.id ? extra?.variantThumbById?.[item.variant.id] : undefined;
    const galleryUrls = (item.product.images ?? []).map((im) => im.url.trim()).filter(Boolean);
    return uniqThumbRaws([item.variant?.imageUrl, byId, ...galleryUrls, extra?.productUrl]);
  }

  function heroRawForCartLine(item: CartItem): string | undefined {
    const base = baselineThumbRaws(item);
    const pick = cartHeroRawByLineId[item.id];
    if (pick && base.includes(pick)) return pick;
    return base[0];
  }

  function resolvedThumbCandidates(item: CartItem): string[] {
    const hero = heroRawForCartLine(item);
    const base = baselineThumbRaws(item);
    const orderedRaw = uniqThumbRaws(hero ? [hero, ...base] : base);
    return orderedRaw.map((u) => resolveMediaUrl(u)).filter(Boolean);
  }

  function cartThumbCandidates(item: CartItem): string[] {
    return resolvedThumbCandidates(item);
  }

  function cartThumbUrl(item: CartItem): string {
    const options = cartThumbCandidates(item);
    if (options.length === 0) return "";
    const idx = Math.max(0, Math.min(thumbTryIndexByItemId[item.id] ?? 0, options.length - 1));
    return options[idx] ?? "";
  }

  useEffect(() => {
    if (!cart?.items.length) return;
    const missingProductIds = Array.from(
      new Set(
        cart.items
          .filter((item) => baselineThumbRaws(item).length === 0 && !fallbackThumbByProductId[item.product.id])
          .map((item) => item.product.id)
      )
    ).filter((pid) => !fallbackThumbByProductId[pid]);
    if (missingProductIds.length === 0) return;
    void Promise.allSettled(
      missingProductIds.map((pid) =>
        apiFetch<{ images?: { url: string }[]; variants?: { id: string; imageUrl?: string | null }[] }>(
          `/products/${pid}`
        )
          .then((p) => {
            const variantThumbById: Record<string, string> = {};
            for (const v of p.variants ?? []) {
              const raw = v.imageUrl?.trim();
              if (raw) variantThumbById[v.id] = raw;
            }
            const fromProductRaw = (p.images ?? []).map((img) => img.url.trim()).filter(Boolean)[0] ?? "";
            return { pid, productUrl: fromProductRaw || "", variantThumbById };
          })
          .catch(() => ({ pid, productUrl: "", variantThumbById: {} as Record<string, string> }))
      )
    ).then((rows) => {
      const next: Record<string, { productUrl?: string; variantThumbById?: Record<string, string> }> = {};
      for (const r of rows) {
        if (r.status === "fulfilled" && (r.value.productUrl || Object.keys(r.value.variantThumbById).length > 0)) {
          next[r.value.pid] = {
            productUrl: r.value.productUrl || "",
            variantThumbById: r.value.variantThumbById,
          };
        }
      }
      if (Object.keys(next).length) {
        setFallbackThumbByProductId((prev) => ({ ...prev, ...next }));
      }
    });
  }, [cart, fallbackThumbByProductId]);

  if (!cart) return <p className="ae-muted">A carregar o seu carrinho…</p>;

  return (
    <div>
      <h1 className="ae-checkout__title" style={{ marginBottom: 8 }}>
        Carrinho
      </h1>
      {token && user?.role === "CLIENTE" ? (
        <p className="ae-muted" style={{ fontSize: 13, marginBottom: 12 }}>
          <Link to="/orders">As minhas encomendas</Link>
          {" · "}
          <Link to="/favorites">Favoritos</Link>
        </p>
      ) : null}
      {cart.items.length === 0 ? (
        <div className="page-panel ae-empty-center">
          O carrinho não contém artigos.
          <br />
          <Link to="/search">Ir ao catálogo</Link>
        </div>
      ) : (
        <>
          <div className="ae-table-cart-wrap">
            <table className="ae-table-cart">
              <thead>
                <tr>
                  <th>Artigo</th>
                  <th>Expedição</th>
                  <th>Qtd.</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="ae-table-cart__product ae-table-cart__product--gallery">
                        <div className="ae-table-cart__thumb-col" aria-label="Miniaturas do produto">
                          {baselineThumbRaws(item)
                            .slice(0, 6)
                            .map((raw) => {
                              const active = heroRawForCartLine(item) === raw;
                              return (
                                <button
                                  key={raw}
                                  type="button"
                                  title="Amplia ao centro · clique"
                                  className={`ae-table-cart__side-thumb ${active ? "ae-on" : ""}`}
                                  onClick={() =>
                                    setCartHeroRawByLineId((prev) =>
                                      prev[item.id] === raw ? prev : { ...prev, [item.id]: raw }
                                    )
                                  }
                                >
                                  <img src={resolveMediaUrl(raw)} alt="" loading="lazy" decoding="async" />
                                </button>
                              );
                            })}
                        </div>
                        <div className="ae-table-cart__hero-wrap">
                          {cartThumbUrl(item) ? (
                            <CartThumbWithZoom
                              thumbUrl={cartThumbUrl(item)!}
                              to={item.variant?.id ? `/product/${item.product.id}?variant=${item.variant.id}` : `/product/${item.product.id}`}
                              onImgError={() =>
                                setThumbTryIndexByItemId((prev) => {
                                  const options = cartThumbCandidates(item);
                                  const current = prev[item.id] ?? 0;
                                  const nextIdx = options.length <= 1 ? current : Math.min(current + 1, options.length - 1);
                                  if (nextIdx === current) return prev;
                                  return { ...prev, [item.id]: nextIdx };
                                })
                              }
                            />
                          ) : (
                            <Link to={item.variant?.id ? `/product/${item.product.id}?variant=${item.variant.id}` : `/product/${item.product.id}`}>
                              <div className="ae-table-cart__product-ph" aria-hidden />
                            </Link>
                          )}
                        </div>
                        <div className="ae-table-cart__meta">
                          <Link to={item.variant?.id ? `/product/${item.product.id}?variant=${item.variant.id}` : `/product/${item.product.id}`} style={{ fontWeight: 600 }}>
                            {item.product.name}
                          </Link>
                          <div className="ae-muted" style={{ fontSize: 12 }}>
                            {productConditionLabel(item.product.condition)}
                          </div>
                          {item.variant ? (
                            <div className="ae-table-cart__variant">
                              <span className="ae-table-cart__variant-label">{cartVariantLine(item.variant)}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>
                        {item.productDeliveryOption.tipoEntrega === "PLATAFORMA"
                          ? item.productDeliveryOption.logisticsPartner
                            ? `Plataforma · ${item.productDeliveryOption.logisticsPartner.name}`
                            : "Plataforma (BAZAR DO BIÉ)"
                          : "Loja parceira"}{" "}
                        · {formatFreteKz(item.productDeliveryOption.custoEntrega)}
                      </div>
                      <div className="ae-muted" style={{ fontSize: 12 }}>
                        {item.productDeliveryOption.prazoEstimado} dias úteis
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          className="ae-mini-btn"
                          disabled={busyItemId === item.id || item.quantity <= 1}
                          onClick={() => void changeQty(item, item.quantity - 1)}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={item.variant ? item.variant.stock : item.product.stock}
                          value={item.quantity}
                          disabled={busyItemId === item.id}
                          onChange={(e) => void changeQty(item, Number(e.target.value) || 1)}
                          style={{ width: 68, textAlign: "center" }}
                        />
                        <button
                          type="button"
                          className="ae-mini-btn"
                          disabled={
                            busyItemId === item.id ||
                            item.quantity >= (item.variant ? item.variant.stock : item.product.stock)
                          }
                          onClick={() => void changeQty(item, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <div className="ae-muted" style={{ fontSize: 12, marginTop: 4 }}>
                        Stock: {item.variant ? item.variant.stock : item.product.stock}
                      </div>
                    </td>
                    <td>
                      <button type="button" className="ae-link-remove" onClick={() => void remove(item.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!token ? (
            <p style={{ marginTop: 16 }}>
              <Link className="btn btn-primary" to="/login">
                Iniciar sessão para fechar a compra
              </Link>
            </p>
          ) : (
            <Link className="btn btn-primary" to="/checkout" style={{ marginTop: 16, display: "inline-block" }}>
              Fechar compra ({cart.items.reduce((s, i) => s + i.quantity, 0)} linhas)
            </Link>
          )}
        </>
      )}
    </div>
  );
}
