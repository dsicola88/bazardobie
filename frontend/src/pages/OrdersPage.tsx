import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { resumeCheckoutPayment } from "../utils/checkoutResumePay.js";
import { useAuth } from "../auth/AuthContext.js";
import { OrderTimeline } from "../components/OrderTimeline.js";
import { ReviewOrderModal } from "../components/ReviewOrderModal.js";
import { etiquetaGateway, etiquetaPagamento } from "../utils/paymentLabels.js";
import {
  BUYER_ORDER_TAB_LABELS,
  BUYER_ORDER_TABS_FLOW,
  etiquetaEstadoPedidoCliente,
  orderMatchesBuyerTab,
  parseBuyerOrdersTabParam,
  type BuyerOrdersTab,
} from "../utils/buyerOrderFilters.js";
import { orderLogisticsFromItems } from "../utils/vendorOrderStatuses.js";
import { orderItemDisplayTitle, orderItemVariantSubtitle } from "../utils/variantDisplay.js";

type OrderItem = {
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
  shopId?: string;
  deliveryTipo?: string;
};

type Order = {
  id: string;
  orderCode?: string | null;
  checkoutGroupId?: string | null;
  status: string;
  grandTotal: string;
  createdAt: string;
  paymentMethod: string;
  paymentProofUrl?: string | null;
  gatewayPayStatus?: string;
  items?: OrderItem[];
  trackingCarrier?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
};

type OrdersMineResp = { items: Order[]; total: number; skip: number; take: number };

const BUYER_ORDER_PAGE = 35;

export default function OrdersPage() {
  const { token, user } = useAuth();
  const [list, setList] = useState<Order[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const gatewayFlash = searchParams.get("gateway");
  const gatewayGid = searchParams.get("gid");

  const [reviewModal, setReviewModal] = useState<{
    orderId: string;
    productId: string;
    productName: string;
  } | null>(null);

  const [ordersTab, setOrdersTab] = useState<BuyerOrdersTab>(
    () => parseBuyerOrdersTabParam(searchParams.get("tab")) ?? "todos"
  );

  useEffect(() => {
    const fromUrl = parseBuyerOrdersTabParam(searchParams.get("tab"));
    if (fromUrl != null) setOrdersTab(fromUrl);
  }, [searchParams]);

  function selectOrdersTab(tab: BuyerOrdersTab) {
    setOrdersTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === "todos") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  }

  const unpaidOnlineGroups = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const o of list) {
      if (o.paymentMethod !== "PAGAMENTO_ONLINE" || !o.checkoutGroupId) continue;
      if (
        o.gatewayPayStatus !== "AGUARDANDO_PAGAMENTO" &&
        o.gatewayPayStatus !== "PROCESSANDO" &&
        o.gatewayPayStatus !== "FALHOU"
      )
        continue;
      if (seen.has(o.checkoutGroupId)) continue;
      seen.add(o.checkoutGroupId);
      out.push(o.checkoutGroupId);
    }
    return out;
  }, [list]);

  const reload = useCallback(() => {
    if (!token || user?.role !== "CLIENTE") return;
    void apiFetch<OrdersMineResp>(`/orders/my?take=${BUYER_ORDER_PAGE}&skip=0`, { token })
      .then((res) => {
        setList(res.items);
        setOrdersTotal(res.total);
      })
      .catch(() => {
        setList([]);
        setOrdersTotal(0);
      });
  }, [token, user]);

  const loadMore = useCallback(() => {
    if (!token || user?.role !== "CLIENTE") return;
    void apiFetch<OrdersMineResp>(`/orders/my?take=${BUYER_ORDER_PAGE}&skip=${list.length}`, { token })
      .then((res) => {
        setList((prev) => [...prev, ...res.items]);
        setOrdersTotal(res.total);
      })
      .catch(() => {});
  }, [token, user, list.length]);

  const resumePay = useCallback(
    async (checkoutGroupId: string) => {
      if (!token) return;
      try {
        await resumeCheckoutPayment(token, checkoutGroupId);
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "Não foi possível retomar o pagamento.");
      }
    },
    [token]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<BuyerOrdersTab, number>> = {};
    for (const tab of BUYER_ORDER_TABS_FLOW) {
      counts[tab] = list.filter((o) => orderMatchesBuyerTab(o, tab)).length;
    }
    return counts;
  }, [list]);

  const filteredList = useMemo(
    () => list.filter((o) => orderMatchesBuyerTab(o, ordersTab)),
    [list, ordersTab]
  );

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

  return (
    <div className="ae-orders-wrap">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <h1 className="ae-checkout__title" style={{ margin: 0 }}>
          As minhas encomendas
        </h1>
        <Link to="/search">Continuar compras →</Link>
      </div>

      {gatewayFlash === "PAGO" ? (
        <div className="page-panel" style={{ background: "linear-gradient(90deg,#e8f9ef,#fff)", marginBottom: 14 }}>
          <strong>Pagamento concluído</strong>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {gatewayGid ? <code>{gatewayGid}</code> : null}
          </div>
        </div>
      ) : null}
      {gatewayFlash === "ERRO" ? (
        <div className="page-panel ae-checkout-msg" style={{ marginBottom: 14 }}>
          Pagamento não confirmado. Tente novamente em Encomendas.
        </div>
      ) : null}

      {unpaidOnlineGroups.map((gid) => (
        <div key={gid} className="page-panel" style={{ marginBottom: 12, background: "#fffaf7" }}>
          <strong>Liquidação pendente</strong>
          <div className="ae-muted" style={{ fontSize: 12, margin: "8px 0 10px" }}>
            <code style={{ fontSize: 11 }}>{gid.slice(0, 12)}…</code>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void resumePay(gid)}>
            Retomar pagamento
          </button>
        </div>
      ))}

      <nav className="ae-buyer-orders-tabs" aria-label="Filtrar encomendas">
        <div className="ae-buyer-orders-tabs__scroll">
          {BUYER_ORDER_TABS_FLOW.map((tab) => {
            const n = tabCounts[tab] ?? 0;
            const active = ordersTab === tab;
            return (
              <button
                key={tab}
                type="button"
                className={`ae-buyer-orders-tabs__btn${active ? " ae-buyer-orders-tabs__btn--active" : ""}`}
                onClick={() => selectOrdersTab(tab)}
              >
                {BUYER_ORDER_TAB_LABELS[tab]}
                <span className="ae-buyer-orders-tabs__count">{n}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <p className="ae-muted" style={{ fontSize: 12, margin: "-6px 0 14px" }}>
        Fluxo: pagamento → confirmação da loja → preparação → trânsito → entregue. Depois de «Entregue», pode avaliar cada artigo com fotos.
      </p>
      <p className="ae-muted" style={{ fontSize: 12, margin: "-8px 0 14px" }}>
        {ordersTotal > list.length ? (
          <>
            Mostradas <strong>{list.length}</strong> de <strong>{ordersTotal}</strong> encomendas — use «Carregar mais» para ampliar o histórico.
            Os badges nos separadores reflectem só o que já está carregado.
          </>
        ) : ordersTotal > 0 ? (
          <>
            <strong>{list.length}</strong> encomenda(s) carregada(s).
          </>
        ) : null}
      </p>

      <ReviewOrderModal
        open={!!reviewModal}
        token={token}
        orderId={reviewModal?.orderId ?? ""}
        productId={reviewModal?.productId ?? ""}
        productName={reviewModal?.productName ?? ""}
        onClose={() => setReviewModal(null)}
        onCreated={() => reload()}
      />

      <ul style={{ padding: 0, listStyle: "none", margin: 0 }}>
        {filteredList.length === 0 ? (
          <li className="page-panel ae-buyer-orders-empty">
            <strong>Nenhuma encomenda neste separador.</strong>
            <p className="ae-muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
              Use «Todas» para ver o histórico completo ou «À pagar» se finalizou com pagamento online.
            </p>
          </li>
        ) : null}
        {filteredList.map((o) => (
          <li key={o.id} className="page-panel ae-order-card" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <strong>Encomenda {o.orderCode || `${o.id.slice(0, 10)}…`}</strong>
                <div className="ae-muted" style={{ fontSize: 12 }}>
                  {new Date(o.createdAt).toLocaleString("pt-AO")}
                </div>
              </div>
              <div style={{ textAlign: "right" as const }}>
                <div>{Number(o.grandTotal).toFixed(0)} Kz</div>
                <div className="ae-muted" style={{ fontSize: 12 }}>
                  {etiquetaEstadoPedidoCliente(o.status)}
                </div>
                <div className="ae-muted" style={{ fontSize: 12 }}>
                  Pagamento: {etiquetaPagamento(o.paymentMethod)}
                </div>
                {o.paymentMethod === "PAGAMENTO_ONLINE" && o.gatewayPayStatus ? (
                  <div className="ae-muted" style={{ fontSize: 12 }}>
                    Estado electrónico: {etiquetaGateway(o.gatewayPayStatus)}
                  </div>
                ) : null}
                {o.paymentMethod === "TRANSFERENCIA" && o.paymentProofUrl ? (
                  <div className="ae-muted" style={{ fontSize: 12 }}>
                    Comprovativo:{" "}
                    <a href={o.paymentProofUrl} target="_blank" rel="noopener noreferrer">
                      ver link
                    </a>
                  </div>
                ) : null}
              </div>
            </div>

            <OrderTimeline status={o.status} logistics={orderLogisticsFromItems(o.items ?? [])} />

            {(o.trackingCode || o.trackingUrl || o.trackingCarrier) && (o.status === "EM_ENTREGA" || o.status === "ENTREGUE") ? (
              <div className="ae-order-tracking-snippet" style={{ marginTop: 10 }}>
                <strong>Rastreio:</strong>{" "}
                {[o.trackingCarrier, o.trackingCode].filter(Boolean).join(" · ") || "—"}
                {o.trackingUrl ? (
                  <>
                    {" "}
                    <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer">
                      seguir envio
                    </a>
                  </>
                ) : null}
              </div>
            ) : null}

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }} className="ae-order-card__actions">
              <Link to={`/orders/${encodeURIComponent(o.id)}/seguir`} className="btn btn-ghost">
                Seguir encomenda
              </Link>
              <Link to={`/orders/${encodeURIComponent(o.id)}/seguir#chat`} className="btn">
                Chat com vendedor
              </Link>
            </div>

            {o.items && o.items.length > 0 ? (
              <div className="ae-order-items">
                <div className="ae-tracking__heading" style={{ marginBottom: 6 }}>
                  Artigos
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {o.items.map((it, idx) => {
                    const vSub = orderItemVariantSubtitle(it);
                    return (
                    <li key={`${it.productId}-${idx}`} className="ae-order-items__line">
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
                      </div>
                      {o.status === "ENTREGUE" ? (
                        <button
                          type="button"
                          className="ae-tracking__cta"
                          onClick={() =>
                            setReviewModal({
                              orderId: o.id,
                              productId: it.productId,
                              productName: orderItemDisplayTitle(it.productNameSnapshot, vSub),
                            })
                          }
                        >
                          Avaliar
                        </button>
                      ) : null}
                    </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {ordersTotal > list.length ? (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={() => void loadMore()}>
            Carregar mais encomendas ({list.length}/{ordersTotal})
          </button>
        </div>
      ) : null}
    </div>
  );
}
