import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { OrderTimeline } from "../components/OrderTimeline.js";
import { ReviewOrderModal } from "../components/ReviewOrderModal.js";
import { OrderChatPanel } from "../components/OrderChatPanel.js";
import {
  BUYER_ORDER_TAB_LABELS,
  etiquetaEstadoPedidoCliente,
  orderNeedsOnlinePayment,
  primaryBuyerTabForOrder,
} from "../utils/buyerOrderFilters.js";
import { resumeCheckoutPayment } from "../utils/checkoutResumePay.js";
import { formatKz } from "../utils/format.js";
import {
  etiquetaEscrowEstado,
  etiquetaGateway,
  etiquetaMotivoLibertacaoEscrow,
  etiquetaMovimentoLedger,
  etiquetaPagamento,
} from "../utils/paymentLabels.js";
import { orderLogisticsFromItems } from "../utils/vendorOrderStatuses.js";
import { orderItemDisplayTitle, orderItemVariantSubtitle } from "../utils/variantDisplay.js";

type TrackItem = {
  productId: string;
  productNameSnapshot: string;
  variantNameSnapshot?: string | null;
  variant?: {
    sku?: string | null;
    name?: string | null;
    color?: string | null;
    size?: string | null;
  } | null;
  quantity?: number;
  deliveryTipo?: string;
};

type TrackOrder = {
  id: string;
  status: string;
  createdAt: string;
  grandTotal: string;
  paymentMethod: string;
  paymentProofUrl?: string | null;
  gatewayPayStatus?: string;
  checkoutGroupId?: string | null;
  escrowState?: string;
  deliveredAt?: string | null;
  buyerConfirmedAt?: string | null;
  escrowAutoConfirmAt?: string | null;
  escrowReleasedAt?: string | null;
  escrowReleaseReason?: string | null;
  shippingName: string;
  shippingPhone: string;
  shippingProvince: string;
  shippingCity: string;
  shippingAddress: string | null;
  shippingPickupPoint?: { id: string; namePt: string; refCode?: string | null } | null;
  disputes?: { id: string; status: string; reason: string; createdAt: string }[];
  ledgerEntries?: { kind: string; amount: string; note: string | null; createdAt: string }[];
  items?: TrackItem[];
  trackingCarrier?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  logisticsPartner?: { id: string; name: string; phone?: string | null } | null;
};

function textoRastreioPorEstado(status: string): string {
  switch (status) {
    case "PENDENTE":
      return "A sua encomenda está registada. A loja parceira será notificada para confirmar assim que o pagamento estiver conforme as regras do método escolhido.";
    case "CONFIRMADO":
      return "A loja confirmou o pedido. Em seguida prepara o embalo e o envio conforme a modalidade (parceiro ou plataforma).";
    case "EM_PREPARACAO":
      return "Os artigos estão a ser preparados para envio ou para recolha pela logística da plataforma, conforme o tipo de entrega.";
    case "EM_ENTREGA":
      return "A encomenda está em trânsito até ao endereço indicado. Prepare-se para receber ou para o pagamento à entrega (se aplicável).";
    case "ENTREGUE":
      return "Estado logístico: entregue. Se pagou online com dinheiro retido, confira os artigos e use «Confirmar que recebi» quando estiver satisfeito.";
    case "CANCELADO":
      return "Esta encomenda foi cancelada. Em caso de valor já debitado, siga as instruções da plataforma ou contacte o suporte.";
    default:
      return "Acompanhe abaixo o estado actual e o calendário da operação.";
  }
}

export default function OrderTrackPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { token, user } = useAuth();
  const [row, setRow] = useState<TrackOrder | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [disputeText, setDisputeText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    orderId: string;
    productId: string;
    productName: string;
  } | null>(null);

  const load = useCallback(() => {
    if (!orderId || !token || user?.role !== "CLIENTE") return;
    void apiFetch<TrackOrder>(`/orders/my/${encodeURIComponent(orderId)}`, { token })
      .then(setRow)
      .catch(() => setErr("Encomenda não encontrada."));
  }, [orderId, token, user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!token || user?.role !== "CLIENTE") {
    return (
      <div className="page-panel" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Link to="/login" className="btn btn-primary">
          Iniciar sessão
        </Link>
        <span className="ae-muted" style={{ fontSize: 13 }}>
          Conta de comprador
        </span>
      </div>
    );
  }

  if (err || !orderId) {
    return (
      <div className="page-panel" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <span>{err ?? "ID inválido."}</span>
        <Link to="/orders" className="btn btn-primary">
          Encomendas
        </Link>
      </div>
    );
  }

  if (!row) return <p className="ae-muted">A carregar…</p>;

  async function confirmReceipt() {
    if (!orderId || !token || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const next = await apiFetch<TrackOrder>(`/orders/my/${encodeURIComponent(orderId)}/confirm-receipt`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      setRow(next);
      setMsg("Receção confirmada. O valor foi libertado ao parceiro, segundo o registo no ledger.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Não foi possível confirmar a receção.");
    } finally {
      setBusy(false);
    }
  }

  async function openDispute() {
    if (!orderId || !token || busy) return;
    const reason = disputeText.trim();
    if (reason.length < 10) {
      setMsg("Descreva o problema (mín. 10 caracteres).");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(`/orders/my/${encodeURIComponent(orderId)}/disputes`, {
        method: "POST",
        token,
        body: JSON.stringify({ reason }),
      });
      setDisputeText("");
      setMsg("Disputa aberta — a equipa vai analisar.");
      load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Não foi possível registar a disputa.");
    } finally {
      setBusy(false);
    }
  }

  async function retomarPagamento() {
    if (!token || !row.checkoutGroupId) return;
    try {
      await resumeCheckoutPayment(token, row.checkoutGroupId);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Não foi possível retomar o pagamento.");
    }
  }

  const openDisputeBlocking = row.disputes?.some((d) => d.status === "OPEN") ?? false;

  const canConfirmEscrow =
    row.paymentMethod === "PAGAMENTO_ONLINE" &&
    row.status === "ENTREGUE" &&
    row.escrowState === "PENDING_BUYER_CONFIRM" &&
    !openDisputeBlocking;

  const canDisputeEscrow =
    row.paymentMethod === "PAGAMENTO_ONLINE" &&
    (row.escrowState === "HELD" || row.escrowState === "PENDING_BUYER_CONFIRM") &&
    row.gatewayPayStatus === "PAGO" &&
    !openDisputeBlocking;

  const autoDate =
    row.escrowAutoConfirmAt && row.escrowState === "PENDING_BUYER_CONFIRM"
      ? new Date(row.escrowAutoConfirmAt).toLocaleString("pt-AO")
      : null;

  const phaseTab = primaryBuyerTabForOrder(row);
  const precisaPagar = orderNeedsOnlinePayment(row);

  return (
    <div style={{ maxWidth: 680 }}>
      <ReviewOrderModal
        open={!!reviewModal}
        token={token}
        orderId={reviewModal?.orderId ?? ""}
        productId={reviewModal?.productId ?? ""}
        productName={reviewModal?.productName ?? ""}
        onClose={() => setReviewModal(null)}
        onCreated={() => load()}
      />

      <div className="ae-checkout__breadcrumb" style={{ marginBottom: 8 }}>
        <Link to={phaseTab === "todos" ? "/orders" : `/orders?tab=${phaseTab}`}>As minhas encomendas</Link>
        <span className="ae-checkout__sep">›</span>
        <span className="ae-on">Seguimento</span>
      </div>
      <h1 className="ae-checkout__title" style={{ marginBottom: 12 }}>
        Encomenda · {etiquetaEstadoPedidoCliente(row.status)}
      </h1>

      <div className="page-panel" style={{ marginBottom: 14 }}>
        <p style={{ marginTop: 0, marginBottom: 8 }} className="ae-muted">
          Ref. <code style={{ fontSize: 12 }}>{row.id.slice(0, 14)}…</code>
          {" · "}
          {new Date(row.createdAt).toLocaleString("pt-AO")}
        </p>
        <p style={{ margin: "0 0 10px", fontSize: 13 }}>
          <strong>Fase neste momento:</strong>{" "}
          <Link to={`/orders?tab=${phaseTab}`} className="ae-tracking__cta" style={{ textDecoration: "none" }}>
            {BUYER_ORDER_TAB_LABELS[phaseTab]}
          </Link>
        </p>
        <p style={{ margin: "0 0 12px" }}>
          {formatKz(row.grandTotal)} · {etiquetaPagamento(row.paymentMethod)}
        </p>
        {row.paymentMethod === "PAGAMENTO_ONLINE" && row.gatewayPayStatus ? (
          <p style={{ margin: "0 0 12px", fontSize: 14 }}>
            <strong>Liquidação electrónica:</strong> {etiquetaGateway(row.gatewayPayStatus)}
          </p>
        ) : null}
        {precisaPagar && row.checkoutGroupId ? (
          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 8,
              background: "#fffaf7",
              border: "1px solid var(--ae-line)",
            }}
          >
            <strong>Pagamento pendente</strong>
            <p className="ae-muted" style={{ fontSize: 13, margin: "8px 0 10px", lineHeight: 1.45 }}>
              Sem liquidação confirmada, a loja não avança na preparação deste pedido (pagamento online).
            </p>
            <button type="button" className="btn btn-primary" onClick={() => void retomarPagamento()}>
              Retomar pagamento
            </button>
          </div>
        ) : null}
        {row.paymentMethod === "TRANSFERENCIA" && row.paymentProofUrl ? (
          <p style={{ margin: "0 0 12px", fontSize: 14 }}>
            <strong>Comprovativo enviado:</strong>{" "}
            <a href={row.paymentProofUrl} target="_blank" rel="noopener noreferrer">
              abrir link
            </a>
          </p>
        ) : null}
        <OrderTimeline status={row.status} logistics={orderLogisticsFromItems(row.items ?? [])} />
        {msg ? (
          <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--ae-deep)" }}>
            {msg}
          </p>
        ) : null}
      </div>

      {row.items && row.items.length > 0 ? (
        <div className="page-panel" style={{ marginBottom: 14 }}>
          <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 15 }}>Artigos</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {row.items.map((it, idx) => {
              const vSub = orderItemVariantSubtitle(it);
              return (
              <li
                key={`${it.productId}-${idx}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: idx < row.items!.length - 1 ? "1px solid var(--ae-line)" : undefined,
                }}
              >
                <div>
                  <div>
                    <Link to={`/product/${it.productId}`} style={{ fontWeight: 600 }}>
                      {it.productNameSnapshot}
                    </Link>
                    <span className="ae-muted"> · Qtd. {it.quantity ?? 1}</span>
                  </div>
                  {vSub ? (
                    <div className="ae-muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {vSub}
                    </div>
                  ) : null}
                  {it.deliveryTipo ? (
                    <div className="ae-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Envio: {it.deliveryTipo === "PLATAFORMA" ? "BAZAR DO BIÉ (plataforma)" : "Loja parceira"}
                    </div>
                  ) : null}
                </div>
                {row.status === "ENTREGUE" ? (
                  <button
                    type="button"
                    className="ae-tracking__cta"
                    onClick={() =>
                      setReviewModal({
                        orderId: row.id,
                        productId: it.productId,
                        productName: orderItemDisplayTitle(it.productNameSnapshot, vSub),
                      })
                    }
                  >
                    Avaliar com fotos
                  </button>
                ) : null}
              </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {row.paymentMethod === "PAGAMENTO_ONLINE" && row.gatewayPayStatus === "PAGO" ? (
        <div className="page-panel" style={{ marginBottom: 14, background: "linear-gradient(135deg,#fffefb,#fafafa)" }}>
          <strong style={{ color: "var(--ae-deep)" }}>Dinheiro seguro (escrow)</strong>
          <div className="ae-muted" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
            Estado: <strong>{row.escrowState ? etiquetaEscrowEstado(row.escrowState) : "—"}</strong>
            {row.escrowReleaseReason ? (
              <>
                {" "}
                · motivo da última libertação:{" "}
                <strong>{etiquetaMotivoLibertacaoEscrow(row.escrowReleaseReason)}</strong>
              </>
            ) : null}
            {row.escrowState === "PENDING_BUYER_CONFIRM" && autoDate ? (
              <>
                {" "}
                · libertação automática se não houver disputa até <strong>{autoDate}</strong>
              </>
            ) : null}
          </div>
          {canConfirmEscrow ? (
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirmReceipt()}>
                Confirmar que recebi a encomenda
              </button>
              <p className="ae-muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                Só confirme após verificar os artigos. Esta acção autoriza a liquidação ao parceiro no ledger.
              </p>
            </div>
          ) : null}
          {canDisputeEscrow ? (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed var(--ae-line)" }}>
              <strong style={{ fontSize: 13 }}>Problema com a encomenda?</strong>
              <textarea
                value={disputeText}
                onChange={(e) => setDisputeText(e.target.value)}
                placeholder="Explique a situação com clareza. O suporte analisa antes de autorizar liquidações ao parceiro."
                rows={3}
                style={{
                  width: "100%",
                  marginTop: 8,
                  font: "inherit",
                  padding: "8px 10px",
                  border: "1px solid var(--ae-line)",
                  borderRadius: 4,
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 8 }}
                disabled={busy}
                onClick={() => void openDispute()}
              >
                Abrir disputa
              </button>
            </div>
          ) : null}
          {openDisputeBlocking ? (
            <p style={{ marginTop: 12, fontSize: 13, marginBottom: 0, color: "var(--ae-warn)", fontWeight: 600 }}>
              Há uma disputa aberta nesta encomenda — aguarde a decisão da plataforma.
            </p>
          ) : null}
          {Array.isArray(row.ledgerEntries) && row.ledgerEntries.length > 0 ? (
            <details style={{ marginTop: 14, fontSize: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Extrato ledger (auditável)</summary>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
                {row.ledgerEntries.map((e, i) => (
                  <li key={`${i}-${e.kind}-${e.createdAt}`}>
                    <strong>{etiquetaMovimentoLedger(e.kind)}</strong> · {Number(e.amount).toFixed(2)} Kz
                    {e.note ? <span className="ae-muted"> — {e.note}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="page-panel" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 15 }}>Entrega</h2>
        <p style={{ marginBottom: 0, lineHeight: 1.5 }}>
          {row.shippingName} · {row.shippingPhone}
          <br />
          {row.shippingProvince}, {row.shippingCity}
          {row.shippingPickupPoint?.namePt ? (
            <>
              <br />
              <strong>Ponto:</strong> {row.shippingPickupPoint.namePt}
            </>
          ) : null}
          <br />
          {(row.shippingAddress ?? "").trim() || (
            <span className="ae-muted">Destino territorial por catálogo — sem texto de morada.</span>
          )}
        </p>
      </div>

      <div className="page-panel ae-track-courier" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 15 }}>Rastreio da entrega</h2>
        <p className="ae-muted" style={{ marginTop: 0, marginBottom: 12, fontSize: 12, lineHeight: 1.5 }}>
          Com envio pela loja, o parceiro regista guia e URL quando expedir. Com envio BAZAR DO BIÉ, a equipa de logística
          ou a administração preenchem estes dados. Recebe notificação quando forem actualizados.
        </p>
        {row.trackingCode || row.trackingUrl || row.trackingCarrier ? (
          <div style={{ fontSize: 14, lineHeight: 1.55 }}>
            {row.trackingCarrier ? (
              <p style={{ margin: "0 0 8px" }}>
                <strong>Transportadora:</strong> {row.trackingCarrier}
              </p>
            ) : null}
            {row.status === "EM_ENTREGA" && row.logisticsPartner?.phone ? (
              <p style={{ margin: "0 0 8px" }}>
                <strong>Telefone da transportadora:</strong>{" "}
                <a href={`tel:${row.logisticsPartner.phone}`}>{row.logisticsPartner.phone}</a>
              </p>
            ) : null}
            {row.trackingCode ? (
              <p style={{ margin: "0 0 8px" }}>
                <strong>Código:</strong>{" "}
                <code style={{ fontSize: 13, padding: "2px 6px", background: "#f5f5f5", borderRadius: 4 }}>
                  {row.trackingCode}
                </code>
                <button
                  type="button"
                  className="ae-tracking__cta"
                  style={{ marginLeft: 8 }}
                  onClick={() => void navigator.clipboard.writeText(row.trackingCode!)}
                >
                  Copiar
                </button>
              </p>
            ) : null}
            {row.trackingUrl ? (
              <a
                href={row.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ display: "inline-block", marginTop: 6 }}
              >
                Abrir página de rastreio
              </a>
            ) : null}
          </div>
        ) : (
          <p className="ae-muted" style={{ marginTop: 0, fontSize: 13 }}>
            Ainda não há código de rastreio registado. Quando a loja ou a logística o indicar, aparecerá aqui.
          </p>
        )}
        <hr style={{ border: 0, borderTop: "1px dashed var(--ae-line)", margin: "14px 0" }} />
        <strong>O que significa este estado?</strong>
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 14, lineHeight: 1.55 }}>
          {textoRastreioPorEstado(row.status)}
        </p>
      </div>

      {token && user ? (
        <div id="chat">
          <OrderChatPanel
            orderId={row.id}
            token={token}
            currentUserId={user.id}
            title="Chat com vendedor"
          />
        </div>
      ) : null}

      <p style={{ marginTop: 16 }}>
        <Link to={phaseTab === "todos" ? "/orders" : `/orders?tab=${phaseTab}`} className="btn btn-ghost">
          ← Voltar às encomendas ({BUYER_ORDER_TAB_LABELS[phaseTab]})
        </Link>
      </p>
    </div>
  );
}
