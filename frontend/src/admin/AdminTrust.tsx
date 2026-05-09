import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { AdminEmptyState } from "./ui/AdminEmptyState.js";
import { AdminErrorBanner } from "./ui/AdminErrorBanner.js";
import { AdminTableSkeleton } from "./ui/AdminTableSkeleton.js";

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { name: string; email: string };
  product: { id: string; name: string; shopId: string };
  order: { id: string; status: string };
};

type ReportRow = {
  id: string;
  message: string;
  status: string;
  createdAt: string;
  reporter: { name: string; email: string };
  shop: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
};

type TrustRow = {
  trustScore: number;
  averageRating: string | null;
  reviewCount: number;
  soldCount: number;
  shop: {
    id: string;
    name: string;
    user: { id: string; name: string; blocked: boolean };
  };
};

export default function AdminTrust() {
  const { token } = useAuth();
  const [reviews, setReviews] = useState<{ items: ReviewRow[]; total: number } | null>(null);
  const [reports, setReports] = useState<{ items: ReportRow[]; total: number } | null>(null);
  const [trust, setTrust] = useState<TrustRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [r, rep, t] = await Promise.all([
        apiFetch<{ items: ReviewRow[]; total: number }>("/admin/reviews?take=40", { token }),
        apiFetch<{ items: ReportRow[]; total: number }>("/admin/reports?status=OPEN&take=40", { token }),
        apiFetch<TrustRow[]>("/admin/trust/sellers?limit=60", { token }),
      ]);
      setReviews(r);
      setReports(rep);
      setTrust(t);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar dados de confiança.");
      setReviews(null);
      setReports(null);
      setTrust(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolveReport(id: string, status: "RESOLVED" | "DISMISSED") {
    if (!token) return;
    setErr(null);
    try {
      await apiFetch(`/admin/reports/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao actualizar relatório.");
    }
  }

  const trustRows = trust ?? [];
  const reviewItems = reviews?.items ?? [];
  const reportItems = reports?.items ?? [];

  if (loading) {
    return (
      <div className="ae-admin-pro ae-admin-canvas">
        <header className="ae-admin-pro__head">
          <div>
            <h1 className="ae-admin-pro__title">Confiança, avaliações e denúncias</h1>
            <p className="ae-admin-pro__sub">A carregar indicadores…</p>
          </div>
        </header>
        <h2 className="ae-admin-section-title">Indicador de parceiros</h2>
        <AdminTableSkeleton rows={6} cols={6} />
        <h2 className="ae-admin-section-title">Avaliações recentes</h2>
        <AdminTableSkeleton rows={5} cols={5} />
        <h2 className="ae-admin-section-title">Denúncias abertas</h2>
        <AdminTableSkeleton rows={5} cols={5} />
      </div>
    );
  }

  return (
    <div className="ae-admin-pro ae-admin-canvas">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Confiança, avaliações e denúncias</h1>
          <p className="ae-admin-pro__sub">
            Heurística interna de parceiros, últimas reviews e fila de relatórios abertos. Use as acções para fechar ou
            arquivar denúncias.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => void load()}>
          Actualizar
        </button>
      </header>

      {err ? <AdminErrorBanner message={err} onRetry={() => void load()} /> : null}

      <h2 className="ae-admin-section-title">Indicador de parceiros</h2>
      {!err && trustRows.length === 0 ? (
        <AdminEmptyState title="Sem lojas no indicador" description="Não há parceiros aprovados para calcular o score." />
      ) : null}
      {!err && trustRows.length > 0 ? (
        <div className="ae-admin-table-wrap" style={{ marginBottom: 28 }}>
          <table className="ae-admin-table">
            <thead>
              <tr>
                <th>Loja</th>
                <th>Score</th>
                <th>Média produtos</th>
                <th>Reviews</th>
                <th>Vendas (unid.)</th>
                <th>Conta bloqueada</th>
              </tr>
            </thead>
            <tbody>
              {trustRows.map((row) => (
                <tr key={row.shop.id}>
                  <td className="ae-admin-cell-title">{row.shop.name}</td>
                  <td>{row.trustScore}</td>
                  <td>{row.averageRating ?? "—"}</td>
                  <td>{row.reviewCount}</td>
                  <td>{row.soldCount}</td>
                  <td>{row.shop.user.blocked ? "sim" : "não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <h2 className="ae-admin-section-title">Avaliações recentes</h2>
      {!err && reviewItems.length === 0 ? (
        <AdminEmptyState title="Sem avaliações listadas" description="Ainda não há reviews para mostrar neste extracto." />
      ) : null}
      {!err && reviewItems.length > 0 ? (
        <div className="ae-admin-table-wrap" style={{ marginBottom: 28 }}>
          <table className="ae-admin-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Comprador</th>
                <th>Produto</th>
                <th>Estrelas</th>
                <th>Comentário</th>
              </tr>
            </thead>
            <tbody>
              {reviewItems.map((x) => (
                <tr key={x.id}>
                  <td>{new Date(x.createdAt).toLocaleDateString("pt-AO")}</td>
                  <td>{x.user.name}</td>
                  <td>{x.product.name}</td>
                  <td>{x.rating}</td>
                  <td>{x.comment?.slice(0, 80) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <h2 className="ae-admin-section-title">Denúncias abertas</h2>
      {!err && reportItems.length === 0 ? (
        <AdminEmptyState
          title="Nenhuma denúncia aberta"
          description="Óptimo: não há relatórios pendentes. As novas denúncias chegam via fluxo autenticado do site."
        />
      ) : null}
      {!err && reportItems.length > 0 ? (
        <div className="ae-admin-table-wrap">
          <table className="ae-admin-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Quem reportou</th>
                <th>Alvo</th>
                <th>Mensagem</th>
                <th className="ae-admin-table__actions"></th>
              </tr>
            </thead>
            <tbody>
              {reportItems.map((x) => (
                <tr key={x.id}>
                  <td>{new Date(x.createdAt).toLocaleDateString("pt-AO")}</td>
                  <td>{x.reporter.email}</td>
                  <td>{x.shop?.name ?? x.product?.name ?? "—"}</td>
                  <td>{x.message.slice(0, 120)}</td>
                  <td className="ae-admin-row-actions">
                    <button
                      type="button"
                      className="btn"
                      style={{ marginRight: 6 }}
                      onClick={() => void resolveReport(x.id, "RESOLVED")}
                    >
                      Resolver
                    </button>
                    <button type="button" className="btn" onClick={() => void resolveReport(x.id, "DISMISSED")}>
                      Arquivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="ae-muted" style={{ marginTop: 20 }}>
        Denúncias públicas: endpoint <code className="ae-admin-mono">POST /reports</code> com utilizador autenticado.
      </p>
    </div>
  );
}
