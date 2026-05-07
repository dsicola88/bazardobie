import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, cartSessionHeaders } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { formatKz, formatFreteKz } from "../utils/format.js";
import { resolveMediaUrl } from "../utils/media.js";

type CartItem = {
  id: string;
  quantity: number;
  product: { id: string; name: string; stock: number; images?: { url: string }[] };
  variant?: { id: string; name?: string | null; stock: number } | null;
  productDeliveryOption: {
    tipoEntrega: string;
    custoEntrega: string;
    prazoEstimado: number;
    logisticsPartner?: { id: string; name: string } | null;
  };
};

export default function CartPage() {
  const { token, user } = useAuth();
  const [cart, setCart] = useState<{ items: CartItem[] } | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [thumbLoadFailedIds, setThumbLoadFailedIds] = useState<Set<string>>(new Set());

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
                      <div className="ae-table-cart__product">
                        <Link to={`/product/${item.product.id}`}>
                          {resolveMediaUrl(item.product.images?.[0]?.url) && !thumbLoadFailedIds.has(item.id) ? (
                            <img
                              src={resolveMediaUrl(item.product.images?.[0]?.url)}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              onError={() =>
                                setThumbLoadFailedIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(item.id);
                                  return next;
                                })
                              }
                            />
                          ) : (
                            <div className="ae-table-cart__product-ph" aria-hidden />
                          )}
                        </Link>
                        <div>
                          <Link to={`/product/${item.product.id}`} style={{ fontWeight: 600 }}>
                            {item.product.name}
                          </Link>
                          {item.variant?.name ? <div className="ae-muted">{item.variant.name}</div> : null}
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
