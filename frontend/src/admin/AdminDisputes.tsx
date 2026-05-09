import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { AdminEmptyState } from "./ui/AdminEmptyState.js";
import { AdminErrorBanner } from "./ui/AdminErrorBanner.js";
import { AdminTableSkeleton } from "./ui/AdminTableSkeleton.js";

type DisputeRow = {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  refundAmount?: string | null;
  opener: { name: string; email: string };
  order: {
    id: string;
    orderCode?: string | null;
    status: string;
    grandTotal: string;
    paymentMethod: string;
    gatewayPayStatus: string;
    escrowState: string;
  };
};

type ListOut = { items: DisputeRow[]; total: number };

function parseTab(raw: string | null): "OPEN" | "ALL" {
  return raw === "all" ? "ALL" : "OPEN";
}

export default function AdminDisputes() {
  const { token, user } = useAuth();
  const financeLocked = user?.role === "SUPORTE";
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);

  const setTab = useCallback(
    (t: "OPEN" | "ALL") => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("tab", t === "ALL" ? "all" : "open");
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [data, setData] = useState<ListOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"REJECTED" | "FULL_REFUND" | "PARTIAL_REFUND">("REJECTED");
  const [refundAmount, setRefundAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (financeLocked) setOutcome("REJECTED");
  }, [financeLocked]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const q = await apiFetch<ListOut>(`/admin/disputes?status=${tab}&take=50`, { token });
      setData(q);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar disputas.");
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(disputeId: string) {
    if (!token) return;
    setBusyId(disputeId);
    setMsg(null);
    setErr(null);
    try {
      const body: {
        outcome: string;
        refundAmount?: string;
        resolutionNote?: string;
      } = { outcome, resolutionNote: note.trim() || undefined };
      if (outcome === "PARTIAL_REFUND") body.refundAmount = refundAmount.trim();
      await apiFetch(`/admin/disputes/${disputeId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setMsg("Disputa actualizada.");
      setExpanded(null);
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusyId(null);
    }
  }

  const items = data?.items ?? [];
  const showEmpty = !loading && items.length === 0;

  return (
    <div className="ae-admin-pro ae-admin-canvas">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Disputas e escrow</h1>
          <p className="ae-admin-pro__sub">
            Pedidos com pagamento online retido. A resolução actualiza o ledger da plataforma.
            {financeLocked ? (
              <>
                {" "}
                <strong>Perfil suporte:</strong> apenas decisão a favor do parceiro (sem reembolso); reembolsos ficam com
                administrador.
              </>
            ) : null}
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
        <button type="button" className={tab === "OPEN" ? "btn btn-primary" : "btn"} onClick={() => setTab("OPEN")}>
          Abertas
        </button>
        <button type="button" className={tab === "ALL" ? "btn btn-primary" : "btn"} onClick={() => setTab("ALL")}>
          Histórico completo
        </button>
        <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => void load()}>
          {loading ? "A actualizar…" : "Actualizar"}
        </button>
      </div>

      {loading && !data ? <AdminTableSkeleton rows={10} cols={6} /> : null}

      {showEmpty ? (
        <AdminEmptyState
          title={tab === "OPEN" ? "Sem disputas abertas" : "Nenhum registo nesta vista"}
          description={
            tab === "OPEN"
              ? "Quando um comprador abrir disputa num pedido com escrow activo, o caso aparece aqui com prioridade."
              : "Não há disputas registadas ou o servidor devolveu lista vazia."
          }
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <div className="ae-admin-table-wrap">
            <table className="ae-admin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Encomenda</th>
                  <th>Comprador</th>
                  <th>Estado</th>
                  <th>Valor</th>
                  <th className="ae-admin-table__actions"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <Fragment key={d.id}>
                    <tr>
                      <td>{new Date(d.createdAt).toLocaleString("pt-AO")}</td>
                      <td>
                        <code className="ae-admin-mono">{d.order.orderCode || `${d.order.id.slice(0, 10)}…`}</code>
                      </td>
                      <td>{d.opener.email}</td>
                      <td>{d.status}</td>
                      <td>{Number(d.order.grandTotal).toLocaleString("pt-AO")} Kz</td>
                      <td className="ae-admin-row-actions">
                        {d.status === "OPEN" ? (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                          >
                            {expanded === d.id ? "Fechar" : "Resolver"}
                          </button>
                        ) : (
                          <span className="ae-muted">—</span>
                        )}
                      </td>
                    </tr>
                    {expanded === d.id && d.status === "OPEN" ? (
                      <tr key={`${d.id}-form`}>
                        <td colSpan={6}>
                          <div className="ae-panel" style={{ margin: 8 }}>
                            <p>
                              <strong>Motivo:</strong> {d.reason}
                            </p>
                            <p className="ae-muted" style={{ fontSize: 12 }}>
                              Escrow: {d.order.escrowState} · Gateway: {d.order.gatewayPayStatus}
                            </p>
                            <label>
                              Decisão{" "}
                              <select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
                                <option value="REJECTED">Recusar disputa (a favor do parceiro)</option>
                                {financeLocked ? null : (
                                  <>
                                    <option value="FULL_REFUND">Reembolso total ao comprador</option>
                                    <option value="PARTIAL_REFUND">Reembolso parcial</option>
                                  </>
                                )}
                              </select>
                            </label>
                            {outcome === "PARTIAL_REFUND" ? (
                              <div style={{ marginTop: 8 }}>
                                <label>
                                  Valor reembolso (Kz){" "}
                                  <input
                                    value={refundAmount}
                                    onChange={(e) => setRefundAmount(e.target.value)}
                                    placeholder="0.00"
                                  />
                                </label>
                              </div>
                            ) : null}
                            <div style={{ marginTop: 8 }}>
                              <label>
                                Nota interna (opcional)
                                <textarea
                                  value={note}
                                  onChange={(e) => setNote(e.target.value)}
                                  rows={2}
                                  style={{ width: "100%" }}
                                />
                              </label>
                            </div>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ marginTop: 10 }}
                              disabled={busyId === d.id}
                              onClick={() => void resolve(d.id)}
                            >
                              {busyId === d.id ? "…" : "Confirmar resolução"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ae-muted" style={{ marginTop: 12 }}>
            Total nesta vista: <strong>{data?.total ?? 0}</strong>
          </p>
        </>
      ) : null}
    </div>
  );
}
