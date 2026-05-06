import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const { token, user } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  async function load() {
    if (!token) return;
    setErr(null);
    setLoading(true);
    try {
      const q = unreadOnly ? "?unreadOnly=true" : "";
      const data = await apiFetch<NotificationRow[]>(`/notifications${q}`, { token });
      setRows(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível carregar notificações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, unreadOnly]);

  async function markRead(id: string) {
    if (!token) return;
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH", token });
      setRows((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      /* noop */
    }
  }

  if (!token || !user) {
    return (
      <div className="ae-panel" style={{ maxWidth: 520 }}>
        <p className="ae-muted">Inicie sessão para ver notificações.</p>
        <Link to="/login" className="btn btn-primary">Iniciar sessão</Link>
      </div>
    );
  }

  const unread = rows.filter((n) => !n.read).length;

  return (
    <div style={{ maxWidth: 840 }}>
      <div className="ae-v-head">
        <div>
          <h1 className="ae-v-title">Notificações</h1>
          <p className="ae-muted" style={{ margin: "4px 0 0" }}>
            Atualizações de encomendas, rastreio, chat e decisões operacionais.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className={unreadOnly ? "btn btn-primary" : "btn"} onClick={() => setUnreadOnly((v) => !v)}>
            {unreadOnly ? "Mostrar todas" : "Só não lidas"}
          </button>
          <button type="button" className="btn" onClick={() => void load()}>Atualizar</button>
        </div>
      </div>

      {err ? <p className="ae-admin-alert ae-admin-alert--err">{err}</p> : null}

      <p className="ae-muted" style={{ fontSize: 13 }}>Não lidas: <strong>{unread}</strong></p>

      {loading ? <p className="ae-muted">A carregar…</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="ae-panel ae-empty-center">Sem notificações neste filtro.</div>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((n) => (
          <article key={n.id} className="ae-panel" style={{ borderLeft: n.read ? "4px solid #d5d9e0" : "4px solid var(--ae-deep)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <strong>{n.title}</strong>
              <span className="ae-muted" style={{ fontSize: 12 }}>{new Date(n.createdAt).toLocaleString("pt-AO")}</span>
            </div>
            <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{n.message}</p>
            {!n.read ? (
              <button type="button" className="ae-tracking__cta" style={{ marginTop: 8 }} onClick={() => void markRead(n.id)}>
                Marcar como lida
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
