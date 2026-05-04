import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type Finance = {
  escrowHeldTotal: string;
  escrowReleasedTotal: string;
  escrowAwaitingFundsTotal: string;
  refundedOrdersCount: number;
  refundsLedgerTotal: string;
  platformCommissionBps: number;
  platformProfitEstimate: string;
  revenueTotal: string;
};

export default function AdminFinance() {
  const { token } = useAuth();
  const [f, setF] = useState<Finance | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void apiFetch<Finance>("/admin/finance", { token })
      .then(setF)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Não foi possível carregar."));
  }, [token]);

  if (err) return <p style={{ color: "crimson" }}>{err}</p>;
  if (!f) return <p>A carregar…</p>;

  const pct = (f.platformCommissionBps / 100).toFixed(2);

  return (
    <div>
      <div className="ae-v-head">
        <h1 className="ae-v-title">Financeiro · escrow e reembolsos</h1>
      </div>
      <div className="ae-v-metrics">
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Dinheiro em espera (escrow activo)</div>
          <div className="ae-v-metric__v">{Number(f.escrowHeldTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Aguarda pagamento no gateway</div>
          <div className="ae-v-metric__v">{Number(f.escrowAwaitingFundsTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Libertado aos parceiros</div>
          <div className="ae-v-metric__v">{Number(f.escrowReleasedTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Encomendas marcadas reembolsadas (estado)</div>
          <div className="ae-v-metric__v">{f.refundedOrdersCount}</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Soma reembolsos no ledger</div>
          <div className="ae-v-metric__v">{Number(f.refundsLedgerTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Volume total (encomendas não canceladas)</div>
          <div className="ae-v-metric__v">{Number(f.revenueTotal).toLocaleString("pt-AO")} Kz</div>
        </div>
        <div className="ae-v-metric">
          <div className="ae-v-metric__l">Lucro estimado plataforma ({pct}%)</div>
          <div className="ae-v-metric__v">{Number(f.platformProfitEstimate).toLocaleString("pt-AO")} Kz</div>
        </div>
      </div>
      <p className="ae-muted">
        Ajuste <code>PLATFORM_COMMISSION_BPS</code> no servidor para o modelo de comissão real. Disputas e reembolsos parciais tratam-se em <strong>Encomendas</strong> e rotas de disputa (admin).
      </p>
    </div>
  );
}
