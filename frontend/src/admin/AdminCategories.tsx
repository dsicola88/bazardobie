import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type Row = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  productCount: number;
  childCount: number;
};

function collectDescendantsUnder(rootId: string, rows: Row[]): Set<string> {
  const byParent = new Map<string | null, Row[]>();
  for (const r of rows) {
    const k = r.parentId;
    const arr = byParent.get(k) ?? [];
    arr.push(r);
    byParent.set(k, arr);
  }
  const out = new Set<string>();
  const q = [...(byParent.get(rootId) ?? [])];
  while (q.length) {
    const n = q.pop()!;
    out.add(n.id);
    q.push(...(byParent.get(n.id) ?? []));
  }
  return out;
}

export default function AdminCategories() {
  const { token } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newParentId, setNewParentId] = useState<string>("");
  const [newOrder, setNewOrder] = useState<number>(0);
  const [editing, setEditing] = useState<Row | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editParentId, setEditParentId] = useState<string>("");
  const [editOrder, setEditOrder] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const list = await apiFetch<Row[]>("/admin/categories", { token });
      setRows(list);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const parentOptionsForNew = rows ?? [];

  const parentOptionsForEdit = useMemo(() => {
    if (!editing || !rows) return [];
    const ban = collectDescendantsUnder(editing.id, rows);
    ban.add(editing.id);
    return rows.filter((r) => !ban.has(r.id));
  }, [editing, rows]);

  async function createCat() {
    if (!token || !newName.trim()) return;
    setMsg(null);
    try {
      await apiFetch("/admin/categories", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: newName.trim(),
          imageUrl: newImageUrl.trim(),
          parentId: newParentId.trim() === "" ? null : newParentId.trim(),
          sortOrder: newOrder || 0,
        }),
      });
      setMsg("Categoria criada.");
      setNewName("");
      setNewImageUrl("");
      setNewParentId("");
      setNewOrder(0);
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao criar");
    }
  }

  function openEdit(r: Row) {
    setEditing(r);
    setEditName(r.name);
    setEditImageUrl((r.imageUrl ?? "").trim());
    setEditParentId(r.parentId ?? "");
    setEditOrder(r.sortOrder);
    setErr(null);
  }

  async function saveEdit() {
    if (!token || !editing) return;
    setMsg(null);
    try {
      await apiFetch(`/admin/categories/${editing.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          name: editName.trim(),
          imageUrl: editImageUrl.trim(),
          parentId: editParentId.trim() === "" ? null : editParentId.trim(),
          sortOrder: editOrder,
        }),
      });
      setMsg("Categoria actualizada.");
      setEditing(null);
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao guardar");
    }
  }

  async function removeCat(r: Row) {
    if (!token) return;
    if (r.childCount > 0) {
      window.alert("Esta categoria tem subcategorias. Apague primeiro as subcategorias ou mova‑nas.");
      return;
    }
    const confirmMsg =
      r.productCount > 0
        ? `Esta categoria está ligada a ${r.productCount} produto(s). Ao eliminar, os produtos ficam sem categoria. Continuar?`
        : `Eliminar permanentemente «${r.name}»?`;
    if (!window.confirm(confirmMsg)) return;
    setMsg(null);
    try {
      await apiFetch(`/admin/categories/${r.id}`, { method: "DELETE", token });
      setMsg("Categoria eliminada.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível eliminar");
    }
  }

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) m.set(r.id, r.name);
    return m;
  }, [rows]);

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Categorias do catálogo</h1>
          <p className="ae-admin-pro__sub">
            Estrutura usada nos menus da loja, na pesquisa e pelos vendedores ao criar produtos. O <strong>slug</strong>{" "}
            gera-se a partir do nome (URL técnica). Subcategorias usam um <strong>categoria pai</strong>.
          </p>
        </div>
      </header>

      {err ? (
        <p className="ae-admin-alert ae-admin-alert--err" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="ae-admin-alert ae-admin-alert--ok" role="presentation">
          {msg}
        </p>
      ) : null}

      <div className="ae-panel">
        <h2 style={{ marginTop: 0 }}>Nova categoria</h2>
        <div className="ae-admin-form-grid">
          <label className="ae-admin-field">
            Nome
            <input
              className="ae-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: Electrodomésticos"
            />
          </label>
          <label className="ae-admin-field">
            Imagem da categoria (URL ou /uploads/...)
            <input
              className="ae-input"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="https://... ou /uploads/categorias/electronicos.webp"
            />
          </label>
          <label className="ae-admin-field">
            Dentro da categoria pai (opcional)
            <select
              className="ae-input"
              value={newParentId}
              onChange={(e) => setNewParentId(e.target.value)}
            >
              <option value="">Raiz da árvore (categoria principal)</option>
              {parentOptionsForNew.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.parentId ? "↳ " : ""}{r.name} — {r.slug}
                </option>
              ))}
            </select>
          </label>
          <label className="ae-admin-field">
            Ordem (numérico, menor aparece primeiro)
            <input
              type="number"
              className="ae-input"
              value={newOrder}
              onChange={(e) => setNewOrder(Number(e.target.value) || 0)}
            />
          </label>
          {newImageUrl.trim() ? (
            <div className="ae-admin-cat-preview">
              <img src={newImageUrl.trim()} alt="Pré-visualização da nova categoria" loading="lazy" decoding="async" />
            </div>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={() => void createCat()}>
            Adicionar categoria
          </button>
        </div>
      </div>

      <div className="ae-admin-table-wrap" style={{ marginTop: 20 }}>
        <table className="ae-admin-table">
          <thead>
            <tr>
              <th>Imagem</th>
              <th>Nome</th>
              <th>Slug</th>
              <th>Pai</th>
              <th>Ord.</th>
              <th>Produtos</th>
              <th>Subcat.</th>
              <th className="ae-admin-table__actions">Acções</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td>
                  {r.imageUrl ? (
                    <img className="ae-admin-cat-thumb" src={r.imageUrl} alt={r.name} loading="lazy" decoding="async" />
                  ) : (
                    <div className="ae-admin-cat-thumb ae-admin-cat-thumb--ph" aria-hidden />
                  )}
                </td>
                <td className="ae-admin-cell-title">{r.parentId ? "↳ " : ""}{r.name}</td>
                <td>
                  <code className="ae-admin-mono" style={{ fontSize: 12 }}>
                    {r.slug}
                  </code>
                </td>
                <td className="ae-muted">{r.parentId ? (nameById.get(r.parentId) ?? r.parentId) : "—"}</td>
                <td>{r.sortOrder}</td>
                <td>{r.productCount}</td>
                <td>{r.childCount}</td>
                <td className="ae-admin-row-actions">
                  <button type="button" className="btn" onClick={() => openEdit(r)}>
                    Editar
                  </button>{" "}
                  <button type="button" className="btn" onClick={() => void removeCat(r)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 16 }} className="ae-muted">
        Ver como cliente: filtros da <Link to="/search">pesquisa</Link> ·{" "}
        <Link to="/">Home</Link>
      </p>

      {editing ? (
        <div className="ae-panel" role="dialog" aria-modal="true" style={{ marginTop: 24 }}>
          <h2 style={{ marginTop: 0 }}>Editar: {editing.name}</h2>
          <div className="ae-admin-form-grid">
            <label className="ae-admin-field">
              Nome
              <input
                className="ae-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
            <label className="ae-admin-field">
              Imagem da categoria (URL ou /uploads/...)
              <input
                className="ae-input"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
              />
            </label>
            <label className="ae-admin-field">
              Pai (reorganizar hierarquia)
              <select
                className="ae-input"
                value={editParentId}
                onChange={(e) => setEditParentId(e.target.value)}
              >
                <option value="">Raiz</option>
                {parentOptionsForEdit.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.parentId ? "↳ " : ""}{r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ae-admin-field">
              Ordem
              <input
                type="number"
                className="ae-input"
                value={editOrder}
                onChange={(e) => setEditOrder(Number(e.target.value) || 0)}
              />
            </label>
            {editImageUrl.trim() ? (
              <div className="ae-admin-cat-preview">
                <img src={editImageUrl.trim()} alt={`Pré-visualização ${editName || editing.name}`} loading="lazy" decoding="async" />
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary" onClick={() => void saveEdit()}>
                Guardar alterações
              </button>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
