import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Token de recuperação em falta.");
      return;
    }
    if (password.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As palavras-passe não coincidem.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <div className="ae-panel ae-login-panel">
        <h1 style={{ marginTop: 0 }}>Redefinir senha</h1>
        {!done ? (
          <form className="form-stack ae-form" onSubmit={onSubmit}>
            <label htmlFor="new-password">Nova senha</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <label htmlFor="confirm-password">Confirmar senha</label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
            />
            {error ? <p style={{ color: "crimson", fontSize: 13 }}>{error}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "A processar…" : "Actualizar senha"}
            </button>
          </form>
        ) : (
          <p>
            Senha actualizada com sucesso. <Link to="/login">Iniciar sessão</Link>
          </p>
        )}
      </div>
    </div>
  );
}
