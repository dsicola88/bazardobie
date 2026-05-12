import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { presentNotificationRow, type NotificationVisualVariant } from "../utils/orderNotificationDisplay.js";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  payload?: unknown;
};

type OrderStatusPayload = {
  kind: "ORDER_STATUS";
  fromLabel?: string;
  toLabel?: string;
  primaryHref?: string;
  actorLabel?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function notifArticleClass(read: boolean, variant: NotificationVisualVariant): string {
  const base = "ae-panel ae-notif-card";
  if (read) return `${base} ae-notif-card--read`;
  switch (variant) {
    case "positive":
      return `${base} ae-notif-card--tone-positive`;
    case "negative":
      return `${base} ae-notif-card--tone-negative`;
    case "progress":
      return `${base} ae-notif-card--tone-progress`;
    default:
      return `${base} ae-notif-card--tone-default`;
  }
}

function OrderStatusExtras({ payload }: { payload: unknown }) {
  if (!isRecord(payload) || payload.kind !== "ORDER_STATUS") return null;
  const p = payload as OrderStatusPayload;
  return (
    <div className="ae-notif-payload" style={{ marginTop: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span className="ae-notif-pill">{p.fromLabel ?? "—"}</span>
        <span className="ae-muted" aria-hidden>
          →
        </span>
        <span className="ae-notif-pill ae-notif-pill--accent">{p.toLabel ?? "—"}</span>
        {p.actorLabel ? (
          <span className="ae-muted" style={{ fontSize: 12 }}>
            · {p.actorLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TrackingExtras({ payload }: { payload: unknown }) {
  if (!isRecord(payload) || payload.kind !== "TRACKING") return null;
  const href = typeof payload.primaryHref === "string" ? payload.primaryHref : "";
  return href ? (
    <div style={{ marginTop: 10 }}>
      <Link to={href} className="ae-tracking__cta">
        Ver rastreio e detalhes da encomenda
      </Link>
    </div>
  ) : null;
}

function ChatExtras({ payload }: { payload: unknown }) {
  if (!isRecord(payload) || payload.kind !== "CHAT") return null;
  const href = typeof payload.primaryHref === "string" ? payload.primaryHref : "";
  return href ? (
    <div style={{ marginTop: 10 }}>
      <Link to={href} className="ae-tracking__cta">
        Abrir chat da encomenda
      </Link>
    </div>
  ) : null;
}

function OrderStatusPrimaryLink({ payload }: { payload: unknown }) {
  if (!isRecord(payload) || payload.kind !== "ORDER_STATUS") return null;
  const href = typeof payload.primaryHref === "string" ? payload.primaryHref : "";
  return href ? (
    <div style={{ marginTop: 10 }}>
      <Link to={href} className="ae-tracking__cta">
        Ver encomenda
      </Link>
    </div>
  ) : null;
}

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
      <div className="ae-v-head ae-buyer-notifications-head">
        <div>
          <h1 className="ae-v-title">Notificações</h1>
          <p className="ae-muted" style={{ margin: "4px 0 0" }}>
            Atualizações de encomendas, rastreio, chat e decisões operacionais.
          </p>
          <div className="ae-panel ae-notif-page-guide" style={{ marginTop: 12, padding: "12px 14px" }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
              <strong>Referência da encomenda ≠ código de rastreio.</strong> O identificador que acompanha as
              notificações de estado é o <strong>número do pedido na plataforma</strong> (referência interna). O{" "}
              <strong>código de rastreio da transportadora</strong> (guia, AWB, etc.) só aparece depois de registado,
              na página <Link to="/orders">As minhas encomendas</Link> → <strong>Seguir encomenda</strong>, na
              secção <strong>Rastreio da entrega</strong>. Pode{" "}
              <Link to="/orders">pesquisar pela referência na lista de encomendas</Link>
              {" "}(campo «Pesquisar»).
            </p>
          </div>
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
        {rows.map((n) => {
          const presented = presentNotificationRow({
            title: n.title,
            message: n.message,
            payload: n.payload,
          });
          return (
            <article key={n.id} className={notifArticleClass(n.read, presented.visualVariant)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <strong className="ae-notif-card__title">{presented.title}</strong>
                <span className="ae-muted" style={{ fontSize: 12, flexShrink: 0 }}>
                  {new Date(n.createdAt).toLocaleString("pt-AO")}
                </span>
              </div>
              {presented.orderRef ? (
                <div className="ae-notif-ref-row">
                  <span className="ae-muted">Referência</span>{" "}
                  <code className="ae-notif-ref-code">{presented.orderRef}</code>
                </div>
              ) : null}
              <p className="ae-notif-card__body">{presented.message}</p>
              <OrderStatusPrimaryLink payload={n.payload} />
              {presented.showOrderStatusExtras ? <OrderStatusExtras payload={n.payload} /> : null}
              <TrackingExtras payload={n.payload} />
              <ChatExtras payload={n.payload} />
              {!n.read ? (
                <button type="button" className="btn" style={{ marginTop: 10 }} onClick={() => void markRead(n.id)}>
                  Marcar como lida
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
