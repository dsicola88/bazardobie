import { Link, NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

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
          <small>Controlo total · BAZAR DO BIÉ</small>
        </div>
        <nav className="ae-v-nav">
          <NavLink to="/admin/dashboard" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Painel geral
          </NavLink>
          <NavLink to="/admin/sellers" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Lojas parceiras
          </NavLink>
          <NavLink to="/admin/logistics-partners" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Transportadoras
          </NavLink>
          <NavLink to="/admin/products" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Produtos e moderação
          </NavLink>
          <NavLink to="/admin/orders" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Encomendas
          </NavLink>
          <NavLink to="/admin/finance" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Financeiro (escrow)
          </NavLink>
          <NavLink to="/admin/trust" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Confiança e relatórios
          </NavLink>
          <NavLink to="/admin/disputes" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Disputas (escrow)
          </NavLink>
          <NavLink to="/admin/content" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Conteúdo do site
          </NavLink>
          <NavLink to="/admin/banners" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Carrossel
          </NavLink>
          <Link to="/">← Voltar à loja</Link>
        </nav>
      </aside>
      <main className="ae-v-main">
        <Outlet />
      </main>
    </div>
  );
}
