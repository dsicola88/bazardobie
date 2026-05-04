import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { formatKz } from "../utils/format.js";

type Row = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  soldCount: number;
  isActive: boolean;
  isFeatured: boolean;
  moderationStatus?: string;
  displayPrice: string;
  images: { url: string }[];
};

type MineList = { items: Row[]; total: number; skip: number; take: number };

const PAGE_SIZE = 50;

export default function VendorProducts() {
  const { token } = useAuth();
  const location = useLocation();
  const [bundle, setBundle] = useState<MineList | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [qInput, setQInput] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [page, setPage] = useState(0);
  const [f, setF] = useState<"a" | "l" | "o">("a");
  const [patchErr, setPatchErr] = useState<string | null>(null);

  useEffect(() => {
    const h = window.setTimeout(() => setQDeb(qInput.trim()), 360);
    return () => window.clearTimeout(h);
  }, [qInput]);

  useEffect(() => {
    setPage(0);
  }, [qDeb]);

  const load = useCallback(() => {
    if (!token) return Promise.resolve();
    setListErr(null);
    setListLoading(true);
    const qs = new URLSearchParams({
      take: String(PAGE_SIZE),
      skip: String(page * PAGE_SIZE),
    });
    if (qDeb.length >= 1) qs.set("q", qDeb);
    return apiFetch<MineList>(`/vendor/products/mine?${qs}`, { token })
      .then(setBundle)
      .catch((e: unknown) => {
        setBundle(null);
        setListErr(e instanceof Error ? e.message : "Não foi possível carregar os seus produtos.");
      })
      .finally(() => setListLoading(false));
  }, [token, page, qDeb]);

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
      return true;
    });
  }, [bundle, f]);

  const totalPages = bundle ? Math.max(1, Math.ceil(bundle.total / PAGE_SIZE)) : 1;

  async function patch(id: string, isActive: boolean) {
    setPatchErr(null);
    try {
      await apiFetch(`/vendor/products/${id}`, { method: "PATCH", token, body: JSON.stringify({ isActive }) });
      await load();
    } catch (e: unknown) {
      setPatchErr(e instanceof Error ? e.message : "Não foi possível actualizar o estado.");
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

  return (
    <>
      <div className="ae-v-head">
        <div>
          <h1 className="ae-v-title">Catálogo de produtos</h1>
          <p className="ae-muted" style={{ margin: "4px 0 0", maxWidth: "40rem", lineHeight: 1.5 }}>
            Visão consolidada das suas referências, estados de validação e disponibilidade na vitrine. A pesquisa e a
            paginação comunicam com o servidor (suporta catálogos grandes). Novos artigos permanecem sob escrutínio até
            homologação.
          </p>
        </div>
        <Link to="/vendor/products/new" className="btn btn-primary">
          Nova referência
        </Link>
      </div>
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
        <div className="ae-sort">
          {(
            [
              ["a", "Todos"],
              ["l", "Activos"],
              ["o", "Inactivos"],
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
          Total na loja: <strong>{bundle.total}</strong>
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
                    src={p.images[0]?.url}
                    alt=""
                    width={44}
                    height={44}
                    style={{ borderRadius: 4, objectFit: "cover" }}
                  />
                  <span>{p.name}</span>
                </td>
                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{p.sku}</td>
                <td>{formatKz(p.displayPrice)}</td>
                <td>{p.stock}</td>
                <td>{p.soldCount}</td>
                <td>
                  <span className={`ae-badge ${modClass(p.moderationStatus)}`}>{modLabel(p.moderationStatus)}</span>
                </td>
                <td>
                  <span className={`ae-badge ${p.isActive ? "ae-badge--live" : "ae-badge--off"}`}>
                    {p.isActive ? "Activo na vitrine" : "Indisponível para venda"}
                  </span>
                  {p.isFeatured ? (
                    <span className="ae-badge ae-badge--feat" style={{ marginLeft: 4 }}>
                      Destaque
                    </span>
                  ) : null}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link
                    to={`/vendor/products/${p.id}/edit`}
                    className="ae-mini-btn"
                    style={{ textDecoration: "none", display: "inline-block", marginRight: 6 }}
                  >
                    Editar ficha
                  </Link>
                  <button type="button" className="ae-mini-btn" onClick={() => void patch(p.id, !p.isActive)}>
                    {p.isActive ? "Suspender venda" : "Activar venda"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!listLoading && !listErr && bundle?.total === 0 ? (
          <div className="ae-empty-center">
            Não existem referências registadas{qDeb ? " com este critério" : ""}. Utilize «Nova referência» para criar a
            primeira ficha de produto.
          </div>
        ) : null}
        {!listLoading && bundle != null && bundle.total > 0 && rows.length === 0 ? (
          <div className="ae-empty-center ae-muted">
            Nenhuma referência nesta página corresponde ao filtro Activos/Inactivos. Mude de página ou ajuste os filtros.
          </div>
        ) : null}
      </div>
    </>
  );
}
