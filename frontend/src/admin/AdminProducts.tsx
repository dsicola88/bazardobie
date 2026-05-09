import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { isPlatformAdmin } from "./adminAccess.js";
import { AdminEmptyState } from "./ui/AdminEmptyState.js";
import { AdminErrorBanner } from "./ui/AdminErrorBanner.js";
import { AdminTableSkeleton } from "./ui/AdminTableSkeleton.js";
import { productConditionLabel } from "../utils/productCondition.js";

type ModItem = {
  id: string;
  name: string;
  createdAt?: string;
  condition?: string | null;
  moderationStatus: string;
  isActive: boolean;
  isFeatured: boolean;
  shop: { id: string; name: string; userId: string };
};

type ModList = { items: ModItem[]; total: number; skip?: number; take?: number };

const MOD_PAGE = 50;

function parseStatus(raw: string | null): "PENDING" | "APPROVED" | "REJECTED" {
  if (raw === "APPROVED" || raw === "REJECTED" || raw === "PENDING") return raw;
  return "PENDING";
}

export default function AdminProducts() {
  const { token, user } = useAuth();
  const canFeature = isPlatformAdmin(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const status = useMemo(() => parseStatus(searchParams.get("status")), [searchParams]);

  const setStatus = useCallback(
    (s: "PENDING" | "APPROVED" | "REJECTED") => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("status", s);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [sort, setSort] = useState<"createdAt" | "name">("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [data, setData] = useState<ModList | null>(null);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const skip = page * MOD_PAGE;
      const qs = new URLSearchParams({
        status,
        take: String(MOD_PAGE),
        skip: String(skip),
        sort,
        dir,
      });
      if (q.trim()) qs.set("q", q.trim());
      const resp = await apiFetch<ModList>(`/admin/products/moderation?${qs.toString()}`, { token });
      setData(resp);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar produtos.");
    } finally {
      setLoading(false);
    }
  }, [token, status, page, q, sort, dir]);

  useEffect(() => {
    setPage(0);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSort(next: "createdAt" | "name") {
    if (sort === next) {
      setDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(next);
      setDir(next === "name" ? "asc" : "desc");
    }
    setPage(0);
  }

  function sortAria(k: "createdAt" | "name"): "none" | "ascending" | "descending" {
    if (sort !== k) return "none";
    return dir === "asc" ? "ascending" : "descending";
  }

  async function moderate(id: string, s: "APPROVED" | "REJECTED") {
    if (!token) return;
    setMsg(null);
    try {
      await apiFetch(`/admin/products/${id}/moderation`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: s }),
      });
      setMsg(s === "APPROVED" ? "Produto aprovado e visível na loja." : "Produto rejeitado.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function featured(id: string, isFeatured: boolean) {
    if (!token) return;
    setMsg(null);
    try {
      await apiFetch(`/admin/products/${id}/featured`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ isFeatured }),
      });
      setMsg(isFeatured ? "Produto destacado na página inicial." : "Destaque removido.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function active(id: string, isActive: boolean) {
    if (!token) return;
    try {
      await apiFetch(`/admin/products/${id}/active`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ isActive }),
      });
      setMsg(isActive ? "Produto reactivado." : "Produto desactivado (removido da venda).");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Produtos e moderação</h1>
          <p className="ae-admin-pro__sub">
            Novos anúncios entram na fila <strong>PENDING</strong>. O URL reflecte o separador (pode partilhar o link da
            fila). Ordenação por data de criação ou nome.
          </p>
        </div>
      </header>
      {err ? <AdminErrorBanner message={err} onRetry={() => void load()} /> : null}
      {msg ? (
        <div className="ae-admin-alert ae-admin-alert--ok" role="status">
          {msg}
        </div>
      ) : null}
      <div className="ae-admin-toolbar">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button key={s} type="button" className={status === s ? "btn btn-primary" : "btn"} onClick={() => setStatus(s)}>
            {s === "PENDING" ? "Em fila" : s === "APPROVED" ? "Aprovados" : "Rejeitados"}
          </button>
        ))}
        <input
          className="ae-admin-filter-input"
          placeholder="Filtrar por produto, SKU ou loja…"
          value={q}
          onChange={(e) => {
            setPage(0);
            setQ(e.target.value);
          }}
        />
      </div>
      {loading && !data ? <AdminTableSkeleton rows={10} cols={6} /> : null}
      {!loading && data && data.items.length === 0 ? (
        <AdminEmptyState
          title="Nenhum produto nesta vista"
          description={
            q.trim()
              ? "Não há resultados para o filtro actual. Limpe a pesquisa ou mude de separador."
              : "Ainda não existem produtos com este estado de moderação."
          }
          action={
            q.trim() ? (
              <button type="button" className="btn" onClick={() => setQ("")}>
                Limpar pesquisa
              </button>
            ) : null
          }
        />
      ) : null}
      {data && data.items.length > 0 ? (
        <>
          <div className="ae-admin-table-wrap">
            <table className="ae-admin-table">
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      className="ae-admin-th-sort"
                      onClick={() => toggleSort("name")}
                      aria-sort={sortAria("name")}
                    >
                      Produto
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="ae-admin-th-sort"
                      onClick={() => toggleSort("createdAt")}
                      aria-sort={sortAria("createdAt")}
                    >
                      Entrada
                    </button>
                  </th>
                  <th>Condição</th>
                  <th>Loja</th>
                  <th>Estado</th>
                  <th>Acções</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="ae-admin-cell-title">{p.name}</td>
                    <td className="ae-muted" style={{ fontSize: 13 }}>
                      {p.createdAt ? new Date(p.createdAt).toLocaleString("pt-AO") : "—"}
                    </td>
                    <td>{productConditionLabel(p.condition)}</td>
                    <td>{p.shop.name}</td>
                    <td>
                      {p.moderationStatus} · {p.isActive ? "activo" : "inactivo"}
                      {p.isFeatured ? " · destacado" : ""}
                    </td>
                    <td className="ae-admin-row-actions">
                      {p.moderationStatus === "PENDING" && (
                        <>
                          <button type="button" className="btn btn-primary" onClick={() => void moderate(p.id, "APPROVED")}>
                            Aprovar
                          </button>
                          <button type="button" className="btn" onClick={() => void moderate(p.id, "REJECTED")}>
                            Rejeitar
                          </button>
                        </>
                      )}
                      {p.moderationStatus === "APPROVED" && (
                        <>
                          {canFeature ? (
                            <button type="button" className="btn" onClick={() => void featured(p.id, !p.isFeatured)}>
                              {p.isFeatured ? "Tirar destaque" : "Destacar"}
                            </button>
                          ) : null}
                          <button type="button" className="btn" onClick={() => void active(p.id, !p.isActive)}>
                            {p.isActive ? "Desactivar" : "Reactivar"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ae-admin-pager">
            <p className="ae-muted" style={{ margin: 0 }}>
              Total na base: <strong>{data.total}</strong>
              {data.total ? (
                <>
                  {" "}
                  · Página <strong>{page + 1}</strong> / {Math.max(1, Math.ceil(data.total / MOD_PAGE))} ({MOD_PAGE} por
                  página)
                </>
              ) : null}
            </p>
            <button type="button" className="btn" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              ← Anterior
            </button>
            <button
              type="button"
              className="btn"
              disabled={!data.total || (page + 1) * MOD_PAGE >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Seguinte →
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
