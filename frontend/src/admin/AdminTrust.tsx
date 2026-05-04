import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

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

  const load = useCallback(async () => {
    if (!token) return;
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
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolveReport(id: string, status: "RESOLVED" | "DISMISSED") {
    if (!token) return;
    try {
      await apiFetch(`/admin/reports/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  if (err) return <p style={{ color: "crimson" }}>{err}</p>;

  return (
    <div>
      <div className="ae-v-head">
        <h1 className="ae-v-title">Confiança · avaliações · relatórios</h1>
      </div>

      <h2 className="ae-v-title" style={{ fontSize: 16 }}>Indicador de parceiros (heurística interna)</h2>
      <table className="ae-data-table" style={{ marginBottom: 28 }}>
        <thead>
          <tr>
            <th>Loja</th>
            <th>Score</th>
            <th>Média produtos</th>
            <th>Reviews</th>
            <th>Vendas (unidades)</th>
            <th>Conta parceira bloqueada</th>
          </tr>
        </thead>
        <tbody>
          {trust?.map((row) => (
            <tr key={row.shop.id}>
              <td>{row.shop.name}</td>
              <td>{row.trustScore}</td>
              <td>{row.averageRating ?? "—"}</td>
              <td>{row.reviewCount}</td>
              <td>{row.soldCount}</td>
              <td>{row.shop.user.blocked ? "sim" : "não"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="ae-v-title" style={{ fontSize: 16 }}>Avaliações recentes</h2>
      <table className="ae-data-table" style={{ marginBottom: 28 }}>
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
          {reviews?.items.map((x) => (
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

      <h2 className="ae-v-title" style={{ fontSize: 16 }}>Relatórios abertos</h2>
      <table className="ae-data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Quem reportou</th>
            <th>Alvo</th>
            <th>Mensagem</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reports?.items.map((x) => (
            <tr key={x.id}>
              <td>{new Date(x.createdAt).toLocaleDateString("pt-AO")}</td>
              <td>{x.reporter.email}</td>
              <td>{x.shop?.name ?? x.product?.name ?? "—"}</td>
              <td>{x.message.slice(0, 120)}</td>
              <td>
                <button type="button" className="btn" style={{ marginRight: 6 }} onClick={() => void resolveReport(x.id, "RESOLVED")}>
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
      <p className="ae-muted">Compradores podem enviar denúncias via <code>POST /reports</code> autenticado.</p>
    </div>
  );
}
