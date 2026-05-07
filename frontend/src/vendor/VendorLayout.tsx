import { useState } from "react";
import { Link, NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { useSiteContent } from "../site/SiteContentContext.js";

export default function VendorLayout() {
  const { user, loading } = useAuth();
  const { content } = useSiteContent();
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const helpChannel = (content["public.vendor_help_channel_url"] ?? "").trim();
  const helpChannelSafe = /^https?:\/\//i.test(helpChannel) ? helpChannel : "";

  if (loading) {
    return (
      <div className="ae-vendor-shell">
        <p className="ae-v-main" style={{ padding: 24 }}>
          A preparar o painel…
        </p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login?next=/vendor" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin/dashboard" replace />;
  if (user.role !== "VENDEDOR") return <Navigate to="/unauthorized" replace />;

  return (
    <div className={`ae-vendor-shell ${sideCollapsed ? "ae-vendor-shell--collapsed" : ""}`}>
      <aside className="ae-vendor-side">
        <div className="ae-v-logo">
          BAZAR DO BIÉ · Parceiros
          <small>Catálogo, encomendas e expedição</small>
        </div>
        <nav className="ae-v-nav">
          <NavLink to="/vendor" end className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Resumo
          </NavLink>
          <NavLink to="/vendor/loja" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Dados da loja
          </NavLink>
          <NavLink to="/vendor/credibility" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Credibilidade
          </NavLink>
          <NavLink to="/vendor/products/new" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Nova referência
          </NavLink>
          <NavLink to="/vendor/products" end className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Catálogo de produtos
          </NavLink>
          <NavLink to="/vendor/orders" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Encomendas
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Notificações
          </NavLink>
          {helpChannelSafe ? (
            <a href={helpChannelSafe} target="_blank" rel="noreferrer noopener">
              Aprender a usar a app
            </a>
          ) : null}
          <Link to="/">Loja pública</Link>
        </nav>
      </aside>
      <main className="ae-v-main">
        <div className="ae-v-main__topbar">
          <button type="button" className="ae-v-main__toggle" onClick={() => setSideCollapsed((v) => !v)}>
            {sideCollapsed ? "Expandir menu" : "Encolher menu"}
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
