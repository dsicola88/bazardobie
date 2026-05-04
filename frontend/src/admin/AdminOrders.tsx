import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { etiquetaEstadoPedidoCliente } from "../utils/buyerOrderFilters.js";
import { etiquetaGateway, etiquetaPagamento } from "../utils/paymentLabels.js";

type OrderRow = {
  id: string;
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

  useEffect(() => {
    if (!token) return;
    void apiFetch<OrderList>("/admin/orders?take=80", { token })
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [token]);

  if (err) return <p style={{ color: "crimson" }}>{err}</p>;

  return (
    <div>
      <div className="ae-v-head">
        <h1 className="ae-v-title">Todas as encomendas</h1>
      </div>
      <p className="ae-muted">Cancelamento e alteração de estado seguem as mesmas regras de negócio do painel comercial (a administração pode forçar transições em situações de suporte).</p>
      <table className="ae-data-table">
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
              <td><code>{o.id.slice(0, 12)}…</code></td>
              <td>{o.user.name}</td>
              <td>
                <div>{etiquetaEstadoPedidoCliente(o.status)}</div>
                <div className="ae-muted" style={{ fontSize: 11 }}>
                  <code>{o.status}</code>
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
      <p className="ae-muted">Total na base: {data?.total ?? 0}</p>
    </div>
  );
}
