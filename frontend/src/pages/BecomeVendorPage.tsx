import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth, type AuthUser } from "../auth/AuthContext.js";

export default function BecomeVendorPage() {
  const { user, token, setAuth } = useAuth();
  const nav = useNavigate();
  const [accept, setAccept] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function activate() {
    if (!token) return;
    setErr(null);
    setLoading(true);
    try {
      const out = await apiFetch<{ token: string; user: AuthUser }>("/auth/become-vendor", {
        method: "POST",
        token,
        body: JSON.stringify({ acceptTerms: true }),
      });
      setAuth(out.token, out.user);
      nav("/vendor/loja", { replace: true });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível activar o perfil de parceiro.");
    } finally {
      setLoading(false);
    }
  }

  if (user?.role === "ADMIN" || user?.role === "SUPORTE") {
    return (
      <div style={{ maxWidth: 560 }}>
        <div className="ae-panel">
          <h1>Área comercial</h1>
          <p className="ae-muted">Contas de back-office não usam este fluxo. Aceda ao painel de suporte ou administração.</p>
          <Link to="/admin/dashboard" className="btn btn-primary">
            Painel back-office
          </Link>
        </div>
      </div>
    );
  }

  if (user?.role === "VENDEDOR") {
    return (
      <div style={{ maxWidth: 560 }}>
        <div className="ae-panel">
          <h1>Já tem perfil de parceiro</h1>
          <p className="ae-muted">
            Continue na área comercial ou complete os dados institucionais da loja, se ainda não o fez.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <Link to="/vendor" className="btn btn-primary">
              Painel comercial
            </Link>
            <Link to="/vendor/loja" className="btn">
              Registo da loja
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ae-vend-onboard">
      <header className="ae-vend-onboard__head">
        <h1 className="ae-vend-onboard__title">Programa de parceiros — BAZAR DO BIÉ</h1>
        <p className="ae-vend-onboard__lead">
          O registo na plataforma é sempre como <strong>comprador</strong>. Aqui activa a possibilidade de abrir a sua
          loja parceira — processo semelhante aos grandes marketplaces: poucos passos iniciais e validação pela equipa
          antes de vender ao público.
        </p>
      </header>

      <ol className="ae-vend-onboard__steps">
        <li className="ae-vend-onboard__step ae-vend-onboard__step--done">
          <span className="ae-vend-onboard__n">1</span>
          <div>
            <strong>Conta de comprador</strong>
            <p>Com e-mail, telefone e palavra-passe — único tipo de registo público.</p>
          </div>
        </li>
        <li className="ae-vend-onboard__step">
          <span className="ae-vend-onboard__n">2</span>
          <div>
            <strong>Activar perfil de parceiro</strong>
            <p>Um clique abaixo (com aceitação dos termos). Obtém acesso ao painel comercial.</p>
          </div>
        </li>
        <li className="ae-vend-onboard__step">
          <span className="ae-vend-onboard__n">3</span>
          <div>
            <strong>Dados da loja + aprovação</strong>
            <p>Preenche o nível 1 da loja. Só depois da nossa aprovação os produtos ficam visíveis na loja pública.</p>
          </div>
        </li>
      </ol>

      {!user ? (
        <div className="ae-panel ae-vend-onboard__cta">
          <p style={{ margin: "0 0 14px" }}>
            Para continuar, inicie sessão ou crie uma conta de comprador (grátis).
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/login?next=/quero-vender" className="btn btn-primary">
              Iniciar sessão
            </Link>
            <Link to="/login?register=1&next=/quero-vender" className="btn">
              Criar conta
            </Link>
          </div>
        </div>
      ) : (
        <div className="ae-panel ae-vend-onboard__cta">
          <label className="ae-check ae-check--block">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            <span>
              Declaro que li e aceito operar em conformidade com as regras da plataforma (catálogo correcto, cumprimento
              de encomendas e dados de contacto actualizados). A equipa pode recusar ou encerrar lojas que não cumpram.
            </span>
          </label>
          {err ? (
            <p className="ae-admin-alert ae-admin-alert--err" style={{ marginTop: 12 }} role="alert">
              {err}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            disabled={!accept || loading}
            onClick={() => void activate()}
          >
            {loading ? "A activar…" : "Activar perfil de parceiro"}
          </button>
          <p className="ae-muted" style={{ fontSize: 12, marginTop: 12 }}>
            O telefone da sua conta tem de estar preenchido (mín. 6 caracteres). Pode actualizá-lo no perfil se precisar.
          </p>
        </div>
      )}
    </div>
  );
}
