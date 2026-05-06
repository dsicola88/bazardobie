import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type Stats = {
  period: "day" | "month" | "year" | "custom";
  rangeStart: string;
  rangeEnd: string;
  totalOrders: number;
  ordersToday: number;
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
  openDisputes: number;
  openReports: number;
};

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [customDateMsg, setCustomDateMsg] = useState<string | null>(null);
  const [period, setPeriod] = useState<"day" | "month" | "year" | "custom">("month");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    if (!token) return;
    if (period === "custom" && (!start || !end)) {
      setCustomDateMsg("Selecione data inicial e final para o período personalizado.");
      return;
    }
    setCustomDateMsg(null);
    setErr(null);
    const params = new URLSearchParams({ period });
    if (period === "custom" && start && end) {
      params.set("start", `${start}T00:00:00.000Z`);
      params.set("end", `${end}T23:59:59.999Z`);
    }
    void apiFetch<Stats>(`/admin/stats?${params.toString()}`, { token })
      .then(setStats)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [token, period, start, end]);

  if (err) return <p style={{ color: "crimson" }}>{err}</p>;
  if (!stats) return <p>A carregar indicadores…</p>;

  const feePct = (stats.platformCommissionBps / 100).toFixed(2);
  const pct = (curr: number, prev: number) => (prev <= 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100);
  const exportCsv = () => {
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

  return (
    <div>
      <div className="ae-v-head">
        <h1 className="ae-v-title">Painel geral</h1>
      </div>
      <p className="ae-muted" style={{ marginTop: 0 }}>
        Visão agregada: vendas, parceiros activos, escrow e filas de moderação. O acesso a estas rotas fica registado nos logs de auditoria do servidor (JWT com perfil admin obrigatório).
      </p>
      <section className="ae-panel" style={{ marginBottom: 14 }}>
        <div className="ae-admin-toolbar">
          <strong style={{ marginRight: 8 }}>Filtro do painel:</strong>
          <select value={period} onChange={(e) => setPeriod(e.target.value as "day" | "month" | "year" | "custom")}>
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
          {customDateMsg ? (
            <span style={{ color: "crimson", fontSize: 12, fontWeight: 600 }}>{customDateMsg}</span>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={exportCsv}>
            Exportar CSV
          </button>
        </div>
      </section>
      <div className="ae-v-metrics">
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Pedidos no período filtrado</div>
          <div className="ae-v-metric__v">{stats.periodOrders}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Faturação no período</div>
          <div className="ae-v-metric__v">{Number(stats.periodRevenueTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Comissões no período ({feePct}%)</div>
          <div className="ae-v-metric__v">
            {((Number(stats.periodRevenueTotal) * stats.platformCommissionBps) / 10000).toLocaleString("pt-AO")} Kz
          </div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Pedidos com devolução no período</div>
          <div className="ae-v-metric__v">{stats.periodRefundedOrders}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Valor devolvido no período</div>
          <div className="ae-v-metric__v">{Number(stats.periodRefundsTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Volume total (encomendas não canceladas)</div>
          <div className="ae-v-metric__v">{Number(stats.revenueTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Encomendas hoje</div>
          <div className="ae-v-metric__v">{stats.ordersToday}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Lucro estimado da plataforma ({feePct}%)</div>
          <div className="ae-v-metric__v">{Number(stats.platformProfitEstimate).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Parceiros activos (loja aprovada, não bloqueados)</div>
          <div className="ae-v-metric__v">{stats.activeVendors}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Total de encomendas</div>
          <div className="ae-v-metric__v">{stats.totalOrders}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Lojas aprovadas</div>
          <div className="ae-v-metric__v">{stats.approvedShops}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Produtos activos (aprovados)</div>
          <div className="ae-v-metric__v">{stats.activeProducts}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Dinheiro em escrow (retido / aguarda confirmação)</div>
          <div className="ae-v-metric__v">{Number(stats.escrowHeldTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Já libertado aos parceiros (escrow)</div>
          <div className="ae-v-metric__v">{Number(stats.escrowReleasedTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Disputas abertas</div>
          <div className="ae-v-metric__v">{stats.openDisputes}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Relatórios abertos</div>
          <div className="ae-v-metric__v">{stats.openReports}</div>
        </div>
      </div>
      <section className="ae-panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Comparação com período anterior</h3>
        <p className="ae-muted" style={{ marginTop: 0 }}>
          Pedidos: {stats.periodOrders} vs {stats.previousPeriodOrders} (
          {pct(stats.periodOrders, stats.previousPeriodOrders).toFixed(1)}%){" · "}Faturação:{" "}
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
      <div className="ae-panel" style={{ marginTop: 20 }}>
        <strong style={{ display: "block", marginBottom: 10 }}>Áreas frequentes</strong>
        <p style={{ margin: 0, lineHeight: 1.8 }}>
          <Link to="/admin/categories">Categorias</Link>
          {" · "}
          <Link to="/admin/products">Produtos</Link>
          {" · "}
          <Link to="/admin/sellers">Lojas</Link>
          {" · "}
          <Link to="/admin/logistics-partners">Transportadoras</Link>
          {" · "}
          <Link to="/admin/team">Equipa LOGISTICA</Link>
          {" · "}
          <Link to="/admin/orders">Encomendas</Link>
          {" · "}
          <Link to="/admin/disputes">Disputas</Link>
          {" · "}
          <Link to="/admin/trust">Confiança</Link>
        </p>
      </div>
    </div>
  );
}
