import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type ModItem = {
  id: string;
  name: string;
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
    <div>
      <div className="ae-v-head">
        <h1 className="ae-v-title">Produtos e moderação</h1>
      </div>
      <p className="ae-muted">
        Novos anúncios ficam em <strong>PENDING</strong> (separador <strong>Em fila</strong>) até aprovação. Na pesquisa e
        na loja pública só aparecem produtos <strong>APPROVED</strong> com loja aprovada e nível 1 completo.
      </p>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {msg && <p style={{ color: "var(--ae-ok)" }}>{msg}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button key={s} type="button" className={status === s ? "btn btn-primary" : "btn"} onClick={() => setStatus(s)}>
            {s === "PENDING" ? "Em fila" : s === "APPROVED" ? "Aprovados" : "Rejeitados"}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 12, maxWidth: 420 }}>
        <input
          className="ae-input"
          placeholder="Filtrar por produto, SKU ou loja..."
          value={q}
          onChange={(e) => {
            setPage(0);
            setQ(e.target.value);
          }}
        />
      </div>
      <table className="ae-data-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Loja</th>
            <th>Estado</th>
            <th>Acções</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.shop.name}</td>
              <td>
                {p.moderationStatus} · {p.isActive ? "activo" : "inactivo"}
                {p.isFeatured ? " · destacado" : ""}
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                {p.moderationStatus === "PENDING" && (
                  <>
                    <button type="button" className="btn btn-primary" style={{ marginRight: 6 }} onClick={() => void moderate(p.id, "APPROVED")}>
                      Aprovar
                    </button>
                    <button type="button" className="btn" onClick={() => void moderate(p.id, "REJECTED")}>
                      Rejeitar
                    </button>
                  </>
                )}
                {p.moderationStatus === "APPROVED" && (
                  <>
                    <button type="button" className="btn" style={{ marginRight: 6 }} onClick={() => void featured(p.id, !p.isFeatured)}>
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
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
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
