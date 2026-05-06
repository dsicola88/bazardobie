import { Fragment, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

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

export default function AdminDisputes() {
  const { token } = useAuth();
  const [tab, setTab] = useState<"OPEN" | "ALL">("OPEN");
  const [data, setData] = useState<ListOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"REJECTED" | "FULL_REFUND" | "PARTIAL_REFUND">("REJECTED");
  const [refundAmount, setRefundAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const q = await apiFetch<ListOut>(`/admin/disputes?status=${tab}&take=50`, { token });
      setData(q);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
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

  return (
    <div>
      <div className="ae-v-head">
        <h1 className="ae-v-title">Disputas & reembolsos (escrow)</h1>
      </div>
      <p className="ae-muted">
        Encomendas com pagamento online em escrow. A resolução segue as regras do ledger (reembolso total ou parcial).
      </p>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {msg && <p style={{ color: "var(--ae-ok)" }}>{msg}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" className={tab === "OPEN" ? "btn btn-primary" : "btn"} onClick={() => setTab("OPEN")}>
          Abertas
        </button>
        <button type="button" className={tab === "ALL" ? "btn btn-primary" : "btn"} onClick={() => setTab("ALL")}>
          Todas
        </button>
      </div>
      <table className="ae-data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Encomenda</th>
            <th>Comprador</th>
            <th>Estado</th>
            <th>Valor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((d) => (
            <Fragment key={d.id}>
              <tr>
                <td>{new Date(d.createdAt).toLocaleString("pt-AO")}</td>
                <td>
                  <code>{d.order.orderCode || `${d.order.id.slice(0, 10)}…`}</code>
                </td>
                <td>{d.opener.email}</td>
                <td>{d.status}</td>
                <td>{Number(d.order.grandTotal).toLocaleString("pt-AO")} Kz</td>
                <td>
                  {d.status === "OPEN" ? (
                    <button type="button" className="btn" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
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
                          <option value="REJECTED">Recusar disputa (decisão a favor do parceiro)</option>
                          <option value="FULL_REFUND">Reembolso total ao comprador</option>
                          <option value="PARTIAL_REFUND">Reembolso parcial</option>
                        </select>
                      </label>
                      {outcome === "PARTIAL_REFUND" ? (
                        <div style={{ marginTop: 8 }}>
                          <label>
                            Valor reembolso (Kz){" "}
                            <input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="0.00" />
                          </label>
                        </div>
                      ) : null}
                      <div style={{ marginTop: 8 }}>
                        <label>
                          Nota interna / mensagem (opcional)
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
      <p className="ae-muted">Total nesta vista: {data?.total ?? 0}</p>
    </div>
  );
}
