import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type Stats = {
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
  openDisputes: number;
  openReports: number;
};

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void apiFetch<Stats>("/admin/stats", { token })
      .then(setStats)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [token]);

  if (err) return <p style={{ color: "crimson" }}>{err}</p>;
  if (!stats) return <p>A carregar indicadores…</p>;

  const feePct = (stats.platformCommissionBps / 100).toFixed(2);

  return (
    <div>
      <div className="ae-v-head">
        <h1 className="ae-v-title">Painel geral</h1>
      </div>
      <p className="ae-muted" style={{ marginTop: 0 }}>
        Visão agregada: vendas, parceiros activos, escrow e filas de moderação. O acesso a estas rotas fica registado nos logs de auditoria do servidor (JWT com perfil admin obrigatório).
      </p>
      <div className="ae-v-metrics">
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
