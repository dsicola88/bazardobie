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
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotDone, setForgotDone] = useState<string | null>(null);
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

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setForgotDone(null);
    setLoading(true);
    try {
      const out = await apiFetch<{ ok: boolean; devResetUrl?: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setForgotDone(
        out.devResetUrl
          ? `Link de recuperação (ambiente local): ${out.devResetUrl}`
          : "Se o e-mail existir, enviámos instruções de recuperação."
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar recuperação.");
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

  const showOAuth = !registerMode;

  return (
    <div style={{ maxWidth: 420 }}>
      <div className="ae-panel ae-login-panel">
        <h1 style={{ marginTop: 0 }}>{title}</h1>
        <p className="ae-login-trust" style={{ marginTop: 0, fontSize: 13 }}>
          <span aria-hidden>✓</span> As suas informações de sessão são transmitidas de forma segura (HTTPS em produção).
        </p>
        {roleHint}
        {!forgotMode ? (
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
        ) : (
          <form className="form-stack ae-form" onSubmit={onForgot}>
            <label htmlFor="forgot-email">E-mail da conta</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p style={{ color: "crimson", margin: "10px 0 0", fontSize: "13px" }}>{error}</p>}
            {forgotDone ? <p style={{ color: "#0d5c2e", margin: "10px 0 0", fontSize: "13px" }}>{forgotDone}</p> : null}
            <button className="btn btn-primary" disabled={loading} type="submit">
              {loading ? "A processar…" : "Enviar recuperação"}
            </button>
          </form>
        )}

        {!registerMode && !forgotMode ? (
          <p className="ae-muted" style={{ fontSize: 13 }}>
            Problemas ao aceder? Se criou a conta com Google ou Facebook, use o mesmo botão abaixo — não use palavra-passe.
          </p>
        ) : null}

        {showOAuth && !forgotMode ? (
          <>
            <div className="ae-oauth-divider">
              <span>Acesso rápido com</span>
            </div>
            <div className="ae-oauth-grid">
              {oauthProviders?.google ? (
                <a className="ae-oauth-btn ae-oauth-btn--google" href={apiOAuthAbsolute("/auth/oauth/google")}>
                  <span className="ae-oauth-icon" aria-hidden>G</span>
                  Google
                </a>
              ) : (
                <button
                  type="button"
                  className="ae-oauth-btn ae-oauth-btn--google"
                  disabled
                  title="Login Google ainda não configurado no servidor."
                >
                  <span className="ae-oauth-icon" aria-hidden>G</span>
                  Google (indisponível)
                </button>
              )}
              {oauthProviders?.facebook ? (
                <a className="ae-oauth-btn ae-oauth-btn--facebook" href={apiOAuthAbsolute("/auth/oauth/facebook")}>
                  <span className="ae-oauth-icon" aria-hidden>f</span>
                  Facebook
                </a>
              ) : (
                <button
                  type="button"
                  className="ae-oauth-btn ae-oauth-btn--facebook"
                  disabled
                  title="Login Facebook ainda não configurado no servidor."
                >
                  <span className="ae-oauth-icon" aria-hidden>f</span>
                  Facebook (indisponível)
                </button>
              )}
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
            {oauthProviders && !oauthProviders.google && !oauthProviders.facebook ? (
              <p className="ae-muted" style={{ fontSize: 12, marginTop: 10 }}>
                Google/Facebook ainda não estão configurados neste ambiente. O acesso por e-mail continua disponível.
              </p>
            ) : null}
          </>
        ) : null}

        <p style={{ marginBottom: 0 }}>
          {forgotMode ? (
            <button type="button" className="ae-linkbtn" onClick={() => setForgotMode(false)}>
              Voltar ao login
            </button>
          ) : registerMode ? (
            <Link to={loginLink}>Já tem conta? Iniciar sessão</Link>
          ) : (
            <>
              <Link to={registerLink}>Criar conta com e-mail</Link>
              {" · "}
              <button type="button" className="ae-linkbtn" onClick={() => setForgotMode(true)}>
                Esqueci a senha
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
