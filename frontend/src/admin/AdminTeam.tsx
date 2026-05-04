import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

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

export default function AdminTeam() {
  const { token } = useAuth();
  const [users, setUsers] = useState<{ items: UserRow[]; total: number } | null>(null);
  const [partners, setPartners] = useState<LPartnerOpt[] | null>(null);
  const [filterRole, setFilterRole] = useState<"" | "LOGISTICA" | "ADMIN" | "VENDEDOR" | "CLIENTE">("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [u, lp] = await Promise.all([
        apiFetch<{ items: UserRow[]; total: number }>("/admin/users?take=250", { token }),
        apiFetch<LPartnerOpt[]>("/admin/logistics-partners", { token }),
      ]);
      setUsers(u);
      setPartners(lp);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const items = users?.items ?? [];
    if (!filterRole) return items;
    return items.filter((u) => u.role === filterRole);
  }, [users, filterRole]);

  async function patchRole(uid: string, role: "CLIENTE" | "VENDEDOR" | "LOGISTICA") {
    if (!token) return;
    setMsg(null);
    try {
      await apiFetch(`/admin/users/${uid}/role`, { method: "PATCH", token, body: JSON.stringify({ role }) });
      setMsg("Perfil actualizado.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function setBlocked(uid: string, blocked: boolean) {
    if (!token) return;
    setMsg(null);
    try {
      await apiFetch(`/admin/users/${uid}/blocked`, { method: "PATCH", token, body: JSON.stringify({ blocked }) });
      setMsg(blocked ? "Conta suspensa — não acede com JWT válido até desbloquear." : "Conta reactivada.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function patchUserLogisticsPartner(uid: string, logisticsPartnerId: string | null) {
    if (!token) return;
    setMsg(null);
    try {
      await apiFetch(`/admin/users/${uid}/logistics-partner`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ logisticsPartnerId }),
      });
      setMsg("Transportadora ligada ao colaborador de logística.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  const logisticaCount = useMemo(
    () => (users?.items ?? []).filter((u) => u.role === "LOGISTICA").length,
    [users]
  );

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Contas da equipa e acessos</h1>
          <p className="ae-admin-pro__sub">
            Gestão central de perfis: atribua o papel <strong>LOGISTICA</strong> a motoristas ou coordenadores, ligue‑os à{" "}
            <strong>transportadora registada</strong> e suspenda contas quando necessário. Fluxo típico: registas o colaborador
            como cliente (ou convida com registo público), depois promove o perfil aqui. Empresas de última milha{" "}
            <Link to="/admin/logistics-partners">cadastram‑se aqui</Link>; encomendas BAZAR DO BIÉ são atribuídas em{" "}
            <Link to="/admin/orders">Encomendas</Link>.
          </p>
          <p className="ae-muted" style={{ marginTop: 10, fontSize: 12 }}>
            Colaboradores LOGISTICA activos: <strong>{logisticaCount}</strong> · Total listado: {users?.total ?? "—"}
          </p>
        </div>
      </header>

      {err ? (
        <p className="ae-admin-alert ae-admin-alert--err" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? <p className="ae-admin-alert ae-admin-alert--ok">{msg}</p> : null}

      <div className="ae-panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span className="ae-muted" style={{ fontWeight: 600 }}>
            Filtro:
          </span>
          {(
            [
              ["", "Todas"],
              ["LOGISTICA", "Só equipa LOGISTICA"],
              ["ADMIN", "Administradores"],
              ["VENDEDOR", "Vendedores"],
              ["CLIENTE", "Clientes"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k || "all"}
              type="button"
              className={filterRole === k ? "btn btn-primary" : "btn"}
              onClick={() => setFilterRole(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="ae-admin-table-wrap">
        <table className="ae-admin-table">
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
            {visible.map((u) => (
              <tr key={u.id}>
                <td className="ae-admin-cell-title">{u.name}</td>
                <td>{u.email}</td>
                <td>
                  {u.role === "ADMIN" ? (
                    <span>ADMIN</span>
                  ) : (
                    <select
                      aria-label={`Perfil ${u.name}`}
                      value={u.role}
                      onChange={(e) => void patchRole(u.id, e.target.value as "CLIENTE" | "VENDEDOR" | "LOGISTICA")}
                      style={{ maxWidth: 150, font: "inherit", padding: "4px 6px" }}
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
                      aria-label={`Parceiro logística ${u.name}`}
                      value={u.logisticsPartnerId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        void patchUserLogisticsPartner(u.id, v === "" ? null : v);
                      }}
                      style={{ maxWidth: 220, font: "inherit", padding: "4px 6px" }}
                    >
                      <option value="">Equipa interna (todas as encomendas)</option>
                      {(partners ?? [])
                        .filter((p) => p.active)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  )}
                </td>
                <td>{u.blocked ? "Suspensa" : "Activa"}</td>
                <td className="ae-admin-row-actions">
                  {u.role === "ADMIN" ? (
                    <span className="ae-muted">—</span>
                  ) : (
                    <button type="button" className="btn" onClick={() => void setBlocked(u.id, !u.blocked)}>
                      {u.blocked ? "Desbloquear" : "Suspender conta"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="ae-panel" style={{ marginTop: 20 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Script pelo servidor (desenvolvimento)</summary>
        <p className="ae-muted" style={{ marginBottom: 0 }}>
          Na máquina de deploy ou dev, pode usar <code className="ae-admin-mono">npm run create-logistics -- email senha nome</code>{" "}
          na pasta backend para criar rapidamente conta LOGISTICA; depois ajuste perfil aqui se necessário.
        </p>
      </details>
    </div>
  );
}
