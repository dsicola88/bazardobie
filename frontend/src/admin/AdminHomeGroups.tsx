import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { resolveMediaUrl } from "../utils/media.js";

type AdminGroupRow = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  sortOrder: number;
  active: boolean;
  maxDisplay: number;
  layoutStyle: string;
  badgeType: string;
  badgeText?: string | null;
  badgeEndAt?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  productCardEmphasis: string;
  memberCount: number;
  updatedAt: string;
};

type MemberRow = {
  membershipId: string;
  sortOrder: number;
  product: {
    id: string;
    name: string;
    sku: string;
    isActive: boolean;
    moderationStatus: string;
    displayPrice: string;
    shop: { name: string };
    images: { url: string }[];
  };
};

type GroupDetail = {
  slug: string;
  title: string;
  subtitle?: string | null;
  layoutStyle: string;
  badgeType: string;
  badgeText?: string | null;
  badgeEndAt?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  productCardEmphasis: string;
  members: MemberRow[];
};

type ProductHit = {
  id: string;
  name: string;
  sku: string;
  images?: { url: string }[];
};

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminHomeGroups() {
  const { token } = useAuth();
  const [groups, setGroups] = useState<AdminGroupRow[] | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickId, setPickId] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [searchQ, setSearchQ] = useState("");

  const loadGroups = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<{ groups: AdminGroupRow[] }>("/admin/homepage-groups", { token });
      setGroups(res.groups);
      setSelectedSlug((prev) => {
        if (prev && res.groups.some((g) => g.slug === prev)) return prev;
        return res.groups[0]?.slug ?? null;
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar grupos");
    }
  }, [token]);

  const loadDetail = useCallback(
    async (slug: string) => {
      if (!token) return;
      try {
        const data = await apiFetch<GroupDetail>(`/admin/homepage-groups/${encodeURIComponent(slug)}/members`, {
          token,
        });
        setDetail(data);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Erro ao carregar membros");
        setDetail(null);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (!token || !selectedSlug) return;
    void loadDetail(selectedSlug);
  }, [token, selectedSlug, loadDetail]);

  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void apiFetch<{ items: ProductHit[] }>(`/products?q=${encodeURIComponent(q)}&take=12`).then(setHits).catch(() => setHits([]));
    }, 320);
    return () => window.clearTimeout(handle);
  }, [searchQ]);

  const activeGroup = groups?.find((g) => g.slug === selectedSlug);

  async function saveGroupMeta(patch: Record<string, unknown>) {
    if (!token || !selectedSlug) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/admin/homepage-groups/${encodeURIComponent(selectedSlug)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      setMsg("Grupo actualizado.");
      void loadGroups();
      void loadDetail(selectedSlug);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setBusy(false);
    }
  }

  async function addPick() {
    if (!token || !pickId.trim() || !selectedSlug) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/admin/homepage-groups/${encodeURIComponent(selectedSlug)}/products`, {
        method: "POST",
        token,
        body: JSON.stringify({ productId: pickId.trim() }),
      });
      setMsg("Produto adicionado ao grupo.");
      setPickId("");
      setSearchQ("");
      setHits([]);
      void loadDetail(selectedSlug);
      void loadGroups();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível adicionar");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(productId: string) {
    if (!token || !selectedSlug) return;
    if (!window.confirm("Remover este produto da secção da página inicial?")) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/admin/homepage-groups/${encodeURIComponent(selectedSlug)}/products/${productId}`, {
        method: "DELETE",
        token,
      });
      setMsg("Produto retirado.");
      void loadDetail(selectedSlug);
      void loadGroups();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível remover");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Grupos e vitrines na página inicial</h1>
          <p className="ae-admin-pro__sub">
            Estilo marketplace profissional: escolha entre grelha clássica ou vitrine em carrossel (tipo grandes
            marketplaces), pastilhas de texto ou contagem regressiva, destaque em desconto ou avaliações, e destino do botão
            «Ver mais». Administradores e equipa de <strong>suporte</strong> podem editar; só aparecem produtos activos e
            aprovados.
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
        <h2 style={{ marginTop: 0 }}>Seleccionar grupo</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(groups ?? []).map((g) => (
            <button
              key={g.slug}
              type="button"
              className={g.slug === selectedSlug ? "btn btn-primary" : "btn"}
              onClick={() => {
                setSelectedSlug(g.slug);
                setErr(null);
                setMsg(null);
              }}
              disabled={busy}
            >
              {g.title}
            </button>
          ))}
        </div>
        {activeGroup ? (
          <p className="ae-muted" style={{ marginTop: 10 }}>
            Slug <code className="ae-admin-mono">{activeGroup.slug}</code> · ordem {activeGroup.sortOrder} · máximo{" "}
            <strong>{activeGroup.maxDisplay}</strong> na vitrine ·{" "}
            {activeGroup.active ? <span className="ae-pill ae-pill--on">activo</span> : <span className="ae-pill ae-pill--off">pausado</span>}{" "}
            ({activeGroup.memberCount} produtos).
          </p>
        ) : null}
      </div>

      {activeGroup && detail ? (
        <>
          <div className="ae-panel" style={{ marginTop: 20 }}>
            <h2 style={{ marginTop: 0 }}>Textos públicos</h2>
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
                    if (v && v !== detail.title) void saveGroupMeta({ title: v });
                  }}
                />
              </label>
              <label className="ae-admin-field">
                Subtítulo opcional
                <input
                  className="ae-input"
                  defaultValue={detail.subtitle ?? ""}
                  key={`${selectedSlug}-sub`}
                  disabled={busy}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (detail.subtitle ?? "")) void saveGroupMeta({ subtitle: v || null });
                  }}
                />
              </label>
              <label className="ae-admin-field">
                Máximo de produtos na vitrine
                <input
                  type="number"
                  className="ae-input"
                  defaultValue={activeGroup.maxDisplay}
                  min={3}
                  max={48}
                  key={`${selectedSlug}-mx`}
                  disabled={busy}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 3 && n <= 48 && n !== activeGroup.maxDisplay) {
                      void saveGroupMeta({ maxDisplay: Math.floor(n) });
                    }
                  }}
                />
              </label>
              <label className="ae-admin-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Activar no site</span>
                <input
                  type="checkbox"
                  defaultChecked={activeGroup.active}
                  key={`${selectedSlug}-active`}
                  disabled={busy}
                  onChange={(e) => void saveGroupMeta({ active: e.target.checked })}
                />
              </label>
            </div>
          </div>

          <div className="ae-panel" style={{ marginTop: 20 }}>
            <h2 style={{ marginTop: 0 }}>Layout e vitrine (estilo marketplace)</h2>
            <div className="ae-admin-form-grid">
              <label className="ae-admin-field">
                Modo de apresentação
                <select
                  className="ae-input"
                  value={detail.layoutStyle}
                  disabled={busy}
                  onChange={(e) => void saveGroupMeta({ layoutStyle: e.target.value })}
                >
                  <option value="GRID">Grelha (várias colunas)</option>
                  <option value="SHOWCASE">Vitrine em carrossel (recomendado)</option>
                </select>
              </label>
              <label className="ae-admin-field">
                Destaque nos cartões
                <select
                  className="ae-input"
                  value={detail.productCardEmphasis}
                  disabled={busy}
                  onChange={(e) => void saveGroupMeta({ productCardEmphasis: e.target.value })}
                >
                  <option value="BALANCED">Equilibrado (rating + desconto)</option>
                  <option value="DISCOUNT">Desconto em evidência (−X%)</option>
                  <option value="RATING">Avaliações e vendas</option>
                </select>
              </label>
              <label className="ae-admin-field">
                Pastilha acima do carrossel
                <select
                  className="ae-input"
                  value={detail.badgeType}
                  disabled={busy}
                  onChange={(e) => void saveGroupMeta({ badgeType: e.target.value })}
                >
                  <option value="NONE">Nenhuma</option>
                  <option value="TEXT">Texto promocional (laranja)</option>
                  <option value="TIMER">Contagem regressiva (vermelho)</option>
                </select>
              </label>
              <label className="ae-admin-field">
                Texto da pastilha (se «Texto»)
                <input
                  className="ae-input"
                  defaultValue={detail.badgeText ?? ""}
                  key={`${selectedSlug}-bt`}
                  disabled={busy}
                  placeholder="Ex.: 3 artigos a partir de 15 000 Kz"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (detail.badgeText ?? "")) void saveGroupMeta({ badgeText: v || null });
                  }}
                />
              </label>
              <label className="ae-admin-field">
                Fim da promoção (se «Contagem») — hora local
                <input
                  type="datetime-local"
                  className="ae-input"
                  defaultValue={toDatetimeLocalValue(detail.badgeEndAt)}
                  key={`${selectedSlug}-be-${detail.badgeEndAt ?? "x"}`}
                  disabled={busy}
                  onBlur={(e) => {
                    const raw = e.target.value;
                    if (!raw) {
                      if (detail.badgeEndAt) void saveGroupMeta({ badgeEndAt: null });
                      return;
                    }
                    const d = new Date(raw);
                    if (!Number.isFinite(d.getTime())) return;
                    void saveGroupMeta({ badgeEndAt: d.toISOString() });
                  }}
                />
              </label>
              <label className="ae-admin-field">
                Rótulo do botão «Ver mais»
                <input
                  className="ae-input"
                  defaultValue={detail.ctaLabel ?? ""}
                  key={`${selectedSlug}-ctl`}
                  disabled={busy}
                  placeholder="Ex.: Ver todas as promoções"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (detail.ctaLabel ?? "")) void saveGroupMeta({ ctaLabel: v || null });
                  }}
                />
              </label>
              <label className="ae-admin-field">
                Link do botão (caminho ou https://…)
                <input
                  className="ae-input"
                  defaultValue={detail.ctaHref ?? ""}
                  key={`${selectedSlug}-cth`}
                  disabled={busy}
                  placeholder="/search?onSale=true ou URL completa"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (detail.ctaHref ?? "")) void saveGroupMeta({ ctaHref: v || null });
                  }}
                />
              </label>
            </div>
          </div>
        </>
      ) : null}

      <div className="ae-panel" style={{ marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Adicionar produto ao grupo seleccionado</h2>
        <p className="ae-muted" style={{ marginTop: 0 }}>
          Pesquisa pelo catálogo ou cole um ID.
        </p>
        <label className="ae-admin-field">
          Pesquisar
          <input
            className="ae-input"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="nome ou SKU"
            disabled={!selectedSlug}
          />
        </label>
        {hits.length ? (
          <div className="ae-admin-chip-row">
            {hits.map((h) => (
              <button key={h.id} type="button" className="btn" onClick={() => setPickId(h.id)} disabled={busy || !selectedSlug}>
                {h.images?.[0]?.url ? (
                  <img
                    src={resolveMediaUrl(h.images[0].url)}
                    alt=""
                    width={28}
                    height={28}
                    style={{ marginRight: 8, verticalAlign: "middle", borderRadius: 6 }}
                  />
                ) : null}
                <span>{h.name}</span>
                <code style={{ marginLeft: 8, fontSize: 11 }}>{h.id}</code>
              </button>
            ))}
          </div>
        ) : null}
        <div className="ae-admin-form-grid" style={{ alignItems: "flex-end" }}>
          <label className="ae-admin-field">
            ID do produto
            <input
              className="ae-input"
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
              placeholder="cuid…"
              disabled={!selectedSlug}
            />
          </label>
          <button type="button" className="btn btn-primary" disabled={busy || !pickId.trim() || !selectedSlug} onClick={() => void addPick()}>
            Adicionar ao grupo
          </button>
        </div>
      </div>

      <div className="ae-admin-table-wrap" style={{ marginTop: 20 }}>
        <h2 style={{ paddingLeft: 4 }}>Ordem ({detail?.members.length ?? 0})</h2>
        <table className="ae-admin-table">
          <thead>
            <tr>
              <th>Miniatura</th>
              <th>Produto</th>
              <th>Loja</th>
              <th>Preço exibido</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(detail?.members ?? []).map((m) => (
              <tr key={m.membershipId}>
                <td>
                  {m.product.images[0]?.url ? (
                    <img
                      className="ae-admin-cat-thumb"
                      src={resolveMediaUrl(m.product.images[0].url)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="ae-admin-cat-thumb ae-admin-cat-thumb--ph" aria-hidden />
                  )}
                </td>
                <td className="ae-admin-cell-title">
                  {m.product.name}{" "}
                  <Link to={`/product/${m.product.id}`} target="_blank" rel="noopener noreferrer">
                    ver
                  </Link>
                  <div>
                    <code className="ae-admin-mono" style={{ fontSize: 11 }}>
                      {m.product.id}
                    </code>
                  </div>
                </td>
                <td>{m.product.shop.name}</td>
                <td>{m.product.displayPrice} Kz</td>
                <td>
                  {m.product.isActive && m.product.moderationStatus === "APPROVED" ? (
                    <span className="ae-pill ae-pill--on">ok</span>
                  ) : (
                    <span className="ae-pill ae-pill--off">filtro público</span>
                  )}
                </td>
                <td className="ae-admin-row-actions">
                  <button type="button" className="btn" disabled={busy} onClick={() => void removeMember(m.product.id)}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {detail && !detail.members.length ? <p className="ae-muted" style={{ padding: 16 }}>Ainda não há produtos neste grupo.</p> : null}
      </div>

      <p style={{ marginTop: 24 }} className="ae-muted">
        Voltar ao <Link to="/">site público</Link>.
      </p>
    </div>
  );
}
