import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, cartSessionHeaders } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { formatKz, formatFreteKz } from "../utils/format.js";
import { resolveMediaUrl } from "../utils/media.js";

type CartItem = {
  id: string;
  quantity: number;
  product: { id: string; name: string; images?: { url: string }[] };
  variant?: { name?: string | null } | null;
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
                          <img src={resolveMediaUrl(item.product.images?.[0]?.url)} alt="" />
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
                    <td>{item.quantity}</td>
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
