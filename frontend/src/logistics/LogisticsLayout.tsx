import { useState } from "react";
import { Link, NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export default function LogisticsLayout() {
  const { user, loading } = useAuth();
  const [sideCollapsed, setSideCollapsed] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)").matches : false,
  );

  if (loading) {
    return (
      <div className="ae-vendor-shell">
        <p className="ae-v-main" style={{ padding: 24 }}>
          A carregar…
        </p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login?next=/logistica" replace />;
  if (user.role === "ADMIN" || user.role === "SUPORTE") return <Navigate to="/admin/dashboard" replace />;
  if (user.role !== "LOGISTICA") return <Navigate to="/unauthorized" replace />;

  return (
    <div className={`ae-vendor-shell ae-admin-shell ${sideCollapsed ? "ae-vendor-shell--collapsed" : ""}`}>
      <aside className="ae-vendor-side">
        <div className="ae-v-logo">
          Logística BAZAR DO BIÉ
          <small>
            {user.logisticsPartner
              ? `${user.logisticsPartner.name} — só encomendas atribuídas a este parceiro`
              : "Equipa interna — todas as encomendas BAZAR DO BIÉ na fila"}
          </small>
        </div>
        <nav className="ae-v-nav">
          <NavLink to="/logistica" end className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Fila de pedidos
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Notificações
          </NavLink>
          <Link to="/">← Voltar à loja</Link>
        </nav>
      </aside>
      <main className="ae-v-main">
        <div className="ae-v-main__topbar">
          <div className="ae-v-main__topbar-left">
            <button type="button" className="ae-v-main__toggle" onClick={() => setSideCollapsed((v) => !v)}>
              {sideCollapsed ? "Expandir menu" : "Encolher menu"}
            </button>
          </div>
          <div className="ae-v-main__user">
            <span className="ae-v-main__user-name" title={user.email}>
              {user.name}
            </span>
            <span className="ae-v-main__role" title="Perfil na plataforma">
              Logística
            </span>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
