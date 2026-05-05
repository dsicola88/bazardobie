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
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Transportadoras parceiras</h1>
          <p className="ae-admin-pro__sub">
            Registo oficial de última milha (NIF, contactos). Os vendedores associam uma transportadora activa a cada
            opção de envio da plataforma na ficha do produto; o cliente vê esse nome ao escolher a expedición. Ligue
            contas <strong>LOGISTICA</strong> aos parceiros em <strong>Equipa e logística</strong> no menu lateral;
            associe cada encomenda BAZAR DO BIÉ ao parceiro no detalhe da encomenda, quando necessário.
          </p>
        </div>
      </header>
      {err ? <p className="ae-admin-alert ae-admin-alert--err">{err}</p> : null}
      {msg ? <p className="ae-admin-alert ae-admin-alert--ok">{msg}</p> : null}

      <div className="ae-panel ae-admin-form-card" style={{ marginBottom: 18 }}>
        <h2 className="ae-admin-form-title">
          {editId ? `Editar parceiro (${editId.slice(0, 8)}…)` : "Nova transportadora"}
        </h2>
        <form
          className="ae-admin-form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            if (editId) {
              void submitPatch();
              return;
            }
            void submitCreate();
          }}
        >
          <label className="ae-admin-field">
            <span>Nome / razão social *</span>
            <input
              className="ae-input"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              required
              placeholder="Ex.: Expresso Bazar Luanda"
            />
          </label>
          <label className="ae-admin-field">
            <span>NIF</span>
            <input
              className="ae-input"
              value={form.nif}
              onChange={(e) => setForm((s) => ({ ...s, nif: e.target.value }))}
              placeholder="Ex.: 5000123456"
            />
          </label>
          <label className="ae-admin-field">
            <span>Telefone</span>
            <input
              className="ae-input"
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
              placeholder="Ex.: +244 923 000 111"
            />
          </label>
          <label className="ae-admin-field">
            <span>E-mail</span>
            <input
              className="ae-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              placeholder="Ex.: contacto@transportadora.ao"
            />
          </label>
          <label className="ae-admin-field">
            <span>Pessoa de contacto</span>
            <input
              className="ae-input"
              value={form.contactName}
              onChange={(e) => setForm((s) => ({ ...s, contactName: e.target.value }))}
              placeholder="Ex.: Maria Silva"
            />
          </label>
          <label className="ae-admin-field">
            <span>Província</span>
            <input
              className="ae-input"
              value={form.province}
              onChange={(e) => setForm((s) => ({ ...s, province: e.target.value }))}
              placeholder="Ex.: Luanda"
            />
          </label>
          <label className="ae-admin-field">
            <span>Cidade / base</span>
            <input
              className="ae-input"
              value={form.city}
              onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
              placeholder="Ex.: Talatona"
            />
          </label>
          <label className="ae-admin-field">
            <span>Notas internas</span>
            <textarea
              className="ae-input"
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              placeholder="Dados operacionais internos (opcional)."
            />
          </label>
          <div className="ae-admin-form-actions">
            {editId ? (
              <>
                <button type="submit" className="btn btn-primary">
                  Guardar alterações
                </button>
                <button type="button" className="btn" onClick={() => cancelEdit()}>
                  Cancelar
                </button>
              </>
            ) : (
              <button type="submit" className="btn btn-primary">
                Registar transportadora
              </button>
            )}
          </div>
        </form>
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
