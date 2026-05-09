import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { isPlatformAdmin } from "./adminAccess.js";
import { OrderTimeline } from "../components/OrderTimeline.js";
import { OrderTrackingEditor } from "../components/OrderTrackingEditor.js";
import { etiquetaEstadoPedidoCliente } from "../utils/buyerOrderFilters.js";
import {
  etiquetaEstadoDisputa,
  etiquetaEscrowEstado,
  etiquetaGateway,
  etiquetaMotivoLibertacaoEscrow,
  etiquetaMovimentoLedger,
  etiquetaPagamento,
} from "../utils/paymentLabels.js";
import { formatKz } from "../utils/format.js";
import { orderLogisticsFromItems } from "../utils/vendorOrderStatuses.js";

const ORDER_STATUSES = [
  "PENDENTE",
  "CONFIRMADO",
  "EM_PREPARACAO",
  "EM_ENTREGA",
  "ENTREGUE",
  "CANCELADO",
] as const;

type LedgerRow = { kind: string; amount: string; note: string | null; createdAt: string };
type DisputeRow = { id: string; status: string; reason: string; createdAt: string };

type AdminOrder = {
  id: string;
  status: string;
  grandTotal: string;
  subtotal: string;
  deliveryTotal: string;
  createdAt: string;
  updatedAt: string;
  paymentMethod: string;
  paymentProofUrl?: string | null;
  gatewayPayStatus?: string;
  gatewayProvider?: string | null;
  checkoutGroupId?: string | null;
  escrowState?: string;
  escrowReleaseReason?: string | null;
  deliveredAt?: string | null;
  buyerConfirmedAt?: string | null;
  escrowAutoConfirmAt?: string | null;
  escrowReleasedAt?: string | null;
  shippingName: string;
  shippingPhone: string;
  shippingProvince: string;
  shippingCity: string;
  shippingAddress: string | null;
  shippingPickupPoint?: { id: string; namePt: string; refCode?: string | null } | null;
  notes?: string | null;
  user: { id: string; email: string; name: string; phone?: string | null };
  items: {
    productId: string;
    productNameSnapshot: string;
    quantity: number;
    unitPrice: string;
    deliveryTipo?: string;
    shop?: { id: string; name: string } | null;
  }[];
  ledgerEntries?: LedgerRow[];
  disputes?: DisputeRow[];
  trackingCarrier?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  logisticsPartnerId?: string | null;
  logisticsPartner?: { id: string; name: string } | null;
};

type PartnerOpt = { id: string; name: string; active: boolean };

export default function AdminOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const { token, user } = useAuth();
  const canAssignCarrier = isPlatformAdmin(user?.role);
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [partners, setPartners] = useState<PartnerOpt[] | null>(null);
  const [orderPartnerDraft, setOrderPartnerDraft] = useState<string>("");
  const [partnerMsg, setPartnerMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("PENDENTE");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !orderId) return;
    void apiFetch<AdminOrder>(`/admin/orders/${orderId}`, { token })
      .then((o) => {
        setOrder(o);
        setOrderPartnerDraft(o.logisticsPartnerId ?? "");
        setStatus(o.status);
        setErr(null);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Não foi possível carregar."));
  }, [token, orderId]);

  useEffect(() => {
    if (!token || !canAssignCarrier) return;
    void apiFetch<PartnerOpt[]>("/admin/logistics-partners", { token })
      .then(setPartners)
      .catch(() => setPartners([]));
  }, [token, canAssignCarrier]);

  async function patchOrderPartner() {
    if (!token || !orderId) return;
    setPartnerMsg(null);
    try {
      const oid = orderPartnerDraft === "" ? null : orderPartnerDraft;
      const o = await apiFetch<AdminOrder>(`/admin/orders/${orderId}/logistics-partner`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ logisticsPartnerId: oid }),
      });
      setOrder(o);
      setOrderPartnerDraft(o.logisticsPartnerId ?? "");
      setPartnerMsg("Atribuição ao parceiro actualizada.");
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Operação falhou.");
    }
  }

  async function patchStatus() {
    if (!token || !orderId) return;
    setMsg(null);
    try {
      await apiFetch(`/orders/${orderId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      setMsg("Estado actualizado.");
      const o = await apiFetch<AdminOrder>(`/admin/orders/${orderId}`, { token });
      setOrder(o);
      setStatus(o.status);
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Operação falhou.");
    }
  }

  if (err && !order) {
    return (
      <div className="page-panel">
        <p style={{ color: "crimson" }}>{err}</p>
        <Link to="/admin/orders">← Lista de encomendas</Link>
      </div>
    );
  }

  if (!orderId || !order) {
    return <p className="ae-muted">A carregar…</p>;
  }

  const logistics = orderLogisticsFromItems(order.items ?? []);

  return (
    <div>
      <div className="ae-checkout__breadcrumb" style={{ marginBottom: 8 }}>
        <Link to="/admin/orders">Encomendas</Link>
        <span className="ae-checkout__sep">›</span>
        <span className="ae-on">Detalhe</span>
      </div>

      <div className="ae-v-head">
        <div>
          <h1 className="ae-v-title" style={{ marginBottom: 6 }}>
            Encomenda · {etiquetaEstadoPedidoCliente(order.status)}
          </h1>
          <p className="ae-muted" style={{ margin: 0, fontSize: 13 }}>
            <code>{order.id}</code>
            {" · "}
            Criada {new Date(order.createdAt).toLocaleString("pt-AO")}
            {order.updatedAt !== order.createdAt ? (
              <>
                {" · "}
                Actualizada {new Date(order.updatedAt).toLocaleString("pt-AO")}
              </>
            ) : null}
          </p>
        </div>
      </div>

      {msg ? (
        <p className="ae-admin-alert" style={{ background: "#e8f9ef", borderColor: "var(--ae-ok)" }}>
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="ae-admin-alert ae-admin-alert--err" role="alert">
          {err}
        </p>
      ) : null}

      <div className="page-panel" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Valores</h2>
        <p style={{ margin: "0 0 6px" }}>
          <strong>Total:</strong> {formatKz(order.grandTotal)}
        </p>
        <p className="ae-muted" style={{ margin: 0, fontSize: 13 }}>
          Subtotal {formatKz(order.subtotal)} · Portes {formatKz(order.deliveryTotal)}
        </p>
      </div>

      <div className="page-panel" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Comprador</h2>
        <p style={{ margin: 0, lineHeight: 1.55 }}>
          <strong>{order.user.name}</strong>
          <br />
          <span className="ae-muted">{order.user.email}</span>
          {order.user.phone ? (
            <>
              <br />
              Tel. {order.user.phone}
            </>
          ) : null}
        </p>
      </div>

      <div className="page-panel" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Pagamento</h2>
        <p style={{ margin: "0 0 8px" }}>
          <strong>Método:</strong> {etiquetaPagamento(order.paymentMethod)}
        </p>
        {order.paymentMethod === "PAGAMENTO_ONLINE" && order.gatewayPayStatus ? (
          <p style={{ margin: "0 0 8px", fontSize: 14 }}>
            <strong>Gateway:</strong> {etiquetaGateway(order.gatewayPayStatus)}
          </p>
        ) : null}
        {order.gatewayProvider ? (
          <p className="ae-muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
            Fornecedor sessão: <code>{order.gatewayProvider}</code>
          </p>
        ) : null}
        {order.checkoutGroupId ? (
          <p className="ae-muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
            Grupo checkout: <code>{order.checkoutGroupId}</code>
          </p>
        ) : null}
        {order.paymentMethod === "TRANSFERENCIA" && order.paymentProofUrl ? (
          <p style={{ margin: 0 }}>
            <a href={order.paymentProofUrl} target="_blank" rel="noopener noreferrer">
              Comprovativo de transferência
            </a>
          </p>
        ) : null}
      </div>

      {order.paymentMethod === "PAGAMENTO_ONLINE" ? (
        <div className="page-panel" style={{ marginBottom: 14, background: "#fafafa" }}>
          <h2 style={{ marginTop: 0, fontSize: 15 }}>Escrow (dinheiro seguro)</h2>
          <p style={{ margin: "0 0 8px", fontSize: 14 }}>
            <strong>Estado:</strong> {order.escrowState ? etiquetaEscrowEstado(order.escrowState) : "—"}
          </p>
          {order.escrowReleaseReason ? (
            <p className="ae-muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
              Motivo libertação: <strong>{etiquetaMotivoLibertacaoEscrow(order.escrowReleaseReason)}</strong>
            </p>
          ) : null}
          {order.deliveredAt ? (
            <p className="ae-muted" style={{ margin: "0 0 4px", fontSize: 13 }}>
              Marcado entregue (logística): {new Date(order.deliveredAt).toLocaleString("pt-AO")}
            </p>
          ) : null}
          {order.buyerConfirmedAt ? (
            <p className="ae-muted" style={{ margin: "0 0 4px", fontSize: 13 }}>
              Comprador confirmou receção: {new Date(order.buyerConfirmedAt).toLocaleString("pt-AO")}
            </p>
          ) : null}
          {order.escrowAutoConfirmAt ? (
            <p className="ae-muted" style={{ margin: "0 0 4px", fontSize: 13 }}>
              Auto-confirmação prevista: {new Date(order.escrowAutoConfirmAt).toLocaleString("pt-AO")}
            </p>
          ) : null}
          {order.escrowReleasedAt ? (
            <p className="ae-muted" style={{ margin: 0, fontSize: 13 }}>
              Libertação registada: {new Date(order.escrowReleasedAt).toLocaleString("pt-AO")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="page-panel" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Logística vista pelo cliente</h2>
        <p className="ae-muted" style={{ marginTop: 0, fontSize: 13 }}>
          Modalidade neste pedido:{" "}
          <strong>{logistics === "PLATAFORMA" ? "BAZAR DO BIÉ (plataforma)" : "Loja parceira"}</strong>
        </p>
        <OrderTimeline status={order.status} logistics={logistics} />
      </div>

      {logistics === "PLATAFORMA" ? (
        <div className="page-panel" style={{ marginBottom: 14 }}>
          <h2 style={{ marginTop: 0, fontSize: 15 }}>Transportadora parceira da encomenda</h2>
          {canAssignCarrier ? (
            <>
              <p className="ae-muted" style={{ marginTop: 0, fontSize: 13 }}>
                Quem trata recolha e última milha neste pedido. Utilizadores LOGISTICA ligados a um parceiro só veem e
                actualizam encomendas atribuídas ao mesmo. Equipa interna sem parceiro mantém acesso a todas as filas.
              </p>
              {partnerMsg ? (
                <p className="ae-admin-alert" style={{ background: "#e8f9ef", borderColor: "var(--ae-ok)", fontSize: 13 }}>
                  {partnerMsg}
                </p>
              ) : null}
              <label style={{ display: "block", marginTop: 8 }}>
                Parceiro{" "}
                <select
                  className="ae-status-select"
                  value={orderPartnerDraft}
                  onChange={(e) => setOrderPartnerDraft(e.target.value)}
                  style={{ marginLeft: 8, maxWidth: 280 }}
                >
                  <option value="">Equipa interna / ainda não atribuído</option>
                  {(partners ?? [])
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <div style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-primary" onClick={() => void patchOrderPartner()}>
                  Guardar atribuição
                </button>
              </div>
            </>
          ) : (
            <p className="ae-muted" style={{ marginTop: 0, fontSize: 13 }}>
              Atribuição de transportadora: apenas administrador. Pode actualizar estado e rastreio abaixo.
            </p>
          )}
          {order.logisticsPartner ? (
            <p className="ae-muted" style={{ marginTop: 12, fontSize: 12 }}>
              Parceiro registado: <strong>{order.logisticsPartner.name}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="page-panel" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Rastreio visível ao comprador</h2>
        <p className="ae-muted" style={{ marginTop: 0, fontSize: 12 }}>
          Transportadora, código e URL de seguimento (também editáveis pela loja ou logística, segundo as permissões).
        </p>
        {token ? (
          <OrderTrackingEditor
            key={`${order.id}-${order.trackingCode ?? ""}-${order.trackingCarrier ?? ""}-${order.trackingUrl ?? ""}`}
            orderId={order.id}
            token={token}
            initial={{
              trackingCarrier: order.trackingCarrier,
              trackingCode: order.trackingCode,
              trackingUrl: order.trackingUrl,
            }}
            onSaved={async () => {
              const o = await apiFetch<AdminOrder>(`/admin/orders/${orderId}`, { token });
              setOrder(o);
            }}
          />
        ) : null}
      </div>

      <div className="page-panel" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Entrega</h2>
        <p style={{ margin: 0, lineHeight: 1.55 }}>
          {order.shippingName} · {order.shippingPhone}
          <br />
          {order.shippingProvince}, {order.shippingCity}
          {order.shippingPickupPoint?.namePt ? (
            <>
              <br />
              <strong>Ponto:</strong> {order.shippingPickupPoint.namePt}
              {order.shippingPickupPoint.refCode ? ` (${order.shippingPickupPoint.refCode})` : ""}
            </>
          ) : null}
          <br />
          {(order.shippingAddress ?? "").trim() || (
            <span className="ae-muted">Sem instruções textuais · destino estruturado via catálogo.</span>
          )}
        </p>
        {order.notes?.trim() ? (
          <p className="ae-muted" style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 13 }}>
            Notas: {order.notes}
          </p>
        ) : null}
      </div>

      <div className="page-panel" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Linhas</h2>
        <table className="ae-data-table">
          <thead>
            <tr>
              <th>Loja</th>
              <th>Artigo</th>
              <th>Envio</th>
              <th>Qtd.</th>
              <th>Preço unit.</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={`${it.productId}-${i}`}>
                <td>{it.shop?.name ?? "—"}</td>
                <td>{it.productNameSnapshot}</td>
                <td className="ae-muted">{it.deliveryTipo === "PLATAFORMA" ? "Plataforma" : "Parceiro"}</td>
                <td>{it.quantity}</td>
                <td>{formatKz(it.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {order.disputes && order.disputes.length > 0 ? (
        <div className="page-panel" style={{ marginBottom: 14 }}>
          <h2 style={{ marginTop: 0, fontSize: 15 }}>Disputas</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {order.disputes.map((d) => (
              <li key={d.id} style={{ marginBottom: 10 }}>
                <strong>{etiquetaEstadoDisputa(d.status)}</strong> · {new Date(d.createdAt).toLocaleString("pt-AO")}
                <div className="ae-muted" style={{ fontSize: 13, whiteSpace: "pre-wrap", marginTop: 4 }}>
                  {d.reason}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {order.ledgerEntries && order.ledgerEntries.length > 0 ? (
        <div className="page-panel" style={{ marginBottom: 14 }}>
          <h2 style={{ marginTop: 0, fontSize: 15 }}>Ledger</h2>
          <table className="ae-data-table">
            <thead>
              <tr>
                <th>Movimento</th>
                <th>Valor (Kz)</th>
                <th>Nota</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {order.ledgerEntries.map((e, i) => (
                <tr key={`${i}-${e.kind}-${e.createdAt}`}>
                  <td>{etiquetaMovimentoLedger(e.kind)}</td>
                  <td>{Number(e.amount).toFixed(2)}</td>
                  <td className="ae-muted">{e.note ?? "—"}</td>
                  <td className="ae-muted" style={{ fontSize: 12 }}>
                    {new Date(e.createdAt).toLocaleString("pt-AO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <details className="page-panel" style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>JSON bruto (suporte técnico)</summary>
        <pre style={{ overflow: "auto", fontSize: 11, marginTop: 12 }}>{JSON.stringify(order, null, 2)}</pre>
      </details>

      <div className="page-panel" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Suporte — alterar estado</h2>
        <p className="ae-muted" style={{ fontSize: 13 }}>
          Encomendas com envio <strong>BAZAR DO BIÉ</strong>: após «Em preparação», avançar para «Em entrega» e «Entregue».
          Envio pela loja: o parceiro pode marcar trânsito no painel comercial. Utilize esta ferramenta para correcções ou
          cancelamentos excepcionais.
        </p>
        <label style={{ display: "block", marginTop: 12 }}>
          Novo estado{" "}
          <select className="ae-status-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {etiquetaEstadoPedidoCliente(s)} ({s})
              </option>
            ))}
          </select>
        </label>
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={() => void patchStatus()}>
            Aplicar estado
          </button>
        </div>
      </div>

      <p style={{ marginTop: 16 }}>
        <Link to="/admin/orders" className="btn btn-ghost">
          ← Lista de encomendas
        </Link>
      </p>
    </div>
  );
}
