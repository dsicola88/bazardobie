import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { formatKz } from "../utils/format.js";
import { resolveMediaUrl } from "../utils/media.js";
import { productConditionLabel } from "../utils/productCondition.js";

type Row = {
  id: string;
  name: string;
  sku: string;
  condition?: string | null;
  stock: number;
  soldCount: number;
  isActive: boolean;
  isFeatured: boolean;
  isDraft?: boolean;
  archivedAt?: string | null;
  moderationStatus?: string;
  displayPrice: string;
  images: { url: string }[];
  orderItemsCount?: number;
  canDelete?: boolean;
};

type MineList = { items: Row[]; total: number; skip: number; take: number };

type Scope = "active" | "archived" | "all";
type StockFilter = "a" | "l" | "o" | "d";

const PAGE_SIZE = 50;

export default function VendorProducts() {
  const { token } = useAuth();
  const location = useLocation();
  const nav = useNavigate();
  const [bundle, setBundle] = useState<MineList | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [qInput, setQInput] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [page, setPage] = useState(0);
  const [scope, setScope] = useState<Scope>("active");
  const [f, setF] = useState<StockFilter>("a");
  const [patchErr, setPatchErr] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftSku, setDraftSku] = useState("");
  const [draftPrice, setDraftPrice] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);

  useEffect(() => {
    const h = window.setTimeout(() => setQDeb(qInput.trim()), 360);
    return () => window.clearTimeout(h);
  }, [qInput]);

  useEffect(() => {
    setPage(0);
  }, [qDeb, scope]);

  useEffect(() => {
    if (scope === "archived" && f === "d") setF("a");
  }, [scope, f]);

  const load = useCallback(() => {
    if (!token) return Promise.resolve();
    setListErr(null);
    setListLoading(true);
    const qs = new URLSearchParams({
      take: String(PAGE_SIZE),
      skip: String(page * PAGE_SIZE),
      scope,
    });
    if (qDeb.length >= 1) qs.set("q", qDeb);
    return apiFetch<MineList>(`/vendor/products/mine?${qs}`, { token })
      .then(setBundle)
      .catch((e: unknown) => {
        setBundle(null);
        setListErr(e instanceof Error ? e.message : "Não foi possível carregar os seus produtos.");
      })
      .finally(() => setListLoading(false));
  }, [token, page, qDeb, scope]);

  useEffect(() => {
    if (!token) {
      setListLoading(false);
      return;
    }
    void load();
  }, [token, location.key, load]);

  const rows = useMemo(() => {
    const raw = bundle?.items ?? [];
    return raw.filter((p) => {
      if (f === "l" && !p.isActive) return false;
      if (f === "o" && p.isActive) return false;
      if (f === "d" && !p.isDraft) return false;
      return true;
    });
  }, [bundle, f]);

  const totalPages = bundle ? Math.max(1, Math.ceil(bundle.total / PAGE_SIZE)) : 1;

  async function patch(id: string, body: Record<string, unknown>) {
    setPatchErr(null);
    try {
      await apiFetch(`/vendor/products/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
      await load();
    } catch (e: unknown) {
      setPatchErr(e instanceof Error ? e.message : "Não foi possível actualizar o estado.");
    }
  }

  async function patchActive(id: string, isActive: boolean) {
    await patch(id, { isActive });
  }

  async function removeProduct(id: string) {
    setPatchErr(null);
    try {
      await apiFetch(`/vendor/products/${id}`, { method: "DELETE", token });
      await load();
    } catch (e: unknown) {
      setPatchErr(e instanceof Error ? e.message : "Não foi possível eliminar.");
    }
  }

  async function submitDraft() {
    setPatchErr(null);
    const price = Number(String(draftPrice).replace(",", "."));
    if (!draftName.trim() || !draftSku.trim() || !Number.isFinite(price) || price <= 0) {
      setPatchErr("Preencha nome, SKU e um preço válido para o rascunho.");
      return;
    }
    setDraftBusy(true);
    try {
      const created = await apiFetch<{ id: string }>(`/vendor/products/draft`, {
        method: "POST",
        token,
        body: JSON.stringify({
          name: draftName.trim(),
          sku: draftSku.trim(),
          price,
          stock: 0,
        }),
      });
      setDraftOpen(false);
      setDraftName("");
      setDraftSku("");
      setDraftPrice("");
      nav(`/vendor/products/${created.id}/edit`);
    } catch (e: unknown) {
      setPatchErr(e instanceof Error ? e.message : "Não foi possível criar o rascunho.");
    } finally {
      setDraftBusy(false);
    }
  }

  function modLabel(st?: string) {
    if (st === "APPROVED") return "Homologado";
    if (st === "REJECTED") return "Não aceite";
    return "Pendente de validação";
  }

  function modClass(st?: string) {
    if (st === "APPROVED") return "ae-badge--live";
    if (st === "REJECTED") return "ae-badge--off";
    return "ae-badge--pend";
  }

  const archived = (p: Row) => Boolean(p.archivedAt);

  return (
    <>
      <div className="ae-v-head">
        <div>
          <h1 className="ae-v-title">Catálogo de produtos</h1>
          <p className="ae-muted" style={{ margin: "4px 0 0", maxWidth: "42rem", lineHeight: 1.5 }}>
            Gestão do ciclo de vida: rascunhos, suspensão de venda, arquivo e eliminação segura (só sem encomendas).
            Novos artigos seguem validação da equipa.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={() => setDraftOpen(true)}>
            Novo rascunho
          </button>
          <Link to="/vendor/products/new" className="btn btn-primary">
            Nova referência completa
          </Link>
        </div>
      </div>

      {draftOpen ? (
        <div
          className="page-panel"
          style={{ marginBottom: 14, padding: 16, border: "1px solid var(--ae-line)", borderRadius: 8 }}
          role="dialog"
          aria-label="Criar rascunho"
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>Rascunho rápido</h2>
          <p className="ae-muted" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.45 }}>
            Cria uma referência mínima e complete imagens, descrição e envio no editor antes de activar a venda.
          </p>
          <div className="ae-field-grid-2" style={{ gap: 12 }}>
            <div>
              <label htmlFor="vd-name">Designação</label>
              <input id="vd-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="vd-sku">SKU (único na loja)</label>
              <input id="vd-sku" value={draftSku} onChange={(e) => setDraftSku(e.target.value)} />
            </div>
            <div>
              <label htmlFor="vd-price">Preço base (Kz)</label>
              <input id="vd-price" inputMode="decimal" value={draftPrice} onChange={(e) => setDraftPrice(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" disabled={draftBusy} onClick={() => void submitDraft()}>
              {draftBusy ? "A criar…" : "Criar e editar ficha"}
            </button>
            <button type="button" className="btn" disabled={draftBusy} onClick={() => setDraftOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="page-panel"
        style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      >
        <input
          placeholder="Pesquisar por designação ou SKU (servidor)…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          style={{ flex: "1 200px", padding: "8px 10px", borderRadius: 4, border: "1px solid var(--ae-line)" }}
        />
        <div className="ae-sort" title="Lista devolvida pela API">
          {(
            [
              ["active", "Catálogo activo"],
              ["archived", "Arquivados"],
              ["all", "Todos"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={scope === k ? "ae-on" : ""} onClick={() => setScope(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="ae-sort" title="Filtro local na página actual">
          {(
            [
              ["a", "Sem filtro"],
              ["l", "Activos"],
              ["o", "Inactivos"],
              ...(scope === "archived" ? [] : ([["d", "Rascunhos"]] as const)),
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={f === k ? "ae-on" : ""} onClick={() => setF(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {!listLoading && bundle != null ? (
        <p className="ae-muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
          Total ({scope === "active" ? "não arquivados" : scope === "archived" ? "arquivados" : "geral"}):{" "}
          <strong>{bundle.total}</strong>
          {bundle.total ? (
            <>
              {" "}
              · Página <strong>{page + 1}</strong> / {totalPages} ({PAGE_SIZE} por página)
            </>
          ) : null}
        </p>
      ) : null}

      {!listLoading && bundle != null && bundle.total > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button type="button" className="btn" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            ← Anterior
          </button>
          <button
            type="button"
            className="btn"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Seguinte →
          </button>
        </div>
      ) : null}

      {listLoading ? <p className="ae-muted">A carregar produtos…</p> : null}
      {listErr ? (
        <p className="ae-admin-alert ae-admin-alert--err" role="alert">
          {listErr} Se acabou de criar a loja, confirme que o nível 1 está completo e que a conta tem permissão de
          vendedor.
        </p>
      ) : null}
      {patchErr ? (
        <p className="ae-admin-alert ae-admin-alert--err" role="alert">
          {patchErr}
        </p>
      ) : null}
      <div className="ae-table-wrap">
        <table className="ae-data-table">
          <thead>
            <tr>
              <th>Designação</th>
              <th>SKU</th>
              <th>Condição</th>
              <th>Preço corrente</th>
              <th>Existências</th>
              <th>Vendas</th>
              <th>Validação</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <img
                    src={resolveMediaUrl(p.images[0]?.url)}
                    alt=""
                    width={44}
                    height={44}
                    style={{ borderRadius: 4, objectFit: "cover" }}
                  />
                  <span>{p.name}</span>
                </td>
                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{p.sku}</td>
                <td>{productConditionLabel(p.condition)}</td>
                <td>{formatKz(p.displayPrice)}</td>
                <td>{p.stock}</td>
                <td>{p.soldCount}</td>
                <td>
                  <span className={`ae-badge ${modClass(p.moderationStatus)}`}>{modLabel(p.moderationStatus)}</span>
                </td>
                <td>
                  <span className={`ae-badge ${p.isActive ? "ae-badge--live" : "ae-badge--off"}`}>
                    {archived(p) ? "Arquivado" : p.isDraft ? "Rascunho" : p.isActive ? "Activo na vitrine" : "Indisponível"}
                  </span>
                  {p.isFeatured ? (
                    <span className="ae-badge ae-badge--feat" style={{ marginLeft: 4 }}>
                      Destaque
                    </span>
                  ) : null}
                </td>
                <td style={{ whiteSpace: "normal", maxWidth: 280 }}>
                  {!archived(p) ? (
                    <Link
                      to={`/vendor/products/${p.id}/edit`}
                      className="ae-mini-btn"
                      style={{ textDecoration: "none", display: "inline-block", marginRight: 6, marginBottom: 4 }}
                    >
                      Editar ficha
                    </Link>
                  ) : (
                    <span className="ae-muted" style={{ fontSize: 12, display: "inline-block", marginRight: 8 }}>
                      Edição bloqueada até desarquivar
                    </span>
                  )}
                  {!archived(p) ? (
                    <button
                      type="button"
                      className="ae-mini-btn"
                      style={{ marginRight: 6, marginBottom: 4 }}
                      disabled={p.isDraft}
                      title={p.isDraft ? "Complete a ficha antes de activar a venda" : undefined}
                      onClick={() => void patchActive(p.id, !p.isActive)}
                    >
                      {p.isActive ? "Suspender venda" : "Activar venda"}
                    </button>
                  ) : null}
                  {!archived(p) ? (
                    <button
                      type="button"
                      className="ae-mini-btn"
                      style={{ marginRight: 6, marginBottom: 4 }}
                      onClick={() => void patch(p.id, { archived: true })}
                    >
                      Arquivar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ae-mini-btn"
                      style={{ marginRight: 6, marginBottom: 4 }}
                      onClick={() => void patch(p.id, { archived: false })}
                    >
                      Restaurar do arquivo
                    </button>
                  )}
                  {p.canDelete ? (
                    <button
                      type="button"
                      className="ae-mini-btn"
                      style={{ marginBottom: 4 }}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Eliminar permanentemente esta referência? Não pode haver encomendas associadas.",
                          )
                        )
                          void removeProduct(p.id);
                      }}
                    >
                      Eliminar
                    </button>
                  ) : (
                    <span className="ae-muted" style={{ fontSize: 11, display: "block" }}>
                      Com histórico de encomenda — não pode eliminar
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!listLoading && !listErr && bundle?.total === 0 ? (
          <div className="ae-empty-center">
            Não existem referências neste critério{qDeb ? " de pesquisa" : ""}. Experimente outra vista ou crie uma nova
            ficha.
          </div>
        ) : null}
        {!listLoading && bundle != null && bundle.total > 0 && rows.length === 0 ? (
          <div className="ae-empty-center ae-muted">
            Nenhuma linha corresponde aos filtros locais nesta página. Mude de página ou ajuste Activos / Inactivos /
            Rascunhos.
          </div>
        ) : null}
      </div>
    </>
  );
}
