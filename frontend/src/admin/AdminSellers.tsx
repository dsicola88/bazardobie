import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { isPlatformAdmin } from "./adminAccess.js";
import { AdminEmptyState } from "./ui/AdminEmptyState.js";
import { AdminErrorBanner } from "./ui/AdminErrorBanner.js";
import { AdminTableSkeleton } from "./ui/AdminTableSkeleton.js";

type Shop = {
  id: string;
  name: string;
  province: string;
  city: string;
  isApproved: boolean;
  userId: string;
  user?: { name: string; email: string };
};

type RankRow = {
  shopId: string;
  revenue: string;
  orderCount: number;
  shop: {
    id: string;
    name: string;
    isApproved: boolean;
    user: { id: string; name: string; email: string; blocked: boolean };
  } | null;
};

function parseTab(raw: string | null): "pending" | "ranking" {
  return raw === "ranking" ? "ranking" : "pending";
}

export default function AdminSellers() {
  const { token, user } = useAuth();
  const fullAdmin = isPlatformAdmin(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);
  const [loadingPending, setLoadingPending] = useState(() => tab === "pending");

  const setTab = useCallback(
    (t: "pending" | "ranking") => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("tab", t);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [pending, setPending] = useState<Shop[] | null>(null);
  const [ranking, setRanking] = useState<RankRow[] | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rankErr, setRankErr] = useState<string | null>(null);
  const [loadingRanking, setLoadingRanking] = useState(false);

  const loadPending = useCallback(async () => {
    if (!token) return;
    setLoadingPending(true);
    setErr(null);
    try {
      const p = await apiFetch<Shop[]>("/admin/shops/pending", { token });
      setPending(p);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar lojas pendentes.");
    } finally {
      setLoadingPending(false);
    }
  }, [token]);

  const loadRanking = useCallback(async () => {
    if (!token) return;
    if (!fullAdmin) {
      setRanking([]);
      setRankErr(null);
      return;
    }
    setLoadingRanking(true);
    setRankErr(null);
    try {
      const r = await apiFetch<RankRow[]>("/admin/shops/ranking?limit=40", { token });
      setRanking(r);
    } catch (e: unknown) {
      setRanking([]);
      setRankErr(e instanceof Error ? e.message : "Não foi possível carregar o ranking.");
    } finally {
      setLoadingRanking(false);
    }
  }, [token, fullAdmin]);

  useEffect(() => {
    if (tab !== "pending") {
      setLoadingPending(false);
      return;
    }
    void loadPending();
  }, [tab, loadPending]);

  useEffect(() => {
    if (tab === "ranking") void loadRanking();
  }, [tab, loadRanking]);

  async function approveShop(id: string, isApproved: boolean) {
    if (!token) return;
    setMsg(null);
    try {
      await apiFetch(`/admin/shops/${id}/approve`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ isApproved }),
      });
      setMsg(isApproved ? "Loja aprovada." : "Loja rejeitada / desactivada na aprovação.");
      void loadPending();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  const pendingFiltered = (pending ?? []).filter((s) => {
    const blob = `${s.name} ${s.city} ${s.province} ${s.user?.name ?? ""} ${s.user?.email ?? ""}`.toLowerCase();
    return blob.includes(q.trim().toLowerCase());
  });

  const rankingFiltered = (ranking ?? []).filter((r) => {
    const blob = `${r.shop?.name ?? ""} ${r.shop?.user?.name ?? ""} ${r.shop?.user?.email ?? ""}`.toLowerCase();
    return blob.includes(q.trim().toLowerCase());
  });

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Lojas parceiras</h1>
          <p className="ae-admin-pro__sub">
            Aprovação de cadastros e visão de desempenho. O separador activo fica no URL (ex.:{" "}
            <code className="ae-admin-mono">?tab=pending</code>). Contas de envio pela plataforma tratam pedidos em{" "}
            <Link to="/logistica">Área de logística</Link>
            {fullAdmin ? (
              <>
                {" "}
                ; colaboradores <strong>SUPORTE</strong>/<strong>LOGISTICA</strong> gerem-se em{" "}
                <Link to="/admin/team">Equipa &amp; logística</Link>.
              </>
            ) : (
              <> (contacte o administrador da plataforma para gestão de equipa).</>
            )}
          </p>
        </div>
      </header>
      {err ? <AdminErrorBanner message={err} onRetry={() => void loadPending()} /> : null}
      {msg ? <p className="ae-admin-alert ae-admin-alert--ok">{msg}</p> : null}
      <div className="ae-admin-toolbar">
        {(["pending", "ranking"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "btn btn-primary" : "btn"}
            onClick={() => setTab(t)}
          >
            {t === "pending" ? "Aprovar lojas" : "Ranking de vendas"}
          </button>
        ))}
        <input
          className="ae-admin-filter-input"
          placeholder="Filtrar por loja, cidade, nome ou email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {tab === "pending" && loadingPending && !pending ? <AdminTableSkeleton rows={8} cols={4} /> : null}
      {tab === "pending" && !loadingPending && pending && pendingFiltered.length === 0 ? (
        <AdminEmptyState
          title="Sem lojas na fila de aprovação"
          description={
            q.trim()
              ? "Nenhum resultado para o filtro. Limpe a pesquisa ou verifique o texto."
              : "Neste momento não há registos pendentes de aprovação."
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

      {tab === "pending" && pendingFiltered.length > 0 ? (
        <div className="ae-admin-table-wrap">
          <table className="ae-admin-table">
            <thead>
              <tr>
                <th>Loja</th>
                <th>Responsável</th>
                <th>Localização</th>
                <th className="ae-admin-table__actions">Acções</th>
              </tr>
            </thead>
            <tbody>
              {pendingFiltered.map((s) => (
                <tr key={s.id}>
                  <td className="ae-admin-cell-title">{s.name}</td>
                  <td>
                    {s.user?.name ?? "—"}
                    <div className="ae-muted" style={{ fontSize: 12 }}>
                      {s.user?.email ?? ""}
                    </div>
                  </td>
                  <td>
                    {s.city}, {s.province}
                  </td>
                  <td className="ae-admin-row-actions">
                    <button type="button" className="btn btn-primary" onClick={() => void approveShop(s.id, true)}>
                      Aprovar loja
                    </button>
                    <button type="button" className="btn" onClick={() => void approveShop(s.id, false)}>
                      Recusar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "ranking" && fullAdmin && loadingRanking && !ranking ? <AdminTableSkeleton rows={8} cols={3} /> : null}
      {tab === "ranking" && fullAdmin && rankErr ? (
        <AdminErrorBanner message={rankErr} onRetry={() => void loadRanking()} />
      ) : null}
      {tab === "ranking" && !fullAdmin ? (
        <AdminEmptyState
          title="Ranking reservado a administradores"
          description="O perfil de suporte gere aprovações e operações; o ranking agregado por volume fica no painel do administrador."
        />
      ) : null}
      {tab === "ranking" && fullAdmin && ranking && rankingFiltered.length === 0 && !loadingRanking ? (
        <AdminEmptyState
          title="Sem dados de ranking"
          description={q.trim() ? "Ajuste o filtro de pesquisa." : "Ainda não há vendas consolidadas para listar."}
          action={
            q.trim() ? (
              <button type="button" className="btn" onClick={() => setQ("")}>
                Limpar pesquisa
              </button>
            ) : null
          }
        />
      ) : null}
      {tab === "ranking" && fullAdmin && rankingFiltered.length > 0 ? (
        <div className="ae-admin-table-wrap">
          <table className="ae-admin-table">
            <thead>
              <tr>
                <th>Loja</th>
                <th>Encomendas (únicas)</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {rankingFiltered.map((row) => (
                <tr key={row.shopId}>
                  <td>{row.shop?.name ?? row.shopId}</td>
                  <td>{row.orderCount}</td>
                  <td>{Number(row.revenue).toLocaleString("pt-AO")} Kz</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
