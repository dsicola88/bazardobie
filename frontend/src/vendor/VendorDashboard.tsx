import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { formatKz } from "../utils/format.js";
import { useSiteContent } from "../site/SiteContentContext.js";

const DASH_PRODUCT_SAMPLE = 300;
const DASH_ORD_SAMPLE = 24;
type Period = "day" | "month" | "year" | "custom";

type ProductRow = {
  id: string;
  name: string;
  soldCount: number;
  stock: number;
  isActive: boolean;
};
type OrderMini = {
  id: string;
  orderCode?: string | null;
  status: string;
  grandTotal: string;
  createdAt: string;
};

type ProductMine = { items: ProductRow[]; total: number };
type OrderPage = { items: OrderMini[]; total: number };
type VendorStats = {
  period: Period;
  rangeStart: string;
  rangeEnd: string;
  productTotal: number;
  activeProducts: number;
  inactiveProducts: number;
  ordersTotal: number;
  pendingOrders: number;
  wonOrders: number;
  soldUnits: number;
  refundedOrders: number;
  grossSalesTotal: string;
  refundsTotal: string;
  netSalesTotal: string;
  previousRangeStart: string;
  previousRangeEnd: string;
  previousOrdersTotal: number;
  previousWonOrders: number;
  previousRefundedOrders: number;
  previousGrossSalesTotal: string;
  previousRefundsTotal: string;
  previousNetSalesTotal: string;
  trend: { day: string; orders: number; wonOrders: number; grossSalesTotal: string }[];
  topProducts: { id: string; name: string; soldCount: number; stock: number }[];
};

type ShopMeBrief = {
  isApproved: boolean;
  tier1CompletedAt?: string | null;
  tier2ApprovedAt?: string | null;
  tier2SubmittedAt?: string | null;
  tier2RejectedReason?: string | null;
  tier3ApprovedAt?: string | null;
  tier3SubmittedAt?: string | null;
  tier3RejectedReason?: string | null;
};

export default function VendorDashboard() {
  const { token } = useAuth();
  const { content } = useSiteContent();
  const helpChannel = (content["public.vendor_help_channel_url"] ?? "").trim();
  const helpChannelSafe = /^https?:\/\//i.test(helpChannel) ? helpChannel : "";
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [orders, setOrders] = useState<OrderMini[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [shopStatus, setShopStatus] = useState<"load" | "missing" | "pending" | "ok" | "err">("load");
  const [shopMe, setShopMe] = useState<ShopMeBrief | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [stats, setStats] = useState<VendorStats | null>(null);

  useEffect(() => {
    if (!token) return;
    void apiFetch<ShopMeBrief>("/vendor/shop/me", { token })
      .then((s) => {
        setShopMe(s);
        setShopStatus(s.isApproved ? "ok" : "pending");
      })
      .catch((e: unknown) => {
        const st =
          e && typeof e === "object" && "status" in e ? Number((e as { status: number }).status) : 0;
        if (st === 404) {
          setShopMe(null);
          setShopStatus("missing");
        } else {
          setShopStatus("err");
          setShopMe(null);
        }
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (period === "custom" && (!start || !end)) return;
    const params = new URLSearchParams({ period });
    if (period === "custom" && start && end) {
      params.set("start", `${start}T00:00:00.000Z`);
      params.set("end", `${end}T23:59:59.999Z`);
    }
    void apiFetch<VendorStats>(`/vendor/dashboard/stats?${params.toString()}`, { token })
      .then(setStats)
      .catch(() => setStats(null));
  }, [token, period, start, end]);

  useEffect(() => {
    if (!token) return;
    void apiFetch<ProductMine>(`/vendor/products/mine?take=${DASH_PRODUCT_SAMPLE}&skip=0`, { token })
      .then((mine) => {
        setProducts(mine.items);
        setProductTotal(mine.total);
      })
      .catch(() => {
        setProducts([]);
        setProductTotal(0);
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void apiFetch<OrderPage>(`/vendor/orders?take=${DASH_ORD_SAMPLE}&skip=0`, { token })
      .then((o) => {
        setOrders(o.items);
        setOrdersTotal(o.total);
      })
      .catch(() => {
        setOrders([]);
        setOrdersTotal(0);
      });
  }, [token]);

  const active = products.filter((p) => p.isActive).length;
  const inactive = products.length - active;
  const pend = orders.filter((o) => o.status === "PENDENTE" || o.status === "CONFIRMADO").length;
  const pct = (curr: number, prev: number) => (prev <= 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100);
  const exportCsv = () => {
    if (!stats) return;
    const rows = [
      ["Metrica", "Atual", "Anterior"],
      ["Pedidos", String(stats.ordersTotal), String(stats.previousOrdersTotal)],
      ["Vendas concluidas", String(stats.wonOrders), String(stats.previousWonOrders)],
      ["Devolucoes", String(stats.refundedOrders), String(stats.previousRefundedOrders)],
      ["Total bruto", stats.grossSalesTotal, stats.previousGrossSalesTotal],
      ["Total devolvido", stats.refundsTotal, stats.previousRefundsTotal],
      ["Liquido", stats.netSalesTotal, stats.previousNetSalesTotal],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendor-dashboard-${stats.period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

      {shopStatus === "ok" && shopMe?.tier1CompletedAt && !shopMe.tier2ApprovedAt ? (
        <div
          className="ae-admin-next"
          style={{
            marginBottom: 20,
            borderColor: shopMe.tier2RejectedReason ? "#f0b4b4" : "#b8d4ec",
            background: shopMe.tier2RejectedReason
              ? "linear-gradient(135deg, #fff5f5 0%, #fff 100%)"
              : "linear-gradient(135deg, #f0f7ff 0%, #fff 100%)",
          }}
        >
          <div>
            <h2>Credibilidade — selo «VERIFICADO»</h2>
            {shopMe.tier2SubmittedAt && !shopMe.tier2RejectedReason ? (
              <p>
                Os seus ficheiros de identidade estão <strong>em análise</strong>. Será notificado quando a equipa
                concluir a revisão.
              </p>
            ) : shopMe.tier2RejectedReason ? (
              <p>
                O último envio de nível 2 foi <strong>reprovado</strong>: {shopMe.tier2RejectedReason} Corrija os
                ficheiros e volte a submeter.
              </p>
            ) : (
              <p>
                A sua loja está aprovada. Envie fotografia legível do bilhete e uma selfie segurando o mesmo documento
                para mostrar aos compradores o selo de parceiro verificado.
              </p>
            )}
          </div>
          <Link to="/vendor/credibility" className="btn btn-primary">
            Abrir credibilidade
          </Link>
        </div>
      ) : null}

      {shopStatus === "ok" && shopMe?.tier2ApprovedAt && !shopMe.tier3ApprovedAt ? (
        <div
          className="ae-admin-next"
          style={{
            marginBottom: 20,
            borderColor: "#e8d48b",
            background: "linear-gradient(135deg, #fdfbf5 0%, #fff 100%)",
          }}
        >
          <div>
            <h2>Credibilidade avançada — selo premium</h2>
            {shopMe.tier3SubmittedAt && !shopMe.tier3RejectedReason ? (
              <p>
                Pedido de nível 3 <strong>em análise</strong> (NIF / dados de liquidação). Os compradores apenas verão o
                selo após aprovação.
              </p>
            ) : shopMe.tier3RejectedReason ? (
              <p>
                Nível 3 reprovado: <strong>{shopMe.tier3RejectedReason}</strong> Actualize os dados e reenvie.
              </p>
            ) : (
              <p>
                O nível 2 está concluído. Pode submeter contribuinte, IBAN e documentação registal opcional para o máximo de
                visibilidade e confiança na plataforma.
              </p>
            )}
          </div>
          <Link to="/vendor/credibility" className="btn btn-primary">
            Nível 3 · credibilidade
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
      {helpChannelSafe ? (
        <section className="ae-admin-next" style={{ marginBottom: 14 }}>
          <div>
            <h2>Como usar a app (vídeos)</h2>
            <p>Aceda ao canal de formação para aprender a operar o painel, produtos, encomendas e expedições.</p>
          </div>
          <a className="btn btn-primary" href={helpChannelSafe} target="_blank" rel="noreferrer noopener">
            Abrir canal de apoio
          </a>
        </section>
      ) : null}
      <section className="ae-panel" style={{ marginBottom: 14 }}>
        <div className="ae-admin-toolbar">
          <strong style={{ marginRight: 8 }}>Filtro do painel:</strong>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="day">Hoje</option>
            <option value="month">Mês atual</option>
            <option value="year">Ano atual</option>
            <option value="custom">Período personalizado</option>
          </select>
          {period === "custom" ? (
            <>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={exportCsv}>
            Exportar CSV
          </button>
        </div>
      </section>

      <div className="ae-v-metrics">
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{stats?.productTotal ?? productTotal}</div>
          <div className="ae-v-metric__l">Total de produtos cadastrados</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{stats?.soldUnits ?? 0}</div>
          <div className="ae-v-metric__l">Produtos vendidos (unidades)</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{stats?.pendingOrders ?? pend}</div>
          <div className="ae-v-metric__l">Vendas pendentes</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{stats?.wonOrders ?? 0}</div>
          <div className="ae-v-metric__l">Vendas concluídas/ganhas</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{stats?.refundedOrders ?? 0}</div>
          <div className="ae-v-metric__l">Devoluções (pedidos reembolsados)</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{formatKz(stats?.grossSalesTotal ?? "0")}</div>
          <div className="ae-v-metric__l">Total bruto vendido</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{formatKz(stats?.refundsTotal ?? "0")}</div>
          <div className="ae-v-metric__l">Total em devoluções</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{formatKz(stats?.netSalesTotal ?? "0")}</div>
          <div className="ae-v-metric__l">Resultado líquido</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{productTotal}</div>
          <div className="ae-v-metric__l">Referências no catálogo (total na base)</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{active}</div>
          <div className="ae-v-metric__l">
            Activos na amostra carregada ({inactive} inactivos)
            {productTotal > products.length ? (
              <span className="ae-muted" style={{ display: "block", fontSize: 11, marginTop: 6, fontWeight: 500 }}>
                Amostra: primeiros {products.length} SKU (mais recentes). Detalhes no catálogo.
              </span>
            ) : null}
          </div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__v">{pend}</div>
          <div className="ae-v-metric__l">
            Encomendas pendentes/confirmadas (últimos {Math.min(DASH_ORD_SAMPLE, orders.length)} pedidos na amostra)
            {ordersTotal > orders.length ? (
              <span className="ae-muted" style={{ display: "block", fontSize: 11, marginTop: 6, fontWeight: 500 }}>
                Total de encomendas com a sua loja: {ordersTotal} — vista completa na secção «Encomendas».
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {stats ? (
        <section className="ae-panel" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>Comparação com período anterior</h3>
          <p className="ae-muted" style={{ marginTop: 0 }}>
            Pedidos: {stats.ordersTotal} vs {stats.previousOrdersTotal} ({pct(stats.ordersTotal, stats.previousOrdersTotal).toFixed(1)}%)
            {" · "}Líquido: {formatKz(stats.netSalesTotal)} vs {formatKz(stats.previousNetSalesTotal)} (
            {pct(Number(stats.netSalesTotal), Number(stats.previousNetSalesTotal)).toFixed(1)}%)
          </p>
        </section>
      ) : null}

      <section className="ae-table-wrap" style={{ marginBottom: 20 }}>
        <table className="ae-data-table">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Pedidos</th>
              <th>Concluídos</th>
              <th>Bruto</th>
            </tr>
          </thead>
          <tbody>
            {(stats?.trend ?? []).map((t) => (
              <tr key={t.day}>
                <td>{t.day}</td>
                <td>{t.orders}</td>
                <td>{t.wonOrders}</td>
                <td>{formatKz(t.grossSalesTotal)}</td>
              </tr>
            ))}
            {(stats?.trend?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={4} className="ae-empty-center">
                  Sem tendência diária para o período.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="ae-table-wrap" style={{ marginBottom: 20 }}>
        <table className="ae-data-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Vendidos</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {(stats?.topProducts ?? []).map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.soldCount}</td>
                <td>{p.stock}</td>
              </tr>
            ))}
            {(stats?.topProducts?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={3} className="ae-empty-center">
                  Sem dados de produtos vendidos no período selecionado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

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
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{o.orderCode || `${o.id.slice(0, 12)}…`}</td>
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
