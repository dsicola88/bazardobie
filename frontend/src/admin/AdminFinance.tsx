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
  const [commissionPct, setCommissionPct] = useState("5");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void apiFetch<Finance>("/admin/finance", { token })
      .then((x) => {
        setF(x);
        setCommissionPct((x.platformCommissionBps / 100).toFixed(2));
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Não foi possível carregar."));
  }, [token]);

  if (err) return <p style={{ color: "crimson" }}>{err}</p>;
  if (!f) return <p>A carregar…</p>;

  const pct = (f.platformCommissionBps / 100).toFixed(2);

  async function saveCommission() {
    if (!token) return;
    setErr(null);
    setSaveMsg(null);
    const n = Number(commissionPct.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setErr("Comissão inválida. Use valor entre 0 e 100.");
      return;
    }
    const bps = Math.round(n * 100);
    try {
      await apiFetch("/admin/site-settings", {
        method: "PUT",
        token,
        body: JSON.stringify({ settings: { "logistics.platform_commission_bps": String(bps) } }),
      });
      const fresh = await apiFetch<Finance>("/admin/finance", { token });
      setF(fresh);
      setSaveMsg("Comissão actualizada com sucesso.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível guardar comissão.");
    }
  }

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
      <div className="ae-panel" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Comissão da plataforma</h2>
        <div className="ae-admin-toolbar">
          <label style={{ minWidth: 200 }}>
            Comissão (%)
            <input
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
              inputMode="decimal"
              placeholder="Ex.: 5 ou 10"
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={() => void saveCommission()}>
            Guardar comissão
          </button>
        </div>
        <p className="ae-muted" style={{ marginBottom: 0 }}>
          Ex.: 5% = 500 bps, 10% = 1000 bps.
        </p>
        {saveMsg ? <p style={{ color: "var(--ae-ok)" }}>{saveMsg}</p> : null}
      </div>
      <p className="ae-muted">
        Os fretes por transportadora e zonas/distância ficam em <strong>Admin → Frete</strong>. O cadastro de parceiros
        de logística fica em <strong>Admin → Transportadoras</strong>.
      </p>
    </div>
  );
}
