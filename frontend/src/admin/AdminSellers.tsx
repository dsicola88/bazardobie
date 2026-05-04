import { useCallback, useEffect, useState } from "react";
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

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  blocked: boolean;
  logisticsPartnerId?: string | null;
  logisticsPartner?: { id: string; name: string } | null;
};

type LPartnerOpt = { id: string; name: string; active: boolean };

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
  const [users, setUsers] = useState<{ items: UserRow[]; total: number } | null>(null);
  const [logisticsPartners, setLogisticsPartners] = useState<LPartnerOpt[] | null>(null);
  const [tab, setTab] = useState<"pending" | "ranking" | "users">("pending");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [p, r, u, lp] = await Promise.all([
        apiFetch<Shop[]>("/admin/shops/pending", { token }),
        apiFetch<RankRow[]>("/admin/shops/ranking?limit=40", { token }),
        apiFetch<{ items: UserRow[]; total: number }>("/admin/users?take=80", { token }),
        apiFetch<LPartnerOpt[]>("/admin/logistics-partners", { token }),
      ]);
      setPending(p);
      setRanking(r);
      setUsers(u);
      setLogisticsPartners(lp);
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

  async function patchRole(userId: string, role: "CLIENTE" | "VENDEDOR" | "LOGISTICA") {
    if (!token) return;
    setMsg(null);
    try {
      await apiFetch(`/admin/users/${userId}/role`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ role }),
      });
      setMsg("Perfil actualizado.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function setBlocked(userId: string, blocked: boolean) {
    if (!token) return;
    setMsg(null);
    try {
      await apiFetch(`/admin/users/${userId}/blocked`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ blocked }),
      });
      setMsg(blocked ? "Vendedor bloqueado — sessões futuras recusadas." : "Conta desbloqueada.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function patchUserLogisticsPartner(userId: string, logisticsPartnerId: string | null) {
    if (!token) return;
    setMsg(null);
    try {
      await apiFetch(`/admin/users/${userId}/logistics-partner`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ logisticsPartnerId }),
      });
      setMsg("Transportadora ligada ao utilizador.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div>
      <div className="ae-v-head">
        <h1 className="ae-v-title">Lojas parceiras</h1>
      </div>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {msg && <p style={{ color: "var(--ae-ok)" }}>{msg}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["pending", "ranking", "users"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "btn btn-primary" : "btn"}
            onClick={() => setTab(t)}
          >
            {t === "pending" ? "Aprovar lojas" : t === "ranking" ? "Ranking de vendas" : "Utilizadores / bloqueio"}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <div className="ae-panel">
          <h2>Lojas pendentes de aprovação</h2>
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
          <h2>Ranking por volume vendido</h2>
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

      {tab === "users" && (
        <div className="ae-panel">
          <h2>Utilizadores — perfil e bloqueio</h2>
          <p className="ae-muted">
            Atribua <strong>LOGISTICA</strong> à equipa de recolha. Com parceiro externo seleccionado, só vê encomendas
            BAZAR DO BIÉ atribuídas a esse parceiro em <strong>Encomendas</strong>; sem parceiro, vê todas (equipa
            interna). Registe empresas em <strong>Admin → Transportadoras</strong>.
            Contas bloqueadas deixam de aceder à API com JWT.
          </p>
          <table className="ae-data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Transportadora (LOGISTICA)</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users?.items.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    {u.role === "ADMIN" ? (
                      <span>ADMIN</span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) =>
                          void patchRole(
                            u.id,
                            e.target.value as "CLIENTE" | "VENDEDOR" | "LOGISTICA"
                          )
                        }
                        style={{ maxWidth: 140, font: "inherit", padding: "4px 6px" }}
                      >
                        <option value="CLIENTE">CLIENTE</option>
                        <option value="VENDEDOR">VENDEDOR</option>
                        <option value="LOGISTICA">LOGISTICA</option>
                      </select>
                    )}
                  </td>
                  <td>
                    {u.role !== "LOGISTICA" ? (
                      <span className="ae-muted">—</span>
                    ) : (
                      <select
                        value={u.logisticsPartnerId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          void patchUserLogisticsPartner(u.id, v === "" ? null : v);
                        }}
                        style={{ maxWidth: 200, font: "inherit", padding: "4px 6px" }}
                      >
                        <option value="">Equipa interna (todas)</option>
                        {(logisticsPartners ?? [])
                          .filter((p) => p.active)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </td>
                  <td>{u.blocked ? "Bloqueado" : "Activo"}</td>
                  <td>
                    {u.role === "ADMIN" ? (
                      <span className="ae-muted">—</span>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void setBlocked(u.id, !u.blocked)}
                      >
                        {u.blocked ? "Desbloquear" : "Bloquear"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
