import { type ReactNode } from "react";
import { Link, NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

function NavSep({ children }: { children: ReactNode }) {
  return <div className="ae-v-nav__label">{children}</div>;
}

export default function AdminLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="ae-vendor-shell ae-admin-shell">
        <p className="ae-v-main" style={{ padding: 24 }}>
          A carregar…
        </p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login?next=/admin/dashboard" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/unauthorized" replace />;

  return (
    <div className="ae-vendor-shell ae-admin-shell">
      <aside className="ae-vendor-side">
        <div className="ae-v-logo">
          Administração
          <small>Painel corporativo · BAZAR DO BIÉ</small>
        </div>
        <nav className="ae-v-nav ae-v-nav--grouped">
          <NavLink end to="/admin/dashboard" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Painel geral
          </NavLink>

          <NavSep>Catálogo</NavSep>
          <NavLink to="/admin/categories" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Categorias
          </NavLink>
          <NavLink to="/admin/products" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Produtos e moderação
          </NavLink>

          <NavSep>Parceiros e operação</NavSep>
          <NavLink to="/admin/sellers" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Lojas parceiras
          </NavLink>
          <NavLink to="/admin/logistics-partners" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Transportadoras
          </NavLink>
          <NavLink to="/admin/freight" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Fretes (zonas e km)
          </NavLink>
          <NavLink to="/admin/team" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Equipa e logística
          </NavLink>

          <NavSep>Encomendas</NavSep>
          <NavLink to="/admin/orders" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Todas as encomendas
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Notificações
          </NavLink>

          <NavSep>Financeiro e escrow</NavSep>
          <NavLink to="/admin/finance" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Financeiro
          </NavLink>
          <NavLink to="/admin/disputes" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Disputas
          </NavLink>

          <NavSep>Segurança e confiança</NavSep>
          <NavLink to="/admin/trust" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Relatórios e reputação
          </NavLink>
          <NavLink to="/admin/credibility" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Filas BI / credibilidade
          </NavLink>

          <NavSep>Site público</NavSep>
          <NavLink to="/admin/content" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Textos da loja
          </NavLink>
          <NavLink to="/admin/banners" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Carrossel inicial
          </NavLink>

          <div className="ae-v-nav__foot">
            <Link to="/">← Voltar ao site público</Link>
          </div>
        </nav>
      </aside>
      <main className="ae-v-main">
        <Outlet />
      </main>
    </div>
  );
}
