import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type Partner = {
  id: string;
  name: string;
  nif: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  province: string | null;
  city: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const emptyForm = {
  name: "",
  nif: "",
  phone: "",
  email: "",
  contactName: "",
  province: "",
  city: "",
  notes: "",
};

export default function AdminLogisticsPartners() {
  const { token } = useAuth();
  const [rows, setRows] = useState<Partner[] | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const list = await apiFetch<Partner[]>("/admin/logistics-partners", { token });
      setRows(list);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(p: Partner) {
    setEditId(p.id);
    setForm({
      name: p.name,
      nif: p.nif ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      contactName: p.contactName ?? "",
      province: p.province ?? "",
      city: p.city ?? "",
      notes: p.notes ?? "",
    });
    setMsg(null);
  }

  function cancelEdit() {
    setEditId(null);
    setForm(emptyForm);
  }

  async function submitCreate() {
    if (!token || !form.name.trim()) return;
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/admin/logistics-partners", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: form.name.trim(),
          nif: form.nif.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          contactName: form.contactName.trim() || null,
          province: form.province.trim() || null,
          city: form.city.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      setMsg("Transportadora registada.");
      cancelEdit();
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function submitPatch() {
    if (!token || !editId) return;
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/admin/logistics-partners/${editId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          name: form.name.trim(),
          nif: form.nif.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          contactName: form.contactName.trim() || null,
          province: form.province.trim() || null,
          city: form.city.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      setMsg("Dados actualizados.");
      cancelEdit();
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function setActive(p: Partner, active: boolean) {
    if (!token) return;
    setErr(null);
    try {
      await apiFetch(`/admin/logistics-partners/${p.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ active }),
      });
      setMsg(active ? "Parceiro reactivado." : "Parceiro desactivado.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div>
      <div className="ae-v-head">
        <div>
          <h1 className="ae-v-title">Transportadoras parceiras</h1>
          <p className="ae-muted" style={{ margin: "6px 0 0" }}>
            Cadastro de empresas de última milha. Ligue contas <strong>LOGISTICA</strong> a um parceiro em{" "}
            <strong>Lojas parceiras → Utilizadores</strong> e atribua encomendas BAZAR DO BIÉ no detalhe do pedido.
          </p>
        </div>
      </div>
      {err ? <p style={{ color: "crimson" }}>{err}</p> : null}
      {msg ? <p style={{ color: "var(--ae-ok)" }}>{msg}</p> : null}

      <div className="ae-panel" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>{editId ? `Editar parceiro (${editId.slice(0, 8)}…)` : "Nova transportadora"}</h2>
        <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
          <label>
            Nome / razão social *
            <input
              className="ae-input"
              style={{ width: "100%" }}
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
          </label>
          <label>
            NIF
            <input
              className="ae-input"
              style={{ width: "100%" }}
              value={form.nif}
              onChange={(e) => setForm((s) => ({ ...s, nif: e.target.value }))}
            />
          </label>
          <label>
            Telefone
            <input
              className="ae-input"
              style={{ width: "100%" }}
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
            />
          </label>
          <label>
            E-mail
            <input
              className="ae-input"
              type="email"
              style={{ width: "100%" }}
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            />
          </label>
          <label>
            Pessoa de contacto
            <input
              className="ae-input"
              style={{ width: "100%" }}
              value={form.contactName}
              onChange={(e) => setForm((s) => ({ ...s, contactName: e.target.value }))}
            />
          </label>
          <label>
            Província
            <input
              className="ae-input"
              style={{ width: "100%" }}
              value={form.province}
              onChange={(e) => setForm((s) => ({ ...s, province: e.target.value }))}
            />
          </label>
          <label>
            Cidade / base
            <input
              className="ae-input"
              style={{ width: "100%" }}
              value={form.city}
              onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
            />
          </label>
          <label>
            Notas internas
            <textarea
              className="ae-input"
              style={{ width: "100%", minHeight: 72 }}
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {editId ? (
              <>
                <button type="button" className="btn btn-primary" onClick={() => void submitPatch()}>
                  Guardar alterações
                </button>
                <button type="button" className="btn" onClick={() => cancelEdit()}>
                  Cancelar
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => void submitCreate()}>
                Registar transportadora
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="ae-panel">
        <h2 style={{ marginTop: 0 }}>Parceiros cadastrados</h2>
        <table className="ae-data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>NIF</th>
              <th>Contacto</th>
              <th>Local</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((p) => (
              <tr key={p.id} style={{ opacity: p.active ? 1 : 0.65 }}>
                <td>
                  <strong>{p.name}</strong>
                </td>
                <td>{p.nif ?? "—"}</td>
                <td className="ae-muted" style={{ fontSize: 13 }}>
                  {p.phone ?? "—"}
                  {p.contactName ? <div>{p.contactName}</div> : null}
                </td>
                <td className="ae-muted" style={{ fontSize: 13 }}>
                  {[p.city, p.province].filter(Boolean).join(", ") || "—"}
                </td>
                <td>{p.active ? "Activo" : "Inactivo"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="btn" onClick={() => startEdit(p)}>
                    Editar
                  </button>{" "}
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void setActive(p, !p.active)}
                  >
                    {p.active ? "Desactivar" : "Reactivar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
