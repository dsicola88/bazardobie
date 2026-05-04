import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { OrderTrackingEditor } from "../components/OrderTrackingEditor.js";
import { formatKz } from "../utils/format.js";
import { etiquetaEstadoPedidoCliente } from "../utils/buyerOrderFilters.js";
import { etiquetaGateway, etiquetaPagamento } from "../utils/paymentLabels.js";
import type { LogisticsKind } from "../utils/orderTracking.js";
import { orderLogisticsFromItems, vendorSelectableStatuses } from "../utils/vendorOrderStatuses.js";

type Row = {
  id: string;
  status: string;
  grandTotal: string;
  createdAt: string;
  paymentMethod: string;
  gatewayPayStatus?: string;
  user?: { name: string; email: string };
  items: {
    productNameSnapshot: string;
    quantity: number;
    unitPrice: string;
    deliveryTipo?: string;
  }[];
  trackingCarrier?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
};

function logisticsLabel(kind: LogisticsKind) {
  return kind === "PLATAFORMA" ? "Envio BAZAR DO BIÉ (plataforma)" : "Envio pela loja";
}

export default function VendorOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [patchErr, setPatchErr] = useState<string | null>(null);

  async function reload() {
    if (!token) return;
    const list = await apiFetch<Row[]>("/vendor/orders", { token });
    setOrders(list);
  }

  useEffect(() => {
    void reload().catch(() => setOrders([]));
  }, [token]);

  const filtered = orders.filter((o) => {
    const blob = `${o.id} ${o.user?.name ?? ""} ${o.items.map((i) => i.productNameSnapshot).join(" ")}`.toLowerCase();
    return !q.trim() || blob.includes(q.trim().toLowerCase());
  });

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
      setPatchErr(e instanceof Error ? e.message : "Não foi possível actualizar o estado.");
    }
  }

  return (
    <>
      <header className="ae-v-head">
        <div>
          <h1 className="ae-v-title">Encomendas da loja</h1>
          <p className="ae-muted" style={{ margin: "4px 0 0" }}>
            Confirme a encomenda e marque quando estiver <strong>preparada</strong>. Se o envio for operado pelo{" "}
            <strong>BAZAR DO BIÉ</strong>, o trânsito e a entrega são actualizados pela plataforma — os estados
            acompanham a mesma sequência vista pelo comprador.
          </p>
        </div>
        <input
          type="search"
          placeholder="Pesquisar encomenda ou comprador…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ padding: "8px 10px", minWidth: 240, border: "1px solid var(--ae-line)", borderRadius: 4 }}
        />
      </header>

      {patchErr ? (
        <p className="ae-admin-alert ae-admin-alert--err" role="alert">
          {patchErr}
        </p>
      ) : null}

      {filtered.map((o) => {
        const logistics = orderLogisticsFromItems(o.items ?? []);
        const options = vendorSelectableStatuses(o.status, logistics);

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
                background: "#fafafa",
              }}
            >
              <div>
                <strong style={{ fontFamily: "monospace", fontSize: 13 }}>{o.id}</strong>
                <div className="ae-muted" style={{ fontSize: 12 }}>
                  {new Date(o.createdAt).toLocaleString("pt-AO")} · {(o.user && o.user.name) || ""} ·{" "}
                  {etiquetaPagamento(o.paymentMethod)}
                  {o.paymentMethod === "PAGAMENTO_ONLINE" && o.gatewayPayStatus ? (
                    <> · estado electrónico: {etiquetaGateway(o.gatewayPayStatus)}</>
                  ) : null}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span className="ae-badge ae-badge--live" style={{ fontSize: 11 }}>
                    {logisticsLabel(logistics)}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <strong>{formatKz(o.grandTotal)}</strong>
                <select
                  className="ae-status-select"
                  value={o.status}
                  onChange={(e) => void setStatus(o.id, e.target.value)}
                  aria-label={`Estado da encomenda ${o.id}`}
                >
                  {options.map((s) => (
                    <option key={s} value={s}>
                      {etiquetaEstadoPedidoCliente(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {logistics === "PLATAFORMA" && o.status === "EM_PREPARACAO" ? (
              <p className="ae-muted" style={{ margin: 0, padding: "10px 14px", fontSize: 12, background: "#fff9f4" }}>
                Pronto para recolha — a equipa de logística (conta LOGISTICA) ou o admin marcará «Em entrega» após recolher o volume.
              </p>
            ) : null}
            {logistics === "PLATAFORMA" && o.status === "EM_ENTREGA" ? (
              <p className="ae-muted" style={{ margin: 0, padding: "10px 14px", fontSize: 12, background: "#f7fafc" }}>
                Em entrega pelo BAZAR DO BIÉ — «Entregue» é marcado pela logística ou admin; depois o comprador confirma conforme o pagamento.
              </p>
            ) : null}
            <table className="ae-data-table" style={{ border: "none", borderRadius: 0 }}>
              <tbody>
                {o.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.productNameSnapshot}</td>
                    <td style={{ width: 120 }}>× {it.quantity}</td>
                    <td style={{ width: 120 }}>{formatKz(it.unitPrice)}</td>
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
                disabled={logistics !== "VENDEDOR"}
              />
              {logistics === "PLATAFORMA" ? (
                <p className="ae-muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
                  Com envio BAZAR DO BIÉ, o rastreio é definido pela logística da plataforma.
                </p>
              ) : null}
            </div>
          </article>
        );
      })}

      {filtered.length === 0 ? (
        <div className="page-panel ae-empty-center">Nenhuma encomenda encontrada.</div>
      ) : null}
    </>
  );
}
