import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { isPlatformAdmin } from "./adminAccess.js";
import { AdminDashboardSkeleton } from "./ui/AdminDashboardSkeleton.js";
import { AdminErrorBanner } from "./ui/AdminErrorBanner.js";

type QueueStats = {
  pendingProductsModeration?: number;
  shopsAwaitingApproval?: number;
  credibilityQueuesPending?: number;
  openDisputes?: number;
  openReports?: number;
  ordersToday?: number;
};

type StatsFull = QueueStats & {
  period: "day" | "month" | "year" | "custom";
  rangeStart: string;
  rangeEnd: string;
  totalOrders: number;
  revenueTotal: string;
  platformCommissionBps: number;
  platformProfitEstimate: string;
  totalUsers: number;
  approvedShops: number;
  activeProducts: number;
  activeVendors: number;
  escrowHeldTotal: string;
  escrowReleasedTotal: string;
  periodOrders: number;
  periodRevenueTotal: string;
  periodRefundedOrders: number;
  periodRefundsTotal: string;
  previousRangeStart: string;
  previousRangeEnd: string;
  previousPeriodOrders: number;
  previousPeriodRevenueTotal: string;
  previousPeriodRefundedOrders: number;
  previousPeriodRefundsTotal: string;
  trend: { day: string; orders: number; revenueTotal: string; refundsTotal: string }[];
};

type StatsSupport = QueueStats & {
  period: "day" | "month" | "year" | "custom";
  rangeStart: string;
  rangeEnd: string;
  totalOrders: number;
  totalUsers: number;
  approvedShops: number;
  activeProducts: number;
  activeVendors: number;
  periodOrders: number;
  previousRangeStart: string;
  previousRangeEnd: string;
  previousPeriodOrders: number;
  trend: { day: string; orders: number }[];
};

function isStatsFull(s: StatsFull | StatsSupport): s is StatsFull {
  return "revenueTotal" in s;
}

function KpiQueues({ stats }: { stats: QueueStats }) {
  const p = stats.pendingProductsModeration ?? 0;
  const s = stats.shopsAwaitingApproval ?? 0;
  const c = stats.credibilityQueuesPending ?? 0;
  const d = stats.openDisputes ?? 0;
  const r = stats.openReports ?? 0;
  const o = stats.ordersToday ?? 0;

  const items: {
    label: string;
    value: number;
    to: string;
    hint: string;
    pulse: boolean;
  }[] = [
    {
      label: "Produtos na moderação",
      value: p,
      to: "/admin/products?status=PENDING",
      hint: "Rever fila",
      pulse: p > 0,
    },
    {
      label: "Lojas por aprovar",
      value: s,
      to: "/admin/sellers?tab=pending",
      hint: "Aprovar cadastros",
      pulse: s > 0,
    },
    {
      label: "Filas de credibilidade",
      value: c,
      to: "/admin/credibility",
      hint: "BI / documentos",
      pulse: c > 0,
    },
    {
      label: "Disputas abertas",
      value: d,
      to: "/admin/disputes",
      hint: "Resolver casos",
      pulse: d > 0,
    },
    {
      label: "Denúncias abertas",
      value: r,
      to: "/admin/trust",
      hint: "Ver relatórios",
      pulse: r > 0,
    },
    {
      label: "Encomendas hoje",
      value: o,
      to: "/admin/orders",
      hint: "Operação do dia",
      pulse: false,
    },
  ];

  return (
    <section style={{ marginBottom: 28 }}>
      <h2 className="ae-admin-section-title">Filas operacionais</h2>
      <div className="ae-admin-kpi-grid">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className={`ae-admin-kpi-card${it.pulse ? " ae-admin-kpi-card--pulse" : ""}`}
          >
            <span className="ae-admin-kpi-card__label">{it.label}</span>
            <span className="ae-admin-kpi-card__value">{it.value.toLocaleString("pt-AO")}</span>
            <span className="ae-admin-kpi-card__hint">{it.hint} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<StatsFull | StatsSupport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customDateMsg, setCustomDateMsg] = useState<string | null>(null);
  const [period, setPeriod] = useState<"day" | "month" | "year" | "custom">("month");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const loadStats = useCallback(() => {
    if (!token) return;
    if (period === "custom" && (!start || !end)) {
      setCustomDateMsg("Selecione data inicial e final para o período personalizado.");
      setStats(null);
      setLoading(false);
      return;
    }
    setCustomDateMsg(null);
    setLoading(true);
    setErr(null);
    const params = new URLSearchParams({ period });
    if (period === "custom" && start && end) {
      params.set("start", `${start}T00:00:00.000Z`);
      params.set("end", `${end}T23:59:59.999Z`);
    }
    void apiFetch<StatsFull | StatsSupport>(`/admin/stats?${params.toString()}`, { token })
      .then(setStats)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Erro ao carregar indicadores."))
      .finally(() => setLoading(false));
  }, [token, period, start, end]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const fullAdmin = isPlatformAdmin(user?.role);
  const pct = (curr: number, prev: number) => (prev <= 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100);

  if (loading && !stats) {
    return <AdminDashboardSkeleton />;
  }

  if (err && !stats) {
    return (
      <div className="ae-admin-canvas">
        <AdminErrorBanner message={err} onRetry={loadStats} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="ae-admin-canvas">
        <AdminErrorBanner
          message="Sem dados para exibir. Ajuste o período ou tente novamente."
          onRetry={loadStats}
        />
      </div>
    );
  }

  const exportCsv = () => {
    if (!isStatsFull(stats)) return;
    const rows = [
      ["Metrica", "Atual", "Anterior"],
      ["Pedidos", String(stats.periodOrders), String(stats.previousPeriodOrders)],
      ["Faturacao", stats.periodRevenueTotal, stats.previousPeriodRevenueTotal],
      ["Pedidos devolvidos", String(stats.periodRefundedOrders), String(stats.previousPeriodRefundedOrders)],
      ["Valor devolvido", stats.periodRefundsTotal, stats.previousPeriodRefundsTotal],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-dashboard-${stats.period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodToolbar = (
    <section className="ae-panel" style={{ marginBottom: 14 }}>
      <div className="ae-admin-toolbar">
        <strong style={{ marginRight: 8 }}>Período:</strong>
        <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
          <option value="day">Hoje</option>
          <option value="month">Mês actual</option>
          <option value="year">Ano actual</option>
          <option value="custom">Personalizado</option>
        </select>
        {period === "custom" ? (
          <>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Data inicial" />
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Data final" />
          </>
        ) : null}
        {customDateMsg ? (
          <span style={{ color: "crimson", fontSize: 12, fontWeight: 600 }}>{customDateMsg}</span>
        ) : null}
        {fullAdmin && isStatsFull(stats) ? (
          <button type="button" className="btn btn-ghost" onClick={exportCsv}>
            Exportar CSV
          </button>
        ) : null}
        <button type="button" className="btn" onClick={() => void loadStats()} disabled={loading}>
          {loading ? "A actualizar…" : "Actualizar"}
        </button>
      </div>
    </section>
  );


  if (!isStatsFull(stats)) {
    return (
      <div className="ae-admin-canvas">
        {err ? <AdminErrorBanner message={err} onRetry={loadStats} /> : null}
        <div className="ae-v-head">
          <h1 className="ae-v-title">Painel operacional</h1>
        </div>
        <p className="ae-muted" style={{ marginTop: 0 }}>
          Indicadores operacionais e filas de trabalho (perfil suporte / moderação). Sem totais financeiros agregados.
        </p>
        {periodToolbar}
        <KpiQueues stats={stats} />
        <div className="ae-v-metrics">
          <div className="ae-v-metric">
            <div className="ae-v-metric__l">Pedidos no período</div>
            <div className="ae-v-metric__v">{stats.periodOrders}</div>
          </div>
          <div className="ae-v-metric">
            <div className="ae-v-metric__l">Total de encomendas</div>
            <div className="ae-v-metric__v">{stats.totalOrders}</div>
          </div>
          <div className="ae-v-metric">
            <div className="ae-v-metric__l">Utilizadores</div>
            <div className="ae-v-metric__v">{stats.totalUsers}</div>
          </div>
          <div className="ae-v-metric">
            <div className="ae-v-metric__l">Parceiros activos</div>
            <div className="ae-v-metric__v">{stats.activeVendors}</div>
          </div>
          <div className="ae-v-metric">
            <div className="ae-v-metric__l">Lojas aprovadas</div>
            <div className="ae-v-metric__v">{stats.approvedShops}</div>
          </div>
          <div className="ae-v-metric">
            <div className="ae-v-metric__l">Produtos activos</div>
            <div className="ae-v-metric__v">{stats.activeProducts}</div>
          </div>
        </div>
        <section className="ae-panel" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Pedidos vs período anterior</h3>
          <p className="ae-muted" style={{ marginTop: 0 }}>
            {stats.periodOrders} vs {stats.previousPeriodOrders} (
            {pct(stats.periodOrders, stats.previousPeriodOrders).toFixed(1)}%)
          </p>
        </section>
        <section className="ae-table-wrap" style={{ marginTop: 12 }}>
          <table className="ae-data-table">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {stats.trend.map((t) => (
                <tr key={t.day}>
                  <td>{t.day}</td>
                  <td>{t.orders}</td>
                </tr>
              ))}
              {stats.trend.length === 0 ? (
                <tr>
                  <td colSpan={2} className="ae-empty-center">
                    Sem dados para o período seleccionado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="ae-panel" style={{ marginTop: 24 }}>
          <h3 style={{ marginTop: 0 }}>Atalhos operacionais</h3>
          <p style={{ margin: 0, lineHeight: 1.85, fontSize: 14 }}>
            <Link to="/admin/products?status=PENDING">Moderação de produtos</Link>
            {" · "}
            <Link to="/admin/sellers?tab=pending">Aprovar lojas</Link>
            {" · "}
            <Link to="/admin/credibility">Credibilidade (BI)</Link>
            {" · "}
            <Link to="/admin/disputes">Disputas</Link>
            {" · "}
            <Link to="/admin/trust">Denúncias e reputação</Link>
            {" · "}
            <Link to="/admin/orders">Todas as encomendas</Link>
          </p>
        </section>
      </div>
    );
  }

  const feePct = (stats.platformCommissionBps / 100).toFixed(2);

  return (
    <div className="ae-admin-canvas">
      {err ? <AdminErrorBanner message={err} onRetry={loadStats} /> : null}
      <div className="ae-v-head">
        <h1 className="ae-v-title">Painel geral</h1>
      </div>
      <p className="ae-muted" style={{ marginTop: 0 }}>
        Visão executiva: filas críticas, vendas, escrow e moderação. Os acessos ao back-office ficam registados na
        auditoria do servidor.
      </p>
      {periodToolbar}
      <KpiQueues stats={stats} />

      <h2 className="ae-admin-section-title" style={{ marginTop: 8 }}>
        Indicadores financeiros e volumes
      </h2>
      <div className="ae-v-metrics">
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Pedidos no período</div>
          <div className="ae-v-metric__v">{stats.periodOrders}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Faturação no período</div>
          <div className="ae-v-metric__v">{Number(stats.periodRevenueTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Comissões ({feePct}%)</div>
          <div className="ae-v-metric__v">
            {((Number(stats.periodRevenueTotal) * stats.platformCommissionBps) / 10000).toLocaleString("pt-AO")} Kz
          </div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Devoluções (pedidos)</div>
          <div className="ae-v-metric__v">{stats.periodRefundedOrders}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Valor devolvido (período)</div>
          <div className="ae-v-metric__v">{Number(stats.periodRefundsTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Volume total histórico</div>
          <div className="ae-v-metric__v">{Number(stats.revenueTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Encomendas hoje</div>
          <div className="ae-v-metric__v">{stats.ordersToday}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Lucro estimado ({feePct}%)</div>
          <div className="ae-v-metric__v">{Number(stats.platformProfitEstimate).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Parceiros activos</div>
          <div className="ae-v-metric__v">{stats.activeVendors}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Total encomendas</div>
          <div className="ae-v-metric__v">{stats.totalOrders}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Lojas aprovadas</div>
          <div className="ae-v-metric__v">{stats.approvedShops}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Produtos activos</div>
          <div className="ae-v-metric__v">{stats.activeProducts}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Escrow retido</div>
          <div className="ae-v-metric__v">{Number(stats.escrowHeldTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Escrow libertado</div>
          <div className="ae-v-metric__v">{Number(stats.escrowReleasedTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
      </div>

      <section className="ae-panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Comparação com período anterior</h3>
        <p className="ae-muted" style={{ marginTop: 0 }}>
          Pedidos: {stats.periodOrders} vs {stats.previousPeriodOrders} (
          {pct(stats.periodOrders, stats.previousPeriodOrders).toFixed(1)}%) · Faturação:{" "}
          {Number(stats.periodRevenueTotal).toLocaleString("pt-AO")} Kz vs{" "}
          {Number(stats.previousPeriodRevenueTotal).toLocaleString("pt-AO")} Kz (
          {pct(Number(stats.periodRevenueTotal), Number(stats.previousPeriodRevenueTotal)).toFixed(1)}%)
        </p>
      </section>
      <section className="ae-table-wrap" style={{ marginTop: 12 }}>
        <table className="ae-data-table">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Pedidos</th>
              <th>Faturação</th>
              <th>Devoluções</th>
            </tr>
          </thead>
          <tbody>
            {stats.trend.map((t) => (
              <tr key={t.day}>
                <td>{t.day}</td>
                <td>{t.orders}</td>
                <td>{Number(t.revenueTotal).toLocaleString("pt-AO")} Kz</td>
                <td>{Number(t.refundsTotal).toLocaleString("pt-AO")} Kz</td>
              </tr>
            ))}
            {stats.trend.length === 0 ? (
              <tr>
                <td colSpan={4} className="ae-empty-center">
                  Sem tendência diária para o período.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="ae-panel" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Atalhos rápidos</h3>
        <p style={{ margin: 0, lineHeight: 1.85, fontSize: 14 }}>
          {fullAdmin ? (
            <>
              <Link to="/admin/categories">Categorias</Link>
              {" · "}
            </>
          ) : null}
          <Link to="/admin/products">Modera.catálogo</Link>
          {" · "}
          <Link to="/admin/sellers">Lojas</Link>
          {fullAdmin ? (
            <>
              {" · "}
              <Link to="/admin/logistics-partners">Transportadoras</Link>
              {" · "}
              <Link to="/admin/freight">Fretes</Link>
              {" · "}
              <Link to="/admin/team">Equipa</Link>
              {" · "}
              <Link to="/admin/finance">Financeiro</Link>
            </>
          ) : null}
          {" · "}
          <Link to="/admin/orders">Encomendas</Link>
          {fullAdmin ? (
            <>
              {" · "}
              <Link to="/admin/content">Conteúdo do site</Link>
            </>
          ) : null}
        </p>
      </section>
    </div>
  );
}
