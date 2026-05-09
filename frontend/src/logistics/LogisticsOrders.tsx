import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { OrderTrackingEditor } from "../components/OrderTrackingEditor.js";
import { formatKz } from "../utils/format.js";
import { etiquetaEstadoPedidoCliente } from "../utils/buyerOrderFilters.js";
import { etiquetaGateway, etiquetaPagamento } from "../utils/paymentLabels.js";
import { logisticsSelectableStatuses } from "../utils/vendorOrderStatuses.js";

type Row = {
  id: string;
  orderCode?: string | null;
  status: string;
  grandTotal: string;
  createdAt: string;
  shippingProvince: string;
  shippingCity: string;
  shippingAddress: string | null;
  shippingName: string;
  shippingPhone: string;
  paymentMethod: string;
  gatewayPayStatus?: string;
  user?: { name: string; phone: string | null };
  items: {
    productNameSnapshot: string;
    quantity: number;
    shop?: { name: string; city: string; province: string } | null;
  }[];
  trackingCarrier?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  logisticsPartner?: { id: string; name: string } | null;
};

export default function LogisticsOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"" | "EM_PREPARACAO" | "EM_ENTREGA" | "ENTREGUE">("");
  const [patchErr, setPatchErr] = useState<string | null>(null);

  async function reload() {
    if (!token) return;
    const q = filter ? `?status=${encodeURIComponent(filter)}` : "";
    const list = await apiFetch<Row[]>(`/logistics/orders${q}`, { token });
    setOrders(list);
  }

  useEffect(() => {
    void reload().catch(() => setOrders([]));
  }, [token, filter]);

  async function setStatus(orderId: string, status: string) {
    if (!token) return;
    setPatchErr(null);
    try {
      await apiFetch(`/orders/${orderId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      await reload();
    } catch (e: unknown) {
      setPatchErr(e instanceof Error ? e.message : "Erro ao actualizar estado.");
    }
  }

  return (
    <>
      <header className="ae-v-head">
        <div>
          <h1 className="ae-v-title">Envio pela plataforma</h1>
          <p className="ae-muted" style={{ margin: "4px 0 0" }}>
            Recolha na loja após «Em preparação», depois «Em entrega» e «Entregue». Contas LOGISTICA sem transportadora
            parceira veem todos os pedidos BAZAR DO BIÉ; com parceiro, só encomendas atribuídas pelo administrador.
          </p>
        </div>
        <div className="ae-sort">
          {(
            [
              ["", "Activos (preparação + trânsito)"],
              ["EM_PREPARACAO", "Só preparados"],
              ["EM_ENTREGA", "Em trânsito"],
              ["ENTREGUE", "Entregues (últimos)"],
            ] as const
          ).map(([k, label]) => (
            <button key={k || "all"} type="button" className={filter === k ? "ae-on" : ""} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {patchErr ? (
        <p className="ae-admin-alert ae-admin-alert--err" role="alert">
          {patchErr}
        </p>
      ) : null}

      {orders.map((o) => {
        const options = logisticsSelectableStatuses(o.status);
        const shops = [...new Set(o.items.map((i) => i.shop?.name).filter(Boolean))].join(", ");
        return (
          <article key={o.id} className="page-panel" style={{ padding: 0, marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 12,
                padding: 14,
                borderBottom: "1px solid var(--ae-line)",
                background: "#f8fafc",
              }}
            >
              <div>
                <strong style={{ fontFamily: "monospace", fontSize: 13 }}>{o.orderCode || `${o.id.slice(0, 14)}…`}</strong>
                <div className="ae-muted" style={{ fontSize: 12 }}>
                  {new Date(o.createdAt).toLocaleString("pt-AO")} · {o.user?.name ?? ""} ·{" "}
                  {etiquetaPagamento(o.paymentMethod)}
                  {o.paymentMethod === "PAGAMENTO_ONLINE" && o.gatewayPayStatus ? (
                    <> · {etiquetaGateway(o.gatewayPayStatus)}</>
                  ) : null}
                </div>
                <div className="ae-muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Para: {o.shippingCity}, {o.shippingProvince} · {o.shippingName} ({o.shippingPhone})
                </div>
                {shops ? (
                  <div style={{ marginTop: 8 }}>
                    <span className="ae-badge ae-badge--pend" style={{ fontSize: 11 }}>
                      Origem: {shops}
                    </span>
                  </div>
                ) : null}
                {o.logisticsPartner?.name ? (
                  <div style={{ marginTop: 8 }}>
                    <span className="ae-badge" style={{ fontSize: 11, background: "#e8f4ff", borderColor: "#b6daff" }}>
                      Parceiro: {o.logisticsPartner.name}
                    </span>
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <strong>{formatKz(o.grandTotal)}</strong>
                <select
                  className="ae-status-select"
                  value={o.status}
                  onChange={(e) => void setStatus(o.id, e.target.value)}
                  aria-label={`Estado ${o.id}`}
                >
                  {options.map((s) => (
                    <option key={s} value={s}>
                      {etiquetaEstadoPedidoCliente(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="ae-muted" style={{ padding: "8px 14px", fontSize: 12, borderBottom: "1px solid var(--ae-line)" }}>
              {o.shippingAddress?.trim() || "—"}
            </div>
            <table className="ae-data-table" style={{ border: "none", borderRadius: 0 }}>
              <tbody>
                {o.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.productNameSnapshot}</td>
                    <td style={{ width: 100 }}>× {it.quantity}</td>
                    <td style={{ width: 160 }} className="ae-muted">
                      {it.shop?.city}, {it.shop?.province}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "14px", borderTop: "1px solid var(--ae-line)" }}>
              <OrderTrackingEditor
                key={`${o.id}-${o.trackingCode ?? ""}-${o.trackingCarrier ?? ""}-${o.trackingUrl ?? ""}`}
                orderId={o.id}
                token={token}
                initial={{
                  trackingCarrier: o.trackingCarrier,
                  trackingCode: o.trackingCode,
                  trackingUrl: o.trackingUrl,
                }}
                onSaved={() => void reload()}
              />
            </div>
          </article>
        );
      })}

      {orders.length === 0 ? (
        <div className="page-panel ae-empty-center">Nenhuma encomenda neste filtro.</div>
      ) : null}
    </>
  );
}
