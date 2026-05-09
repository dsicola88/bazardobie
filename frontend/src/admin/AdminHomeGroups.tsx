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

type ProductHit = {
  id: string;
  name: string;
  sku: string;
  images?: { url: string }[];
};

const SLUGS = ["SUPER_OFERTAS", "PRODUTOS_DESCONTO"] as const;

export default function AdminHomeGroups() {
  const { token } = useAuth();
  const [groups, setGroups] = useState<AdminGroupRow[] | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<(typeof SLUGS)[number]>("SUPER_OFERTAS");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersMeta, setMembersMeta] = useState<{ title: string; subtitle?: string | null } | null>(null);
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
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar grupos");
    }
  }, [token]);

  const loadMembers = useCallback(
    async (slug: string) => {
      if (!token) return;
      try {
        const data = await apiFetch<{ slug: string; title: string; subtitle?: string | null; members: MemberRow[] }>(
          `/admin/homepage-groups/${encodeURIComponent(slug)}/members`,
          { token },
        );
        setMembersMeta({ title: data.title, subtitle: data.subtitle });
        setMembers(data.members);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Erro ao carregar membros");
        setMembers([]);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (!token || !selectedSlug) return;
    void loadMembers(selectedSlug);
  }, [token, selectedSlug, loadMembers]);

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

  async function saveGroupMeta(patch: Partial<Pick<AdminGroupRow, "title" | "subtitle" | "active" | "maxDisplay" | "sortOrder">>) {
    if (!token) return;
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
      void loadMembers(selectedSlug);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setBusy(false);
    }
  }

  async function addPick() {
    if (!token || !pickId.trim()) return;
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
      void loadMembers(selectedSlug);
      void loadGroups();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível adicionar");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(productId: string) {
    if (!token) return;
    if (!window.confirm("Remover este produto da secção da página inicial?")) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/admin/homepage-groups/${encodeURIComponent(selectedSlug)}/products/${productId}`, {
        method: "DELETE",
        token,
      });
      setMsg("Produto retirado.");
      void loadMembers(selectedSlug);
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
          <h1 className="ae-admin-pro__title">Grupos na página inicial</h1>
          <p className="ae-admin-pro__sub">
            Curadoria estilo marketplace: associe produtos aos blocos públicos{' '}
            <strong>Super ofertas</strong> e <strong>Produtos com desconto</strong>. Os visitantes só vêem artigos activos e
            aprovados. Pesquise por nome ou SKU e clique para preencher o ID.
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
          {SLUGS.map((slug) => (
            <button
              key={slug}
              type="button"
              className={slug === selectedSlug ? "btn btn-primary" : "btn"}
              onClick={() => {
                setSelectedSlug(slug);
                setErr(null);
                setMsg(null);
              }}
              disabled={busy}
            >
              {slug === "SUPER_OFERTAS" ? "Super ofertas" : "Produtos com desconto"}
            </button>
          ))}
        </div>
        {activeGroup ? (
          <p className="ae-muted" style={{ marginTop: 10 }}>
            Secção <code className="ae-admin-mono">{activeGroup.slug}</code> · ordem administrativa {activeGroup.sortOrder} ·
            máximo público <strong>{activeGroup.maxDisplay}</strong> produtos ·{" "}
            {activeGroup.active ? <span className="ae-pill ae-pill--on">activo no site</span> : <span className="ae-pill ae-pill--off">pausado</span>} (
            {activeGroup.memberCount} configurados).
          </p>
        ) : null}
      </div>

      {activeGroup && membersMeta ? (
        <div className="ae-panel" style={{ marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>Título e comportamento público</h2>
          <div className="ae-admin-form-grid">
            <label className="ae-admin-field">
              Título
              <input
                className="ae-input"
                defaultValue={membersMeta.title}
                key={`${selectedSlug}-title`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== membersMeta.title) void saveGroupMeta({ title: v });
                }}
              />
            </label>
            <label className="ae-admin-field">
              Subtítulo opcional (texto de apoio)
              <input
                className="ae-input"
                defaultValue={membersMeta.subtitle ?? ""}
                key={`${selectedSlug}-sub`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (membersMeta.subtitle ?? "")) void saveGroupMeta({ subtitle: v || null });
                }}
              />
            </label>
            <label className="ae-admin-field">
              Produtos públicos máximos
              <input
                type="number"
                className="ae-input"
                defaultValue={activeGroup.maxDisplay}
                min={3}
                max={48}
                key={`${selectedSlug}-mx`}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 3 && n <= 48 && n !== activeGroup.maxDisplay) {
                    void saveGroupMeta({ maxDisplay: Math.floor(n) });
                  }
                }}
              />
            </label>
            <label className="ae-admin-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>Activar grupo no site público</span>
              <input
                type="checkbox"
                defaultChecked={activeGroup.active}
                key={`${selectedSlug}-active`}
                onChange={(e) => void saveGroupMeta({ active: e.target.checked })}
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="ae-panel" style={{ marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Adicionar produto ao grupo seleccionado</h2>
        <p className="ae-muted" style={{ marginTop: 0 }}>
          Pesquisa rápida pelo catálogo público ou cole um ID técnico.
        </p>
        <label className="ae-admin-field">
          Pesquisar
          <input
            className="ae-input"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="nome ou SKU"
          />
        </label>
        {hits.length ? (
          <div className="ae-admin-chip-row">
            {hits.map((h) => (
              <button key={h.id} type="button" className="btn" onClick={() => setPickId(h.id)} disabled={busy}>
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
            ID do produto a associar
            <input className="ae-input" value={pickId} onChange={(e) => setPickId(e.target.value)} placeholder="cuid…" />
          </label>
          <button type="button" className="btn btn-primary" disabled={busy || !pickId.trim()} onClick={() => void addPick()}>
            Adicionar ao grupo
          </button>
        </div>
      </div>

      <div className="ae-admin-table-wrap" style={{ marginTop: 20 }}>
        <h2 style={{ paddingLeft: 4 }}>Ordem configurada ({members.length})</h2>
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
            {members.map((m) => (
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
                    <span className="ae-pill ae-pill--off">filtro público pode ocultar</span>
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
        {!members.length ? <p className="ae-muted" style={{ padding: 16 }}>Ainda não há produtos neste grupo.</p> : null}
      </div>

      <p style={{ marginTop: 24 }} className="ae-muted">
        Voltar ao <Link to="/">site público</Link>.
      </p>
    </div>
  );
}
