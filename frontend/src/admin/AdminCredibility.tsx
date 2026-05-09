import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { AdminEmptyState } from "./ui/AdminEmptyState.js";
import { AdminErrorBanner } from "./ui/AdminErrorBanner.js";

type QueueShop = {
  id: string;
  name: string;
  city: string;
  province: string;
  tier2SubmittedAt?: string | null;
  tier2RejectedReason?: string | null;
  tier3SubmittedAt?: string | null;
  tier3RejectedReason?: string | null;
  biPhotoUrl?: string | null;
  selfiePhotoUrl?: string | null;
  storePhotoUrl?: string | null;
  nif?: string | null;
  companyDocUrl?: string | null;
  bankHolderName?: string | null;
  bankName?: string | null;
  bankIban?: string | null;
  user?: { id: string; email: string; name: string; phone?: string | null };
};

type Queues = { pendente_nivel2: QueueShop[]; pendente_nivel3: QueueShop[] };

type CredAcao = "aprovar_nivel2" | "reprovar_nivel2" | "aprovar_nivel3" | "reprovar_nivel3";

function fmt(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-AO", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function DocLinks({
  biPhotoUrl,
  selfiePhotoUrl,
  storePhotoUrl,
}: {
  biPhotoUrl?: string | null;
  selfiePhotoUrl?: string | null;
  storePhotoUrl?: string | null;
}) {
  const items: { label: string; url: string }[] = [];
  if (biPhotoUrl?.trim()) items.push({ label: "BI / documento", url: biPhotoUrl.trim() });
  if (selfiePhotoUrl?.trim()) items.push({ label: "Selfie com BI", url: selfiePhotoUrl.trim() });
  if (storePhotoUrl?.trim()) items.push({ label: "Foto loja (opcional)", url: storePhotoUrl.trim() });
  if (!items.length) return <span className="ae-muted">Sem URLs — verificar envio</span>;
  return (
    <ul className="ae-cred-admin-docs">
      {items.map((x) => (
        <li key={x.label}>
          <a href={x.url} target="_blank" rel="noopener noreferrer">
            Abrir {x.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function AdminCredibility() {
  const { token } = useAuth();
  const [data, setData] = useState<Queues | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const q = await apiFetch<Queues>("/admin/shops/credibility/queues", { token });
      setData(q);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar filas");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function apply(shopId: string, acao: CredAcao, motivo?: string) {
    if (!token) return;
    setErr(null);
    setMsg(null);
    setBusyId(shopId);
    try {
      await apiFetch(`/admin/shops/${shopId}/credibility`, {
        method: "PATCH",
        token,
        body: JSON.stringify(motivo !== undefined ? { acao, motivo } : { acao }),
      });
      setMsg("Decisão registada.");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao aplicar decisão");
    } finally {
      setBusyId(null);
    }
  }

  async function reprovarN2(id: string) {
    const m = window.prompt("Motivo da reprovação do nível 2 (visível ao vendedor, mín. 3 caracteres):");
    if (m === null) return;
    const t = m.trim();
    if (t.length < 3) {
      alert("O motivo deve ter pelo menos 3 caracteres.");
      return;
    }
    await apply(id, "reprovar_nivel2", t);
  }

  async function reprovarN3(id: string) {
    const m = window.prompt("Motivo da reprovação do nível 3 (visível ao vendedor):");
    if (m === null) return;
    const t = m.trim();
    if (t.length < 3) {
      alert("O motivo deve ter pelo menos 3 caracteres.");
      return;
    }
    await apply(id, "reprovar_nivel3", t);
  }

  if (!token) return <p className="ae-muted">Autenticação necessária.</p>;

  return (
    <div className="ae-admin-pro ae-cred-admin ae-admin-canvas">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Filas de credibilidade</h1>
          <p className="ae-admin-pro__sub">
            Documentos confidenciais. Abra cada ficheiro num separador novo, avalie nitidez e coerência, e só depois
            aprove ou reprove com motivo claro.
          </p>
        </div>
        <button type="button" className="btn" disabled={loading} onClick={() => void load()}>
          {loading ? "A actualizar…" : "Actualizar filas"}
        </button>
      </header>

      {err ? <AdminErrorBanner message={err} onRetry={() => void load()} /> : null}
      {msg ? <p className="ae-admin-alert ae-admin-alert--ok">{msg}</p> : null}

      {loading && !data ? (
        <div className="ae-cred-admin__grid" aria-busy="true">
          <div className="page-panel">
            <div className="ae-admin-skeleton" style={{ height: 22, width: "55%", marginBottom: 14 }} />
            <div className="ae-admin-skeleton" style={{ height: 120, marginBottom: 10 }} />
            <div className="ae-admin-skeleton" style={{ height: 120, marginBottom: 10 }} />
            <div className="ae-admin-skeleton" style={{ height: 44, width: "40%" }} />
          </div>
          <div className="page-panel">
            <div className="ae-admin-skeleton" style={{ height: 22, width: "55%", marginBottom: 14 }} />
            <div className="ae-admin-skeleton" style={{ height: 140, marginBottom: 10 }} />
            <div className="ae-admin-skeleton" style={{ height: 44, width: "40%" }} />
          </div>
        </div>
      ) : null}

      {!loading && data ? (
        <div className="ae-cred-admin__grid">
          <section className="page-panel">
            <h2 style={{ marginTop: 0 }}>Nível 2 — BI e selfie</h2>
            <p className="ae-muted" style={{ fontSize: 13 }}>
              {data.pendente_nivel2.length} loja(s) com pedido não aprovado (inclui reenvios após reprovação).
            </p>
            {data.pendente_nivel2.length === 0 ? (
              <AdminEmptyState
                title="Fila nível 2 vazia"
                description="Não há pedidos de verificação BI / selfie por rever neste momento."
              />
            ) : (
              <ul className="ae-cred-admin-list">
                {data.pendente_nivel2.map((s) => (
                  <li key={s.id} className="ae-cred-admin-card">
                    <div className="ae-cred-admin-card__head">
                      <strong>{s.name}</strong>
                      <span className="ae-muted">
                        {s.city}, {s.province} · enviado {fmt(s.tier2SubmittedAt)}
                      </span>
                    </div>
                    <p className="ae-muted" style={{ fontSize: 13, margin: "6px 0" }}>
                      Parceiro: {s.user?.name} ({s.user?.email})
                      {s.user?.phone ? ` · ${s.user.phone}` : ""}
                    </p>
                    {s.tier2RejectedReason ? (
                      <p className="ae-admin-alert ae-admin-alert--err" style={{ fontSize: 12, padding: "8px 10px" }}>
                        Reprovado anteriormente: {s.tier2RejectedReason}
                      </p>
                    ) : null}
                    <DocLinks biPhotoUrl={s.biPhotoUrl} selfiePhotoUrl={s.selfiePhotoUrl} storePhotoUrl={s.storePhotoUrl} />
                    <div className="ae-cred-admin-card__actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === s.id}
                        onClick={() => void apply(s.id, "aprovar_nivel2")}
                      >
                        Aprovar nível 2
                      </button>
                      <button type="button" className="btn" disabled={busyId === s.id} onClick={() => void reprovarN2(s.id)}>
                        Reprovar (com motivo)
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="page-panel">
            <h2 style={{ marginTop: 0 }}>Nível 3 — empresa e liquidações</h2>
            <p className="ae-muted" style={{ fontSize: 13 }}>
              Só aparecem lojas com nível 2 já aprovado e pedido nível 3 pendente.
            </p>
            {data.pendente_nivel3.length === 0 ? (
              <AdminEmptyState
                title="Fila nível 3 vazia"
                description="Sem pedidos pendentes de documentação empresarial e dados bancários."
              />
            ) : (
              <ul className="ae-cred-admin-list">
                {data.pendente_nivel3.map((s) => (
                  <li key={s.id} className="ae-cred-admin-card">
                    <div className="ae-cred-admin-card__head">
                      <strong>{s.name}</strong>
                      <span className="ae-muted">
                        {s.city}, {s.province} · enviado {fmt(s.tier3SubmittedAt)}
                      </span>
                    </div>
                    <p className="ae-muted" style={{ fontSize: 13, margin: "6px 0" }}>
                      Parceiro: {s.user?.name} ({s.user?.email})
                    </p>
                    <dl className="ae-cred-admin-dl">
                      <div>
                        <dt>NIF</dt>
                        <dd>{s.nif ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Titular</dt>
                        <dd>{s.bankHolderName ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Banco</dt>
                        <dd>{s.bankName ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>IBAN</dt>
                        <dd style={{ fontFamily: "monospace", fontSize: 12 }}>{s.bankIban ?? "—"}</dd>
                      </div>
                    </dl>
                    {s.companyDocUrl?.trim() ? (
                      <p style={{ margin: "8px 0 0" }}>
                        <a href={s.companyDocUrl.trim()} target="_blank" rel="noopener noreferrer">
                          Abrir certidão / documento registal
                        </a>
                      </p>
                    ) : (
                      <p className="ae-muted" style={{ fontSize: 13 }}>
                        Sem certidão anexada (opcional).
                      </p>
                    )}
                    {s.tier3RejectedReason ? (
                      <p className="ae-admin-alert ae-admin-alert--err" style={{ fontSize: 12, padding: "8px 10px" }}>
                        Reprovado anteriormente: {s.tier3RejectedReason}
                      </p>
                    ) : null}
                    <div className="ae-cred-admin-card__actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === s.id}
                        onClick={() => void apply(s.id, "aprovar_nivel3")}
                      >
                        Aprovar nível 3
                      </button>
                      <button type="button" className="btn" disabled={busyId === s.id} onClick={() => void reprovarN3(s.id)}>
                        Reprovar (com motivo)
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
