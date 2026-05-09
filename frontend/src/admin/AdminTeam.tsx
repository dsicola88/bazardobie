import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type UserRow = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
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
  const [filterRole, setFilterRole] = useState<"" | "LOGISTICA" | "ADMIN" | "SUPORTE" | "VENDEDOR" | "CLIENTE">("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<"SUPORTE" | "LOGISTICA">("SUPORTE");
  const [newPartnerId, setNewPartnerId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const [editRow, setEditRow] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"SUPORTE" | "LOGISTICA">("SUPORTE");
  const [editPartnerId, setEditPartnerId] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  useEffect(() => {
    if (!editRow) return;
    setEditName(editRow.name);
    setEditEmail(editRow.email);
    setEditPhone(editRow.phone ?? "");
    setEditPassword("");
    setEditRole(editRow.role === "LOGISTICA" ? "LOGISTICA" : "SUPORTE");
    setEditPartnerId(editRow.logisticsPartnerId ?? "");
  }, [editRow]);

  const visible = useMemo(() => {
    const items = users?.items ?? [];
    if (!filterRole) return items;
    return items.filter((u) => u.role === filterRole);
  }, [users, filterRole]);

  async function patchRole(uid: string, role: "CLIENTE" | "VENDEDOR" | "LOGISTICA" | "SUPORTE") {
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

  async function createStaff(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setMsg(null);
    setErr(null);
    setCreating(true);
    try {
      await apiFetch("/admin/users/staff", {
        method: "POST",
        token,
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword,
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          role: newRole,
          logisticsPartnerId:
            newRole === "LOGISTICA" && newPartnerId ? newPartnerId : newRole === "LOGISTICA" ? null : undefined,
        }),
      });
      setMsg("Colaborador criado. Envie as credenciais por um canal seguro.");
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewPhone("");
      setNewRole("SUPORTE");
      setNewPartnerId("");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setCreating(false);
    }
  }

  async function saveStaffEdit(e: FormEvent) {
    e.preventDefault();
    if (!token || !editRow) return;
    setMsg(null);
    setErr(null);
    setSavingEdit(true);
    try {
      const body: Record<string, unknown> = {
        name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim() || null,
        role: editRole,
      };
      if (editPassword.trim().length > 0) body.password = editPassword;
      if (editRole === "LOGISTICA") {
        body.logisticsPartnerId = editPartnerId ? editPartnerId : null;
      }
      await apiFetch(`/admin/users/${editRow.id}/staff`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setMsg("Dados do colaborador actualizados.");
      setEditRow(null);
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeFromTeam(uid: string) {
    if (!token) return;
    if (!window.confirm("Remover este utilizador da equipa? Passa a CLIENTE e perde acesso ao back-office.")) return;
    setMsg(null);
    setErr(null);
    try {
      await apiFetch(`/admin/users/${uid}/staff`, { method: "DELETE", token });
      setMsg("Utilizador removido da equipa (perfil CLIENTE).");
      if (editRow?.id === uid) setEditRow(null);
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  const logisticaCount = useMemo(
    () => (users?.items ?? []).filter((u) => u.role === "LOGISTICA").length,
    [users]
  );

  const partnerOptions = (partners ?? []).filter((p) => p.active);

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Equipa, suporte e logística</h1>
          <p className="ae-admin-pro__sub">
            Crie e mantenha contas <strong>SUPORTE</strong> e <strong>LOGISTICA</strong> com dados completos (sem
            depender de registo público). Ligue cada motorista <strong>LOGISTICA</strong> à respectiva entrada em{" "}
            <Link to="/admin/logistics-partners">Transportadoras</Link>. Acompanhe encomendas BAZAR DO BIÉ em{" "}
            <Link to="/admin/orders">Encomendas</Link>. Perfis <strong>ADMIN</strong> da plataforma continuam a ser
            criados só por processo controlado no servidor.
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

      <div className="ae-panel" style={{ marginBottom: 20 }}>
        <h2 className="ae-admin-pro__title" style={{ fontSize: "1.1rem", marginBottom: 12 }}>
          Novo colaborador (suporte ou logística)
        </h2>
        <form onSubmit={(e) => void createStaff(e)} className="ae-admin-staff-form">
          <div className="ae-admin-staff-form__grid">
            <label>
              <span className="ae-muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                E-mail (login)
              </span>
              <input
                className="ae-input"
                type="email"
                autoComplete="off"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </label>
            <label>
              <span className="ae-muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                Palavra-passe inicial
              </span>
              <input
                className="ae-input"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label>
              <span className="ae-muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                Nome completo
              </span>
              <input
                className="ae-input"
                required
                minLength={2}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label>
              <span className="ae-muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                Telefone (opcional, mín. 6 caracteres se preencher)
              </span>
              <input className="ae-input" type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </label>
            <label>
              <span className="ae-muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                Perfil
              </span>
              <select
                className="ae-input"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "SUPORTE" | "LOGISTICA")}
                style={{ width: "100%" }}
              >
                <option value="SUPORTE">SUPORTE</option>
                <option value="LOGISTICA">LOGISTICA</option>
              </select>
            </label>
            {newRole === "LOGISTICA" ? (
              <label>
                <span className="ae-muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                  Transportadora
                </span>
                <select
                  className="ae-input"
                  value={newPartnerId}
                  onChange={(e) => setNewPartnerId(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Equipa interna (todas as encomendas)</option>
                  {partnerOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? "A criar…" : "Cadastrar colaborador"}
            </button>
          </div>
        </form>
      </div>

      {editRow ? (
        <div className="ae-panel" style={{ marginBottom: 20, borderColor: "var(--ae-border-strong, #334155)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <h2 className="ae-admin-pro__title" style={{ fontSize: "1.1rem", margin: 0 }}>
              Editar colaborador: {editRow.name}
            </h2>
            <button type="button" className="btn" onClick={() => setEditRow(null)}>
              Fechar
            </button>
          </div>
          <form onSubmit={(e) => void saveStaffEdit(e)} className="ae-admin-staff-form" style={{ marginTop: 14 }}>
            <div className="ae-admin-staff-form__grid">
              <label>
                <span className="ae-muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                  Nome
                </span>
                <input className="ae-input" required minLength={2} value={editName} onChange={(e) => setEditName(e.target.value)} />
              </label>
              <label>
                <span className="ae-muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                  E-mail
                </span>
                <input
                  className="ae-input"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </label>
              <label>
                <span className="ae-muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                  Telefone
                </span>
                <input className="ae-input" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </label>
              <label>
                <span className="ae-muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                  Nova palavra-passe (deixe vazio para manter)
                </span>
                <input
                  className="ae-input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </label>
              <label>
                <span className="ae-muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                  Perfil
                </span>
                <select
                  className="ae-input"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as "SUPORTE" | "LOGISTICA")}
                  style={{ width: "100%" }}
                >
                  <option value="SUPORTE">SUPORTE</option>
                  <option value="LOGISTICA">LOGISTICA</option>
                </select>
              </label>
              {editRole === "LOGISTICA" ? (
                <label>
                  <span className="ae-muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                    Transportadora
                  </span>
                  <select
                    className="ae-input"
                    value={editPartnerId}
                    onChange={(e) => setEditPartnerId(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">Equipa interna (todas as encomendas)</option>
                    {partnerOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                {savingEdit ? "A guardar…" : "Guardar alterações"}
              </button>
              <button type="button" className="btn" onClick={() => void removeFromTeam(editRow.id)}>
                Remover da equipa
              </button>
            </div>
          </form>
        </div>
      ) : null}

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
              ["SUPORTE", "Suporte / moderação"],
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
              <th>Telefone</th>
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
                <td>{u.phone?.trim() ? u.phone : <span className="ae-muted">—</span>}</td>
                <td>
                  {u.role === "ADMIN" ? (
                    <span>ADMIN</span>
                  ) : (
                    <select
                      aria-label={`Perfil ${u.name}`}
                      value={u.role}
                      onChange={(e) =>
                        void patchRole(u.id, e.target.value as "CLIENTE" | "VENDEDOR" | "LOGISTICA" | "SUPORTE")
                      }
                      style={{ maxWidth: 160, font: "inherit", padding: "4px 6px" }}
                    >
                      <option value="CLIENTE">CLIENTE</option>
                      <option value="VENDEDOR">VENDEDOR</option>
                      <option value="LOGISTICA">LOGISTICA</option>
                      <option value="SUPORTE">SUPORTE</option>
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
                      {partnerOptions.map((p) => (
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
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                      {(u.role === "SUPORTE" || u.role === "LOGISTICA") && (
                        <button type="button" className="btn" onClick={() => setEditRow(u)}>
                          Editar colaborador
                        </button>
                      )}
                      <button type="button" className="btn" onClick={() => void setBlocked(u.id, !u.blocked)}>
                        {u.blocked ? "Desbloquear" : "Suspender conta"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
