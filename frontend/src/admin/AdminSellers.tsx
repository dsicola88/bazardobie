import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type Shop = {
  id: string;
  name: string;
  province: string;
  city: string;
  isApproved: boolean;
  userId: string;
  user?: { name: string; email: string };
};

type RankRow = {
  shopId: string;
  revenue: string;
  orderCount: number;
  shop: {
    id: string;
    name: string;
    isApproved: boolean;
    user: { id: string; name: string; email: string; blocked: boolean };
  } | null;
};

export default function AdminSellers() {
  const { token } = useAuth();
  const [pending, setPending] = useState<Shop[] | null>(null);
  const [ranking, setRanking] = useState<RankRow[] | null>(null);
  const [tab, setTab] = useState<"pending" | "ranking">("pending");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [p, r] = await Promise.all([
        apiFetch<Shop[]>("/admin/shops/pending", { token }),
        apiFetch<RankRow[]>("/admin/shops/ranking?limit=40", { token }),
      ]);
      setPending(p);
      setRanking(r);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approveShop(id: string, isApproved: boolean) {
    if (!token) return;
    setMsg(null);
    try {
      await apiFetch(`/admin/shops/${id}/approve`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ isApproved }),
      });
      setMsg(isApproved ? "Loja aprovada." : "Loja rejeitada / desactivada na aprovação.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Lojas parceiras</h1>
          <p className="ae-admin-pro__sub">
            Aprove novas vendas só depois dos dados obrigatórios estarem completos e críveis — isso aparece também na página
            «Quero ser vendedor». Utilizadores, motoristas LOGISTICA e transportadoras ficam sob{" "}
            <strong><Link to="/admin/team">Equipa &amp; logística</Link></strong>.
          </p>
        </div>
      </header>
      {err && <p className="ae-admin-alert ae-admin-alert--err">{err}</p>}
      {msg && <p className="ae-admin-alert ae-admin-alert--ok">{msg}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["pending", "ranking"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "btn btn-primary" : "btn"}
            onClick={() => setTab(t)}
          >
            {t === "pending" ? "Aprovar lojas" : "Ranking de vendas"}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <div className="ae-panel">
          <h2 style={{ marginTop: 0 }}>Lojas pendentes de aprovação</h2>
          {!pending?.length ? (
            <p className="ae-muted">Nenhuma fila pendente.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {pending.map((s) => (
                <li key={s.id} style={{ borderBottom: "1px solid var(--ae-line)", padding: "12px 0" }}>
                  <strong>{s.name}</strong> — {s.city}, {s.province}
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button type="button" className="btn btn-primary" onClick={() => void approveShop(s.id, true)}>
                      Aprovar loja
                    </button>
                    <button type="button" className="btn" onClick={() => void approveShop(s.id, false)}>
                      Recusar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "ranking" && (
        <div className="ae-panel">
          <h2 style={{ marginTop: 0 }}>Ranking por volume vendido</h2>
          <table className="ae-data-table">
            <thead>
              <tr>
                <th>Loja</th>
                <th>Encomendas (únicas)</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {ranking?.map((row) => (
                <tr key={row.shopId}>
                  <td>{row.shop?.name ?? row.shopId}</td>
                  <td>{row.orderCount}</td>
                  <td>{Number(row.revenue).toLocaleString("pt-AO")} Kz</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
