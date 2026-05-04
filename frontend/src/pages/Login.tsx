import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, apiOAuthAbsolute, cartSessionHeaders, ensureCartSession, fetchOAuthProviders } from "../api.js";
import { useAuth, type AuthUser } from "../auth/AuthContext.js";

export default function Login() {
  const [params] = useSearchParams();
  const registerMode = params.get("register") === "1";
  const { setAuth } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<{ google: boolean; facebook: boolean } | null>(null);

  const oauthErrParam = params.get("oauth_error");

  useEffect(() => {
    void fetchOAuthProviders()
      .then(setOauthProviders)
      .catch(() => setOauthProviders({ google: false, facebook: false }));
  }, []);

  useEffect(() => {
    if (oauthErrParam) setError(decodeURIComponent(oauthErrParam));
  }, [oauthErrParam]);

  const title = registerMode ? "Criar conta" : "Cadastre-se / Entrar";

  const nextParam = params.get("next");
  const registerLink = nextParam
    ? `/login?register=1&next=${encodeURIComponent(nextParam)}`
    : "/login?register=1";
  const loginLink = nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : "/login";

  const roleHint = useMemo(() => {
    if (!registerMode) return null;
    return (
      <p className="ae-muted" style={{ fontSize: "0.85rem" }}>
        Todo o registo público é como <strong>comprador</strong>. Para vender, consulte depois{" "}
        <Link to="/quero-vender">Programa de parceiros</Link> — sem passos adicionais neste formulário.
      </p>
    );
  }, [registerMode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let out: { token: string; user: AuthUser };
      if (registerMode) {
        out = await apiFetch<{ token: string; user: AuthUser }>("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, name, phone }),
        });
      } else {
        out = await apiFetch<{ token: string; user: AuthUser }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      }
      setAuth(out.token, out.user);
      await tryMergeCart(out.token);
      const next = params.get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        nav(next);
        return;
      }
      if (out.user.role === "ADMIN") nav("/admin/dashboard");
      else if (out.user.role === "VENDEDOR") nav("/vendor");
      else if (out.user.role === "LOGISTICA") nav("/logistica");
      else nav("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Operação não concluída. Verifique os dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function tryMergeCart(jwt: string) {
    const sessionId = localStorage.getItem("cart_session") ?? ensureCartSession();
    try {
      await apiFetch("/cart/merge", {
        method: "POST",
        token: jwt,
        headers: cartSessionHeaders(),
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      /* ignorar falha */
    }
  }

  const showOAuth = !registerMode && oauthProviders && (oauthProviders.google || oauthProviders.facebook);

  return (
    <div style={{ maxWidth: 420 }}>
      <div className="ae-panel ae-login-panel">
        <h1 style={{ marginTop: 0 }}>{title}</h1>
        <p className="ae-login-trust" style={{ marginTop: 0, fontSize: 13 }}>
          <span aria-hidden>✓</span> As suas informações de sessão são transmitidas de forma segura (HTTPS em produção).
        </p>
        {roleHint}
        <form className="form-stack ae-form" onSubmit={onSubmit}>
          {registerMode && (
            <>
              <label htmlFor="name">Nome</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
              <label htmlFor="phone">Telefone WhatsApp ou chamada (obrigatório)</label>
              <input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                minLength={6}
                autoComplete="tel"
              />
            </>
          )}
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Palavra-passe</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          {error && (
            <p style={{ color: "crimson", margin: "10px 0 0", fontSize: "13px" }}>{error}</p>
          )}
          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? "A processar…" : registerMode ? "Criar conta" : "Continuar"}
          </button>
        </form>

        {!registerMode ? (
          <p className="ae-muted" style={{ fontSize: 13 }}>
            Problemas ao aceder? Se criou a conta com Google ou Facebook, use o mesmo botão abaixo — não use palavra-passe.
          </p>
        ) : null}

        {showOAuth ? (
          <>
            <div className="ae-oauth-divider">
              <span>Acesso rápido com</span>
            </div>
            <div className="ae-oauth-grid">
              {oauthProviders.google ? (
                <a className="ae-oauth-btn ae-oauth-btn--google" href={apiOAuthAbsolute("/auth/oauth/google")}>
                  <span className="ae-oauth-icon" aria-hidden>G</span>
                  Google
                </a>
              ) : null}
              {oauthProviders.facebook ? (
                <a className="ae-oauth-btn ae-oauth-btn--facebook" href={apiOAuthAbsolute("/auth/oauth/facebook")}>
                  <span className="ae-oauth-icon" aria-hidden>f</span>
                  Facebook
                </a>
              ) : null}
              <button
                type="button"
                className="ae-oauth-btn ae-oauth-btn--passkey"
                disabled
                title="Passkey (WebAuthn) — previsto numa próxima versão."
              >
                <span className="ae-oauth-icon" aria-hidden>◇</span>
                Passkey
              </button>
            </div>
          </>
        ) : null}

        <p style={{ marginBottom: 0 }}>
          {registerMode ? (
            <Link to={loginLink}>Já tem conta? Iniciar sessão</Link>
          ) : (
            <Link to={registerLink}>Criar conta com e-mail</Link>
          )}
        </p>
      </div>
    </div>
  );
}
