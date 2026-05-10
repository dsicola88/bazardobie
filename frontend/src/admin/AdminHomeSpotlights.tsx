import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch, uploadAdminFile } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { isPlatformAdmin } from "./adminAccess.js";
import { resolveMediaUrl } from "../utils/media.js";

type AdminSpotlightRow = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  layout: string;
  sortOrder: number;
  active: boolean;
  cardAccent?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  maxTiles: number;
  tileCount: number;
  updatedAt: string;
};

type TileRow = {
  id: string;
  sortOrder: number;
  imageUrl: string;
  label?: string | null;
  href: string;
  captionBg?: string | null;
};

type SpotlightDetail = {
  slug: string;
  title: string;
  subtitle?: string | null;
  layout: string;
  sortOrder: number;
  active: boolean;
  cardAccent?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  maxTiles: number;
  tiles: TileRow[];
};

export default function AdminHomeSpotlights() {
  const { token, user } = useAuth();
  const fullAdmin = isPlatformAdmin(user?.role);
  const [sections, setSections] = useState<AdminSpotlightRow[] | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<SpotlightDetail | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newLayout, setNewLayout] = useState("GRID_2X2");

  const [tileImage, setTileImage] = useState("");
  const [tileHref, setTileHref] = useState("");
  const [tileLabel, setTileLabel] = useState("");
  const [tileCaptionBg, setTileCaptionBg] = useState("");

  const loadSections = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<{ sections: AdminSpotlightRow[] }>("/admin/home-spotlights", { token });
      setSections(res.sections);
      setSelectedSlug((prev) => {
        if (prev && res.sections.some((s) => s.slug === prev)) return prev;
        return res.sections[0]?.slug ?? null;
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar vitrines");
    }
  }, [token]);

  const loadDetail = useCallback(
    async (slug: string) => {
      if (!token) return;
      try {
        const data = await apiFetch<SpotlightDetail>(`/admin/home-spotlights/${encodeURIComponent(slug)}/tiles`, {
          token,
        });
        setDetail(data);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Erro ao carregar cartões");
        setDetail(null);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadSections();
  }, [loadSections]);

  useEffect(() => {
    if (!token || !selectedSlug) return;
    void loadDetail(selectedSlug);
  }, [token, selectedSlug, loadDetail]);

  const active = sections?.find((s) => s.slug === selectedSlug);

  async function saveSectionMeta(patch: Record<string, unknown>) {
    if (!token || !selectedSlug) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/admin/home-spotlights/${encodeURIComponent(selectedSlug)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      setMsg("Vitrine actualizada.");
      void loadSections();
      void loadDetail(selectedSlug);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setBusy(false);
    }
  }

  async function createSection() {
    if (!token || !fullAdmin) return;
    const slug = newSlug.trim().toLowerCase();
    const title = newTitle.trim();
    if (!slug || !title) {
      setErr("Indique slug e título.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/admin/home-spotlights", {
        method: "POST",
        token,
        body: JSON.stringify({ slug, title, layout: newLayout }),
      });
      setMsg("Nova vitrine criada.");
      setNewSlug("");
      setNewTitle("");
      setNewLayout("GRID_2X2");
      await loadSections();
      setSelectedSlug(slug);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível criar");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSection() {
    if (!token || !fullAdmin || !selectedSlug) return;
    if (!window.confirm("Eliminar esta vitrine e todos os cartões?")) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/admin/home-spotlights/${encodeURIComponent(selectedSlug)}`, {
        method: "DELETE",
        token,
      });
      setMsg("Vitrine eliminada.");
      setDetail(null);
      setSelectedSlug(null);
      await loadSections();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível eliminar");
    } finally {
      setBusy(false);
    }
  }

  async function addTile() {
    if (!token || !selectedSlug) return;
    const imageUrl = tileImage.trim();
    const href = tileHref.trim();
    if (!imageUrl || !href) {
      setErr("Imagem e destino (href) são obrigatórios.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/admin/home-spotlights/${encodeURIComponent(selectedSlug)}/tiles`, {
        method: "POST",
        token,
        body: JSON.stringify({
          imageUrl,
          href,
          label: tileLabel.trim() || undefined,
          captionBg: tileCaptionBg.trim() || undefined,
        }),
      });
      setMsg("Cartão adicionado.");
      setTileImage("");
      setTileHref("");
      setTileLabel("");
      setTileCaptionBg("");
      void loadDetail(selectedSlug);
      void loadSections();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível adicionar");
    } finally {
      setBusy(false);
    }
  }

  async function patchTile(tileId: string, patch: Record<string, unknown>) {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/admin/home-spotlights/tiles/${encodeURIComponent(tileId)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      setMsg("Cartão actualizado.");
      if (selectedSlug) void loadDetail(selectedSlug);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao actualizar cartão");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTile(tileId: string) {
    if (!token) return;
    if (!window.confirm("Remover este cartão?")) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/admin/home-spotlights/tiles/${encodeURIComponent(tileId)}`, {
        method: "DELETE",
        token,
      });
      setMsg("Cartão removido.");
      if (selectedSlug) void loadDetail(selectedSlug);
      void loadSections();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao remover");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadTileImage(ev: ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f || !token) return;
    setUploading(true);
    setErr(null);
    try {
      const url = await uploadAdminFile(token, f);
      setTileImage(url);
      setMsg("Imagem carregada — confirme o destino e adicione o cartão.");
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Falha no upload");
    } finally {
      setUploading(false);
      ev.target.value = "";
    }
  }

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Vitrines só imagem + link</h1>
          <p className="ae-admin-pro__sub">
            Secções de marketing na página inicial (grelha larga, hero com três miniaturas ou faixa horizontal). Não listam
            produtos automaticamente — cada cartão é imagem, texto opcional e link interno ou externo. Complementa os grupos de
            produtos já existentes.
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
        <h2 style={{ marginTop: 0 }}>Seleccionar vitrine</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(sections ?? []).map((s) => (
            <button
              key={s.slug}
              type="button"
              className={s.slug === selectedSlug ? "btn btn-primary" : "btn"}
              onClick={() => {
                setSelectedSlug(s.slug);
                setErr(null);
                setMsg(null);
              }}
              disabled={busy}
            >
              {s.title}
            </button>
          ))}
        </div>
        {active ? (
          <p className="ae-muted" style={{ marginTop: 10 }}>
            Slug <code className="ae-admin-mono">{active.slug}</code> · ordem {active.sortOrder} · máximo{" "}
            <strong>{active.maxTiles}</strong> cartões públicos · layout <code className="ae-admin-mono">{active.layout}</code> ·{" "}
            {active.active ? <span className="ae-pill ae-pill--on">activo</span> : <span className="ae-pill ae-pill--off">pausado</span>}{" "}
            ({active.tileCount} cartões).
          </p>
        ) : sections?.length === 0 ? (
          <p className="ae-muted" style={{ marginTop: 10 }}>
            Ainda não há vitrines. {fullAdmin ? "Crie a primeira abaixo." : "Peça a um administrador da plataforma para criar uma vitrine."}
          </p>
        ) : null}
      </div>

      {fullAdmin ? (
        <div className="ae-panel" style={{ marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>Nova vitrine (administrador)</h2>
          <div className="ae-admin-form-grid">
            <label className="ae-admin-field">
              Slug (minúsculas e hífens)
              <input className="ae-input" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="ex.: campanha-verao" />
            </label>
            <label className="ae-admin-field">
              Título público
              <input className="ae-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex.: Ideias para casa" />
            </label>
            <label className="ae-admin-field">
              Layout inicial
              <select className="ae-input" value={newLayout} onChange={(e) => setNewLayout(e.target.value)}>
                <option value="GRID_2X2">Grelha larga (até 4+ colunas em desktop)</option>
                <option value="HERO_THREE">Hero + 3 cartões compactos</option>
                <option value="ROW_SCROLL">Faixa horizontal com scroll</option>
              </select>
            </label>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createSection()}>
            Criar vitrine
          </button>
        </div>
      ) : null}

      {active && detail ? (
        <>
          <div className="ae-panel" style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ marginTop: 0 }}>Textos e comportamento</h2>
              {fullAdmin ? (
                <button type="button" className="btn" disabled={busy} onClick={() => void deleteSection()}>
                  Eliminar vitrine
                </button>
              ) : null}
            </div>
            <div className="ae-admin-form-grid">
              <label className="ae-admin-field">
                Título
                <input
                  className="ae-input"
                  defaultValue={detail.title}
                  key={`${selectedSlug}-title`}
                  disabled={busy}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== detail.title) void saveSectionMeta({ title: v });
                  }}
                />
              </label>
              <label className="ae-admin-field">
                Subtítulo
                <input
                  className="ae-input"
                  defaultValue={detail.subtitle ?? ""}
                  key={`${selectedSlug}-sub`}
                  disabled={busy}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (detail.subtitle ?? "")) void saveSectionMeta({ subtitle: v || null });
                  }}
                />
              </label>
              <label className="ae-admin-field">
                Máximo de cartões no site
                <input
                  type="number"
                  className="ae-input"
                  defaultValue={detail.maxTiles}
                  min={1}
                  max={24}
                  key={`${selectedSlug}-mx`}
                  disabled={busy}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 1 && n <= 24 && n !== detail.maxTiles) {
                      void saveSectionMeta({ maxTiles: Math.floor(n) });
                    }
                  }}
                />
              </label>
              <label className="ae-admin-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Activar no site</span>
                <input
                  type="checkbox"
                  defaultChecked={detail.active}
                  key={`${selectedSlug}-active`}
                  disabled={busy}
                  onChange={(e) => void saveSectionMeta({ active: e.target.checked })}
                />
              </label>
              <label className="ae-admin-field">
                Layout
                <select
                  className="ae-input"
                  value={detail.layout}
                  disabled={busy}
                  onChange={(e) => void saveSectionMeta({ layout: e.target.value })}
                >
                  <option value="GRID_2X2">Grelha larga</option>
                  <option value="HERO_THREE">Hero + 3</option>
                  <option value="ROW_SCROLL">Faixa horizontal</option>
                </select>
              </label>
              <label className="ae-admin-field">
                Cor de fundo dos cartões (opcional)
                <input
                  className="ae-input"
                  defaultValue={detail.cardAccent ?? ""}
                  key={`${selectedSlug}-acc`}
                  placeholder="#f8fafc ou transparent"
                  disabled={busy}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (detail.cardAccent ?? "")) void saveSectionMeta({ cardAccent: v || null });
                  }}
                />
              </label>
              <label className="ae-admin-field">
                Rótulo do botão de cabeçalho (opcional)
                <input
                  className="ae-input"
                  defaultValue={detail.ctaLabel ?? ""}
                  key={`${selectedSlug}-ctl`}
                  disabled={busy}
                  placeholder="Deixe vazio para ocultar o botão"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (detail.ctaLabel ?? "")) void saveSectionMeta({ ctaLabel: v || null });
                  }}
                />
              </label>
              <label className="ae-admin-field">
                Link do botão (com rótulo acima)
                <input
                  className="ae-input"
                  defaultValue={detail.ctaHref ?? ""}
                  key={`${selectedSlug}-cth`}
                  disabled={busy}
                  placeholder="/search?… ou https://…"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (detail.ctaHref ?? "")) void saveSectionMeta({ ctaHref: v || null });
                  }}
                />
              </label>
              <label className="ae-admin-field">
                Ordem entre vitrines
                <input
                  type="number"
                  className="ae-input"
                  defaultValue={detail.sortOrder}
                  key={`${selectedSlug}-ord`}
                  disabled={busy}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n !== detail.sortOrder) void saveSectionMeta({ sortOrder: Math.floor(n) });
                  }}
                />
              </label>
            </div>
          </div>

          <div className="ae-panel" style={{ marginTop: 20 }}>
            <h2 style={{ marginTop: 0 }}>Adicionar cartão</h2>
            <p className="ae-muted" style={{ marginTop: 0 }}>
              URL da imagem (<code>/uploads/…</code> após upload) e destino obrigatório. Texto curto opcional sobre a imagem.
            </p>
            <div className="ae-admin-form-grid">
              <label className="ae-admin-field">
                URL da imagem
                <input className="ae-input" value={tileImage} onChange={(e) => setTileImage(e.target.value)} placeholder="/uploads/… ou https://…" />
              </label>
              <label className="ae-admin-field">
                Destino (href)
                <input className="ae-input" value={tileHref} onChange={(e) => setTileHref(e.target.value)} placeholder="/search?categoryId=…" />
              </label>
              <label className="ae-admin-field">
                Rótulo no cartão (opcional)
                <input className="ae-input" value={tileLabel} onChange={(e) => setTileLabel(e.target.value)} />
              </label>
              <label className="ae-admin-field">
                Fundo da faixa de texto (opcional)
                <input className="ae-input" value={tileCaptionBg} onChange={(e) => setTileCaptionBg(e.target.value)} placeholder="#ffffffcc" />
              </label>
              <label className="ae-admin-field">
                Upload ficheiro
                <input type="file" accept="image/*" disabled={uploading || busy} onChange={(ev) => void onUploadTileImage(ev)} />
              </label>
            </div>
            <button type="button" className="btn btn-primary" disabled={busy || uploading} onClick={() => void addTile()}>
              {uploading ? "A carregar…" : "Adicionar cartão"}
            </button>
          </div>
        </>
      ) : null}

      <div className="ae-admin-table-wrap" style={{ marginTop: 20 }}>
        <h2 style={{ paddingLeft: 4 }}>Cartões ({detail?.tiles.length ?? 0})</h2>
        <table className="ae-admin-table">
          <thead>
            <tr>
              <th>Miniatura</th>
              <th>Destino</th>
              <th>Rótulo</th>
              <th>Ordem</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(detail?.tiles ?? []).map((t) => (
              <tr key={t.id}>
                <td>
                  {t.imageUrl ? (
                    <img className="ae-admin-cat-thumb" src={resolveMediaUrl(t.imageUrl)} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <div className="ae-admin-cat-thumb ae-admin-cat-thumb--ph" aria-hidden />
                  )}
                </td>
                <td className="ae-admin-cell-title">
                  <input
                    className="ae-input"
                    style={{ maxWidth: 320 }}
                    defaultValue={t.href}
                    key={`${t.id}-href`}
                    disabled={busy}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== t.href) void patchTile(t.id, { href: v });
                    }}
                  />
                </td>
                <td>
                  <input
                    className="ae-input"
                    defaultValue={t.label ?? ""}
                    key={`${t.id}-lbl`}
                    disabled={busy}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (t.label ?? "")) void patchTile(t.id, { label: v || null });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="ae-input"
                    style={{ width: 72 }}
                    defaultValue={t.sortOrder}
                    key={`${t.id}-ord`}
                    disabled={busy}
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n !== t.sortOrder) void patchTile(t.id, { sortOrder: Math.floor(n) });
                    }}
                  />
                </td>
                <td className="ae-admin-row-actions">
                  <button type="button" className="btn" disabled={busy} onClick={() => void deleteTile(t.id)}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {detail && !detail.tiles.length ? <p className="ae-muted" style={{ padding: 16 }}>Sem cartões — a vitrine não aparece no site até ter pelo menos um.</p> : null}
      </div>

      <p style={{ marginTop: 24 }} className="ae-muted">
        Voltar ao <Link to="/">site público</Link>.
      </p>
    </div>
  );
}
