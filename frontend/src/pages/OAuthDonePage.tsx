import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, cartSessionHeaders, ensureCartSession } from "../api.js";
import { useAuth, type AuthUser } from "../auth/AuthContext.js";

export default function OAuthDonePage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    if (!code) {
      setErr("Resposta OAuth incompleta.");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const out = await apiFetch<{ token: string; user: AuthUser }>(
          `/auth/oauth/exchange?code=${encodeURIComponent(code)}`
        );
        if (cancelled) return;
        setAuth(out.token, out.user);
        await tryMergeCart(out.token);
        const role = out.user.role;
        if (role === "ADMIN" || role === "SUPORTE") nav("/admin/dashboard", { replace: true });
        else if (role === "VENDEDOR") nav("/vendor", { replace: true });
        else if (role === "LOGISTICA") nav("/logistica", { replace: true });
        else nav("/", { replace: true });
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Não foi possível finalizar o login.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, nav, setAuth]);

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
      /* ignorar */
    }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <div className="ae-panel">
        <h1 style={{ marginTop: 0 }}>A concluir sessão…</h1>
        {err ? (
          <>
            <p style={{ color: "crimson" }}>{err}</p>
            <Link to="/login">Voltar ao login</Link>
          </>
        ) : (
          <p className="ae-muted">Um momento.</p>
        )}
      </div>
    </div>
  );
}
