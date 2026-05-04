import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { formatKz } from "../utils/format.js";

type ProductRow = {
  id: string;
  name: string;
  soldCount: number;
  stock: number;
  isActive: boolean;
};
type OrderMini = {
  id: string;
  status: string;
  grandTotal: string;
  createdAt: string;
};

export default function VendorDashboard() {
  const { token } = useAuth();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<OrderMini[]>([]);
  const [shopStatus, setShopStatus] = useState<"load" | "missing" | "pending" | "ok" | "err">("load");

  useEffect(() => {
    if (!token) return;
    void apiFetch<{ isApproved: boolean }>("/vendor/shop/me", { token })
      .then((s) => setShopStatus(s.isApproved ? "ok" : "pending"))
      .catch((e: unknown) => {
        const st =
          e && typeof e === "object" && "status" in e ? Number((e as { status: number }).status) : 0;
        if (st === 404) setShopStatus("missing");
        else setShopStatus("err");
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void apiFetch<ProductRow[]>("/vendor/products/mine", { token })
      .then(setProducts)
      .catch(() => {
        setProducts([]);
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void apiFetch<OrderMini[]>("/vendor/orders", { token })
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [token]);

  const active = products.filter((p) => p.isActive).length;
  const inactive = products.length - active;
  const pend = orders.filter((o) => o.status === "PENDENTE" || o.status === "CONFIRMADO").length;

  return (
    <>
      {shopStatus === "err" ? (
        <div className="ae-admin-alert ae-admin-alert--err" role="alert" style={{ marginBottom: 20 }}>
          Não foi possível confirmar o estado da loja (rede ou sessão). Actualize a página ou volte a iniciar sessão.
        </div>
      ) : null}
      {shopStatus === "missing" ? (
        <div className="ae-admin-next" style={{ marginBottom: 20 }}>
          <div>
            <h2>Complete a sua loja</h2>
            <p>
              Ainda não tem dados de loja registados. Preencha o nível 1 para a nossa equipa poder analisar e
              aprovar — só depois pode criar produtos e a loja pode tornar-se visível ao público.
            </p>
          </div>
          <Link to="/vendor/loja" className="btn btn-primary">
            Abrir dados da loja
          </Link>
        </div>
      ) : null}
      {shopStatus === "pending" ? (
        <div
          className="ae-admin-next"
          style={{
            marginBottom: 20,
            borderColor: "#e8d48b",
            background: "linear-gradient(135deg, #fffbeb 0%, #fff 100%)",
          }}
        >
          <div>
            <h2>Loja em análise</h2>
            <p>
              Os dados da sua loja foram recebidos e estão <strong>pendentes de aprovação</strong>. Até a equipa
              aprovar, a loja <strong>não aparece</strong> na vitrine pública e <strong>não pode criar produtos</strong>.
            </p>
          </div>
          <Link to="/vendor/loja" className="btn btn-primary">
            Ver estado da loja
          </Link>
        </div>
      ) : null}

      <header className="ae-v-head">
        <div>
          <h1 className="ae-v-title">Resumo comercial</h1>
          <p className="ae-muted" style={{ margin: "4px 0 0", maxWidth: "36rem" }}>
            Indicadores sintéticos do catálogo e da fila operacional. Para gestão pormenorizada utilize as secções
            dedicadas no menu lateral.
          </p>
        </div>
        <Link to="/vendor/products" className="btn btn-primary">
          Abrir catálogo
        </Link>
      </header>

      <div className="ae-v-metrics">
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{products.length}</div>
          <div className="ae-v-metric__l">Referências no catálogo</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{active}</div>
          <div className="ae-v-metric__l">Activas na vitrine ({inactive} inactivas)</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{pend}</div>
          <div className="ae-v-metric__l">Encomendas na fila de tratamento</div>
        </div>
      </div>

      <section className="ae-table-wrap" style={{ marginBottom: 20 }}>
        <table className="ae-data-table">
          <thead>
            <tr>
              <th>Encomenda</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 6).map((o) => (
              <tr key={o.id}>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{o.id.slice(0, 12)}…</td>
                <td>
                  <span className="ae-badge ae-badge--live">{o.status}</span>
                </td>
                <td>{formatKz(o.grandTotal)}</td>
                <td className="ae-muted">{new Date(o.createdAt).toLocaleString("pt-AO")}</td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={4} className="ae-empty-center">
                  Sem encomendas registadas
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <Link to="/vendor/orders" className="ae-muted">
        Ver todas as encomendas →
      </Link>
    </>
  );
}
