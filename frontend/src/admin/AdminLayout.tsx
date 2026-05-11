import { type ReactNode, useState } from "react";
import { Link, NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import { isBackOfficeStaff, isPlatformAdmin } from "./adminAccess.js";

function NavSep({ children }: { children: ReactNode }) {
  return <div className="ae-v-nav__label">{children}</div>;
}

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const { content } = useSiteContent();
  /** Telefóvel: menu lateral começa recolhido para o conteúdo útil aparecer primeiro. */
  const [sideCollapsed, setSideCollapsed] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)").matches : false,
  );
  const helpChannel = (content["public.vendor_help_channel_url"] ?? "").trim();
  const helpChannelSafe = !helpChannel
    ? ""
    : /^https?:\/\//i.test(helpChannel)
      ? helpChannel
      : `https://${helpChannel}`;
  const helpChannelHref = helpChannelSafe || "https://www.youtube.com/";
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
  if (!isBackOfficeStaff(user.role)) return <Navigate to="/unauthorized" replace />;

  const fullAdmin = isPlatformAdmin(user.role);

  return (
    <div className={`ae-vendor-shell ae-admin-shell ${sideCollapsed ? "ae-vendor-shell--collapsed" : ""}`}>
      <aside className="ae-vendor-side">
        <div className="ae-v-logo">
          {fullAdmin ? "Administração" : "Suporte"}
          <small>
            {fullAdmin ? "Painel corporativo" : "Moderação e operação"} · BAZAR DO BIÉ
          </small>
        </div>
        <nav className="ae-v-nav ae-v-nav--grouped">
          <NavLink end to="/admin/dashboard" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Painel geral
          </NavLink>

          <NavSep>Catálogo</NavSep>
          {fullAdmin ? (
            <NavLink end to="/admin/categories" className={({ isActive }) => (isActive ? "ae-on" : "")}>
              Categorias
            </NavLink>
          ) : null}
          {fullAdmin ? (
            <NavLink to="/admin/categories/catalog" className={({ isActive }) => (isActive ? "ae-on" : "")}>
              Ficha técnica
            </NavLink>
          ) : null}
          <NavLink to="/admin/products" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Produtos e moderação
          </NavLink>

          <NavSep>Destaques públicos</NavSep>
          {fullAdmin ? (
            <NavLink to="/admin/banners" className={({ isActive }) => (isActive ? "ae-on" : "")}>
              Carrossel inicial
            </NavLink>
          ) : null}
          <NavLink to="/admin/homepage-groups" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Grupos e vitrines
          </NavLink>
          <NavLink to="/admin/home-spotlights" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Vitrines imagem + link
          </NavLink>

          <NavSep>Parceiros e operação</NavSep>
          <NavLink to="/admin/sellers" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Lojas parceiras
          </NavLink>
          {fullAdmin ? (
            <>
              <NavLink to="/admin/logistics-partners" className={({ isActive }) => (isActive ? "ae-on" : "")}>
                Transportadoras
              </NavLink>
              <NavLink to="/admin/freight" className={({ isActive }) => (isActive ? "ae-on" : "")}>
                Fretes (zonas e km)
              </NavLink>
              <NavLink to="/admin/team" className={({ isActive }) => (isActive ? "ae-on" : "")}>
                Equipa, suporte e logística
              </NavLink>
            </>
          ) : null}

          <NavSep>Encomendas</NavSep>
          <NavLink to="/admin/orders" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Todas as encomendas
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Notificações
          </NavLink>

          <NavSep>Financeiro e escrow</NavSep>
          {fullAdmin ? (
            <NavLink to="/admin/finance" className={({ isActive }) => (isActive ? "ae-on" : "")}>
              Financeiro
            </NavLink>
          ) : null}
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
          {fullAdmin ? (
            <NavLink to="/admin/content" className={({ isActive }) => (isActive ? "ae-on" : "")}>
              Configurações
            </NavLink>
          ) : null}
          <NavLink to="/admin/partner-terms" className={({ isActive }) => (isActive ? "ae-on" : "")}>
            Termos do parceiro
          </NavLink>
          <a href={helpChannelHref} target="_blank" rel="noreferrer noopener">
            Canal de ajuda (vídeos)
          </a>

          <div className="ae-v-nav__foot">
            <Link to="/">← Voltar ao site público</Link>
          </div>
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
            <span className="ae-v-main__user-name" title={user.name}>
              {user.name}
            </span>
            <span
              className={`ae-v-main__role${user.role === "SUPORTE" ? " ae-v-main__role--support" : ""}`}
              title="Perfil na plataforma"
            >
              {user.role === "SUPORTE" ? "Suporte" : user.role === "ADMIN" ? "Administrador" : user.role}
            </span>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
