import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { etiquetaEstadoPedidoCliente } from "../utils/buyerOrderFilters.js";
import { etiquetaGateway, etiquetaPagamento } from "../utils/paymentLabels.js";

type OrderRow = {
  id: string;
  orderCode?: string | null;
  status: string;
  grandTotal: string;
  createdAt: string;
  paymentMethod: string;
  gatewayPayStatus?: string;
  user: { id: string; name: string; email: string };
  logisticsPartner?: { id: string; name: string } | null;
};

type OrderList = { items: OrderRow[]; total: number; skip: number; take: number };

export default function AdminOrders() {
  const { token } = useAuth();
  const [data, setData] = useState<OrderList | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const PAGE = 80;

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams({
      take: String(PAGE),
      skip: String(page * PAGE),
    });
    if (q.trim()) params.set("q", q.trim());
    void apiFetch<OrderList>(`/admin/orders?${params.toString()}`, { token })
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [token, page, q]);

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Todas as encomendas</h1>
          <p className="ae-admin-pro__sub">
            Monitorização transversal de compras, pagamentos e operação logística. A administração pode intervir em
            transições de estado em contexto de suporte.
          </p>
        </div>
        <input
          type="search"
          className="ae-admin-filter-input"
          placeholder="Pesquisar por orderCode, id, comprador..."
          value={q}
          onChange={(e) => {
            setPage(0);
            setQ(e.target.value);
          }}
        />
      </header>
      {err ? (
        <div className="ae-admin-alert ae-admin-alert--err" role="alert">
          {err}
        </div>
      ) : null}
      <div className="ae-admin-table-wrap">
        <table className="ae-admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Comprador</th>
            <th>Estado</th>
            <th>Pagamento</th>
            <th>Última milha</th>
            <th>Total</th>
            <th>Data</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((o) => (
            <tr key={o.id}>
              <td><code className="ae-admin-mono">{o.orderCode || `${o.id.slice(0, 12)}…`}</code></td>
              <td>{o.user.name}</td>
              <td>
                <div>{etiquetaEstadoPedidoCliente(o.status)}</div>
                <div className="ae-muted" style={{ fontSize: 11 }}>
                  <code className="ae-admin-mono">{o.status}</code>
                </div>
              </td>
              <td style={{ fontSize: 13 }}>
                <div>{etiquetaPagamento(o.paymentMethod)}</div>
                {o.paymentMethod === "PAGAMENTO_ONLINE" && o.gatewayPayStatus ? (
                  <div className="ae-muted" style={{ fontSize: 11 }}>
                    {etiquetaGateway(o.gatewayPayStatus)}
                  </div>
                ) : null}
              </td>
              <td className="ae-muted" style={{ fontSize: 12 }}>
                {o.logisticsPartner?.name ?? "—"}
              </td>
              <td>{Number(o.grandTotal).toLocaleString("pt-AO")} Kz</td>
              <td>{new Date(o.createdAt).toLocaleString("pt-AO")}</td>
              <td>
                <Link to={`/admin/orders/${o.id}`}>Detalhe</Link>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
      <div className="ae-admin-pager">
        <p className="ae-muted" style={{ margin: 0 }}>
          Total na base: <strong>{data?.total ?? 0}</strong>
          {data?.total ? (
            <>
              {" "}
              · Página <strong>{page + 1}</strong> / {Math.max(1, Math.ceil((data?.total ?? 0) / PAGE))} ({PAGE} por página)
            </>
          ) : null}
        </p>
        <button type="button" className="btn" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          ← Anterior
        </button>
        <button
          type="button"
          className="btn"
          disabled={!data?.total || (page + 1) * PAGE >= data.total}
          onClick={() => setPage((p) => p + 1)}
        >
          Seguinte →
        </button>
      </div>
    </div>
  );
}
