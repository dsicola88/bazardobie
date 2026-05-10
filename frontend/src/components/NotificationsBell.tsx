import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type NotificationRow = { id: string; read: boolean };

export function NotificationsBell() {
  const { token, user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!token || !user) {
      setUnread(0);
      return;
    }
    let stop = false;
    const load = async () => {
      try {
        const list = await apiFetch<NotificationRow[]>("/notifications?unreadOnly=true", { token });
        if (!stop) setUnread(list.length);
      } catch {
        if (!stop) setUnread(0);
      }
    };
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [token, user]);

  if (!token || !user) return null;

  return (
    <Link to="/notifications" className="ae-ico-link" aria-label="Notificações" title="Notificações">
      <span className="ae-ico ae-ico--glyph" aria-hidden>N</span>
      <span className="ae-ico-link__lbl">Notificações</span>
      {unread > 0 ? <span className="ae-cart-badge">{unread > 99 ? "99+" : unread}</span> : null}
    </Link>
  );
}
