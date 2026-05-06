import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, uploadAdminFile } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { resolveMediaUrl } from "../utils/media.js";

type Banner = {
  id: string;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  active: boolean;
  createdAt?: string;
};

type EditorMode = "create" | "edit";

function Pill({ active }: { active: boolean }) {
  return (
    <span className={`ae-pill ${active ? "ae-pill--on" : "ae-pill--off"}`}>
      {active ? "Activo" : "Pausado"}
    </span>
  );
}

export default function AdminBanners() {
  const { token } = useAuth();
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [mode, setMode] = useState<EditorMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [active, setActive] = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setLoading(true);
    try {
      const r = await apiFetch<{ items: Banner[] }>("/admin/banners", { token });
      setItems(r.items);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar banners");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setTitle("");
    setImageUrl("");
    setLinkUrl("");
    setSortOrder(items.length > 0 ? Math.max(...items.map((b) => b.sortOrder)) + 1 : 0);
    setActive(true);
    setEditorOpen(true);
    setErr(null);
    setMsg(null);
  }

  function openEdit(b: Banner) {
    setMode("edit");
    setEditingId(b.id);
    setTitle(b.title ?? "");
    setImageUrl(b.imageUrl);
    setLinkUrl(b.linkUrl ?? "");
    setSortOrder(b.sortOrder);
    setActive(b.active);
    setEditorOpen(true);
    setErr(null);
    setMsg(null);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !token) return;
    setUploading(true);
    setErr(null);
    try {
      const url = await uploadAdminFile(token, f);
      setImageUrl(url);
      setMsg("Imagem carregada. Não esqueça guardar o banner.");
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  async function saveEditor() {
    if (!token) return;
    const trimmedImg = imageUrl.trim();
    if (!trimmedImg) {
      setErr("Indique uma imagem (URL ou upload).");
      return;
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const link = linkUrl.trim();
      if (mode === "create") {
        await apiFetch("/admin/banners", {
          method: "POST",
          token,
          body: JSON.stringify({
            title: title.trim() || undefined,
            imageUrl: trimmedImg,
            linkUrl: link || undefined,
            sortOrder,
            active,
          }),
        });
        setMsg("Banner criado e disponível no carrossel (se estiver activo).");
      } else if (editingId) {
        await apiFetch(`/admin/banners/${editingId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            title: title.trim() || null,
            imageUrl: trimmedImg,
            linkUrl: link || null,
            sortOrder,
            active,
          }),
        });
        setMsg("Alterações guardadas.");
      }
      closeEditor();
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  async function quickToggleActive(b: Banner) {
    if (!token) return;
    setErr(null);
    try {
      await apiFetch(`/admin/banners/${b.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ active: !b.active }),
      });
      setMsg(!b.active ? "Banner activado." : "Banner pausado (não aparece na loja).");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function removeBanner(b: Banner) {
    if (!token) return;
    const ok = window.confirm(
      `Eliminar este banner permanentemente?\n\n${b.title ?? b.imageUrl.slice(0, 48)}…`
    );
    if (!ok) return;
    setErr(null);
    try {
      await apiFetch(`/admin/banners/${b.id}`, { method: "DELETE", token });
      setMsg("Banner eliminado.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  const sortedPreview = [...items].sort((a, b) => a.sortOrder - b.sortOrder || (a.id > b.id ? 1 : -1));

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Carrossel da página inicial</h1>
          <p className="ae-admin-pro__sub">
            Banners em destaque no topo da loja — proporção recomendada <strong>16∶9</strong> ou <strong>3∶1</strong>,
            imagens nítidas e leves. Use o upload para guardar ficheiros no servidor ou cole uma URL HTTPS
            fidedigna.
          </p>
        </div>
        <div className="ae-admin-pro__actions">
          <Link to="/admin/content" className="btn">
            Textos e promo bar
          </Link>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Novo banner
          </button>
        </div>
      </header>

      {err ? (
        <div className="ae-admin-alert ae-admin-alert--err" role="alert">
          {err}
        </div>
      ) : null}
      {msg ? (
        <div className="ae-admin-alert ae-admin-alert--ok" role="status">
          {msg}
        </div>
      ) : null}

      {loading ? (
        <p className="ae-muted">A carregar…</p>
      ) : sortedPreview.length === 0 ? (
        <div className="ae-admin-empty">
          <h2>Nenhum banner configurado</h2>
          <p>O carrossel mostrará a mensagem de recurso definida em «Conteúdo do site». Crie o primeiro slide acima.</p>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Criar primeiro banner
          </button>
        </div>
      ) : (
        <div className="ae-admin-table-wrap">
          <table className="ae-admin-table">
            <thead>
              <tr>
                <th scope="col">Pré-visualização</th>
                <th scope="col">Título interno</th>
                <th scope="col">Ordem</th>
                <th scope="col">Estado</th>
                <th scope="col">Destino (link)</th>
                <th scope="col" className="ae-admin-table__actions">
                  Acções
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPreview.map((b) => (
                <tr key={b.id}>
                  <td>
                    <a href={resolveMediaUrl(b.imageUrl)} target="_blank" rel="noopener noreferrer" className="ae-admin-thumb-link">
                      <img src={resolveMediaUrl(b.imageUrl)} alt="" className="ae-admin-thumb" loading="lazy" decoding="async" />
                    </a>
                  </td>
                  <td>
                    <span className="ae-admin-cell-title">{b.title?.trim() || "—"}</span>
                  </td>
                  <td>
                    <code className="ae-admin-mono">{b.sortOrder}</code>
                  </td>
                  <td>
                    <Pill active={b.active} />
                  </td>
                  <td className="ae-admin-ellipsis" title={b.linkUrl ?? undefined}>
                    {b.linkUrl ? (
                      <a href={b.linkUrl} target="_blank" rel="noopener noreferrer">
                        {b.linkUrl.replace(/^https?:\/\//, "").slice(0, 42)}
                        {b.linkUrl.length > 42 ? "…" : ""}
                      </a>
                    ) : (
                      <span className="ae-muted">Sem link</span>
                    )}
                  </td>
                  <td className="ae-admin-table__actions">
                    <div className="ae-admin-row-actions">
                      <button type="button" className="ae-btn-subtle" onClick={() => openEdit(b)}>
                        Editar
                      </button>
                      <button type="button" className="ae-btn-subtle" onClick={() => void quickToggleActive(b)}>
                        {b.active ? "Pausar" : "Activar"}
                      </button>
                      <button type="button" className="ae-btn-subtle ae-btn-subtle--danger" onClick={() => void removeBanner(b)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => void onPickFile(e)} />

      {editorOpen ? (
        <div className="ae-modal-backdrop" role="presentation" onClick={closeEditor}>
          <div className="ae-modal ae-modal--lg" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <div className="ae-modal__head">
              <h2 id="banner-editor-title">{mode === "create" ? "Novo banner" : "Editar banner"}</h2>
              <button type="button" className="ae-modal__close" aria-label="Fechar" onClick={closeEditor}>
                ×
              </button>
            </div>
            <div className="ae-modal__body">
              <div className="ae-form ae-form--compact">
                <div className="ae-field-grid">
                  <div>
                    <label htmlFor="bn-title">Título (opcional)</label>
                    <p className="ae-field-hint">Nome interno e texto alternativo do slide.</p>
                    <input id="bn-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Campanha Quéssua" />
                  </div>
                  <div>
                    <label htmlFor="bn-order">Ordem no carrossel</label>
                    <p className="ae-field-hint">Números mais baixos aparecem primeiro.</p>
                    <input
                      id="bn-order"
                      type="number"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="bn-img">URL da imagem</label>
                  <p className="ae-field-hint">HTTPS recomendado. Tamanho típico 1400–1920 px de largura.</p>
                  <div className="ae-input-row">
                    <input
                      id="bn-img"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://…"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="btn"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading ? "A carregar…" : "Carregar ficheiro"}
                    </button>
                  </div>
                  {imageUrl.trim() ? (
                    <div className="ae-editor-preview">
                      <img src={resolveMediaUrl(imageUrl.trim())} alt="Pré-visualização" loading="lazy" decoding="async" />
                    </div>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="bn-link">Link ao clicar (opcional)</label>
                  <p className="ae-field-hint">Página de categoria, produto ou campanha externa.</p>
                  <input
                    id="bn-link"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>

                <label className="ae-check">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                  <span>Banner visível na loja</span>
                </label>
              </div>
            </div>
            <div className="ae-modal__foot">
              <button type="button" className="btn" onClick={closeEditor}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveEditor()}>
                {saving ? "A guardar…" : mode === "create" ? "Criar banner" : "Guardar alterações"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
