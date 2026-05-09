import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { etiquetaEstadoPedidoCliente } from "../utils/buyerOrderFilters.js";
import { etiquetaGateway, etiquetaPagamento } from "../utils/paymentLabels.js";
import { AdminEmptyState } from "./ui/AdminEmptyState.js";
import { AdminErrorBanner } from "./ui/AdminErrorBanner.js";
import { AdminTableSkeleton } from "./ui/AdminTableSkeleton.js";

type OrderRow = {
  id: string;
  orderCode?: string | null;
  status: string;
  grandTotal: string;
  createdAt: string;
  paymentMethod: string;
  gatewayPayStatus?: string;
  user: { id: string; name: string; email: string };
  logisticsPartner?: { id: string; name: string } | null;
};

type OrderList = { items: OrderRow[]; total: number; skip: number; take: number };

type SortKey = "createdAt" | "grandTotal" | "status";

export default function AdminOrders() {
  const { token } = useAuth();
  const [data, setData] = useState<OrderList | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const PAGE = 80;

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    const params = new URLSearchParams({
      take: String(PAGE),
      skip: String(page * PAGE),
      sort,
      dir,
    });
    if (q.trim()) params.set("q", q.trim());
    void apiFetch<OrderList>(`/admin/orders?${params.toString()}`, { token })
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Erro ao carregar encomendas."))
      .finally(() => setLoading(false));
  }, [token, page, q, sort, dir]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSort(next: SortKey) {
    if (sort === next) {
      setDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(next);
      setDir(next === "createdAt" ? "desc" : "desc");
    }
    setPage(0);
  }

  function sortAria(k: SortKey): "none" | "ascending" | "descending" {
    if (sort !== k) return "none";
    return dir === "asc" ? "ascending" : "descending";
  }

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Todas as encomendas</h1>
          <p className="ae-admin-pro__sub">
            Monitorização transversal: filtros, ordenação por data, valor ou estado. Use o detalhe para intervenção e
            rastreio.
          </p>
        </div>
        <input
          type="search"
          className="ae-admin-filter-input"
          placeholder="Pesquisar por referência, id, comprador…"
          value={q}
          onChange={(e) => {
            setPage(0);
            setQ(e.target.value);
          }}
        />
      </header>
      {err ? <AdminErrorBanner message={err} onRetry={load} /> : null}
      {loading && !data ? <AdminTableSkeleton rows={10} cols={8} /> : null}
      {!loading && data && data.items.length === 0 ? (
        <AdminEmptyState
          title="Nenhuma encomenda encontrada"
          description={
            q.trim()
              ? "Ajuste o termo de pesquisa ou limpe o filtro para ver todas as encomendas."
              : "Ainda não há encomendas registadas na plataforma."
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
                  <th>ID</th>
                  <th>Comprador</th>
                  <th>
                    <button
                      type="button"
                      className="ae-admin-th-sort"
                      onClick={() => toggleSort("status")}
                      aria-sort={sortAria("status")}
                    >
                      Estado
                    </button>
                  </th>
                  <th>Pagamento</th>
                  <th>Última milha</th>
                  <th>
                    <button
                      type="button"
                      className="ae-admin-th-sort"
                      onClick={() => toggleSort("grandTotal")}
                      aria-sort={sortAria("grandTotal")}
                    >
                      Total
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="ae-admin-th-sort"
                      onClick={() => toggleSort("createdAt")}
                      aria-sort={sortAria("createdAt")}
                    >
                      Data
                    </button>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <code className="ae-admin-mono">{o.orderCode || `${o.id.slice(0, 12)}…`}</code>
                    </td>
                    <td>{o.user.name}</td>
                    <td>
                      <div>{etiquetaEstadoPedidoCliente(o.status)}</div>
                      <div className="ae-muted" style={{ fontSize: 11 }}>
                        <code className="ae-admin-mono">{o.status}</code>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <div>{etiquetaPagamento(o.paymentMethod)}</div>
                      {o.paymentMethod === "PAGAMENTO_ONLINE" && o.gatewayPayStatus ? (
                        <div className="ae-muted" style={{ fontSize: 11 }}>
                          {etiquetaGateway(o.gatewayPayStatus)}
                        </div>
                      ) : null}
                    </td>
                    <td className="ae-muted" style={{ fontSize: 12 }}>
                      {o.logisticsPartner?.name ?? "—"}
                    </td>
                    <td>{Number(o.grandTotal).toLocaleString("pt-AO")} Kz</td>
                    <td>{new Date(o.createdAt).toLocaleString("pt-AO")}</td>
                    <td>
                      <Link to={`/admin/orders/${o.id}`}>Detalhe</Link>
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
                  · Página <strong>{page + 1}</strong> / {Math.max(1, Math.ceil(data.total / PAGE))} ({PAGE} por
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
              disabled={!data.total || (page + 1) * PAGE >= data.total}
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
