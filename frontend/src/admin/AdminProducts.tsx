import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { productConditionLabel } from "../utils/productCondition.js";

type ModItem = {
  id: string;
  name: string;
  condition?: string | null;
  moderationStatus: string;
  isActive: boolean;
  isFeatured: boolean;
  shop: { id: string; name: string; userId: string };
};

type ModList = { items: ModItem[]; total: number; skip?: number; take?: number };

const MOD_PAGE = 50;

export default function AdminProducts() {
  const { token } = useAuth();
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [data, setData] = useState<ModList | null>(null);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const skip = page * MOD_PAGE;
      const query = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : "";
      const resp = await apiFetch<ModList>(
        `/admin/products/moderation?status=${status}&take=${MOD_PAGE}&skip=${skip}${query}`,
        { token },
      );
      setData(resp);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }, [token, status, page, q]);

  useEffect(() => {
    setPage(0);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

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
            Novos anúncios ficam em <strong>PENDING</strong> até revisão operacional. A loja pública e a pesquisa mostram
            apenas itens <strong>APPROVED</strong> com parceiro aprovado e dados comerciais completos.
          </p>
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
      <div className="ae-admin-toolbar">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button key={s} type="button" className={status === s ? "btn btn-primary" : "btn"} onClick={() => setStatus(s)}>
            {s === "PENDING" ? "Em fila" : s === "APPROVED" ? "Aprovados" : "Rejeitados"}
          </button>
        ))}
        <input
          className="ae-admin-filter-input"
          placeholder="Filtrar por produto, SKU ou loja..."
          value={q}
          onChange={(e) => {
            setPage(0);
            setQ(e.target.value);
          }}
        />
      </div>
      <div className="ae-admin-table-wrap">
        <table className="ae-admin-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Condição</th>
              <th>Loja</th>
              <th>Estado</th>
              <th>Acções</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td className="ae-admin-cell-title">{p.name}</td>
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
                      <button type="button" className="btn" onClick={() => void featured(p.id, !p.isFeatured)}>
                        {p.isFeatured ? "Tirar destaque" : "Destacar"}
                      </button>
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
          Total na base: <strong>{data?.total ?? 0}</strong>
          {data?.total ? (
            <>
              {" "}
              · Página <strong>{page + 1}</strong> /{" "}
              {Math.max(1, Math.ceil((data?.total ?? 0) / MOD_PAGE))} ({MOD_PAGE} por página)
            </>
          ) : null}
        </p>
        <button type="button" className="btn" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          ← Anterior
        </button>
        <button
          type="button"
          className="btn"
          disabled={!data?.total || (page + 1) * MOD_PAGE >= data.total}
          onClick={() => setPage((p) => p + 1)}
        >
          Seguinte →
        </button>
      </div>
    </div>
  );
}
