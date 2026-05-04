import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch, uploadAdminFile } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type ShopCred = {
  id: string;
  isApproved: boolean;
  tier1CompletedAt?: string | null;
  tier2SubmittedAt?: string | null;
  tier2ApprovedAt?: string | null;
  tier2RejectedReason?: string | null;
  tier3SubmittedAt?: string | null;
  tier3ApprovedAt?: string | null;
  tier3RejectedReason?: string | null;
  biPhotoUrl?: string | null;
  selfiePhotoUrl?: string | null;
  storePhotoUrl?: string | null;
  nif?: string | null;
  companyDocUrl?: string | null;
  bankHolderName?: string | null;
  bankName?: string | null;
  bankIban?: string | null;
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function UploadLine({
  label,
  hint,
  accept,
  url,
  onUrl,
  token,
}: {
  label: string;
  hint: string;
  accept: string;
  url: string;
  onUrl: (u: string) => void;
  token: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState(false);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUp(true);
    try {
      const u = await uploadAdminFile(token, f);
      onUrl(u);
    } catch (ex: unknown) {
      alert(ex instanceof Error ? ex.message : "Erro ao carregar ficheiro");
    } finally {
      setUp(false);
    }
  }

  return (
    <div className="ae-cred-upload">
      <div>
        <strong>{label}</strong>
        <p className="ae-field-hint">{hint}</p>
      </div>
      <div className="ae-cred-upload__row">
        <input value={url} onChange={(e) => onUrl(e.target.value)} placeholder="https://… ou carregue aqui ao lado" />
        <input ref={ref} type="file" accept={accept} className="sr-only" onChange={(ev) => void onPick(ev)} />
        <button type="button" className="btn" disabled={up} onClick={() => ref.current?.click()}>
          {up ? "A carregar…" : "Carregar ficheiro"}
        </button>
      </div>
    </div>
  );
}

export default function VendorCredibility() {
  const { token } = useAuth();
  const [shop, setShop] = useState<ShopCred | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving2, setSaving2] = useState(false);
  const [saving3, setSaving3] = useState(false);

  const [biPhotoUrl, setBiPhotoUrl] = useState("");
  const [selfiePhotoUrl, setSelfiePhotoUrl] = useState("");
  const [storePhotoUrl, setStorePhotoUrl] = useState("");

  const [nif, setNif] = useState("");
  const [companyDocUrl, setCompanyDocUrl] = useState("");
  const [bankHolderName, setBankHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankIban, setBankIban] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setReady(false);
    try {
      const s = await apiFetch<ShopCred>("/vendor/shop/me", { token });
      setShop(s);
      setBiPhotoUrl(s.biPhotoUrl ?? "");
      setSelfiePhotoUrl(s.selfiePhotoUrl ?? "");
      setStorePhotoUrl(s.storePhotoUrl ?? "");
      setNif(s.nif ?? "");
      setCompanyDocUrl(s.companyDocUrl ?? "");
      setBankHolderName(s.bankHolderName ?? "");
      setBankName(s.bankName ?? "");
      setBankIban(s.bankIban ?? "");
    } catch (e: unknown) {
      const st = e && typeof e === "object" && "status" in e ? Number((e as { status: number }).status) : 0;
      if (st === 404) {
        setShop(null);
      } else {
        setErr(e instanceof Error ? e.message : "Não foi possível carregar dados da loja");
      }
    } finally {
      setReady(true);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void load();
  }, [load, token]);

  async function submitTier2(e: FormEvent) {
    e.preventDefault();
    if (!token || !shop) return;
    setMsg(null);
    setErr(null);
    setSaving2(true);
    try {
      await apiFetch("/vendor/shop/credibility/tier2", {
        method: "POST",
        token,
        body: JSON.stringify({
          biPhotoUrl: biPhotoUrl.trim(),
          selfiePhotoUrl: selfiePhotoUrl.trim(),
          ...(storePhotoUrl.trim() ? { storePhotoUrl: storePhotoUrl.trim() } : {}),
        }),
      });
      setMsg("Nível 2 enviado. A equipa BAZAR DO BIÉ analisará os ficheiros; após aprovação receberá o selo «VERIFICADO».");
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Falha ao submeter nível 2.");
    } finally {
      setSaving2(false);
    }
  }

  async function submitTier3(e: FormEvent) {
    e.preventDefault();
    if (!token || !shop) return;
    setMsg(null);
    setErr(null);
    setSaving3(true);
    try {
      await apiFetch("/vendor/shop/credibility/tier3", {
        method: "POST",
        token,
        body: JSON.stringify({
          nif: nif.trim(),
          ...(companyDocUrl.trim() ? { companyDocUrl: companyDocUrl.trim() } : {}),
          bankHolderName: bankHolderName.trim(),
          ...(bankName.trim() ? { bankName: bankName.trim() } : {}),
          bankIban: bankIban.trim().replace(/\s/g, ""),
        }),
      });
      setMsg(
        "Nível 3 enviado. Os dados financeiros ficam confidenciais; o comprador verá apenas o selo «premium» após aprovação."
      );
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Falha ao submeter nível 3.");
    } finally {
      setSaving3(false);
    }
  }

  if (!token) {
    return <p className="ae-muted">Inicie sessão como vendedor.</p>;
  }

  if (!ready) {
    return <p className="ae-muted">A carregar…</p>;
  }

  if (err) {
    return (
      <div className="ae-panel">
        <p className="ae-admin-alert ae-admin-alert--err">{err}</p>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="page-panel">
        <h1 className="ae-v-title">Credibilidade</h1>
        <p className="ae-muted">Ainda não tem loja registada. Complete o nível&nbsp;1 nos dados da loja.</p>
        <Link to="/vendor/loja" className="btn btn-primary">
          Dados da loja
        </Link>
      </div>
    );
  }

  const pending2 = Boolean(shop.tier2SubmittedAt && !shop.tier2ApprovedAt && !shop.tier2RejectedReason);
  const approved2 = !!shop.tier2ApprovedAt;
  const rejected2 = !!(shop.tier2RejectedReason && !shop.tier2ApprovedAt);
  const canStart2 = shop.isApproved && shop.tier1CompletedAt;

  const pending3 = Boolean(shop.tier3SubmittedAt && !shop.tier3ApprovedAt && !shop.tier3RejectedReason);
  const approved3 = !!shop.tier3ApprovedAt;
  const rejected3 = !!(shop.tier3RejectedReason && !shop.tier3ApprovedAt);
  const tier3SubmitLocked = !approved2 || approved3 || pending3;

  return (
    <div className="ae-cred-flow">
      <header className="ae-v-head">
        <div>
          <h1 className="ae-v-title">Credibilidade e documentação</h1>
          <p className="ae-muted" style={{ marginTop: 8, maxWidth: 720 }}>
            O comprador <strong>não vê</strong> cópias do seu BI, NIF ou IBAN — apenas selos de confiança e, se aprovado,
            uma fotografia pública opcional da fachada ou actividade.
          </p>
        </div>
        <Link to="/vendor" className="btn btn-ghost">
          ← Voltar ao resumo
        </Link>
      </header>

      {msg ? (
        <div className="ae-admin-alert ae-admin-alert--ok" role="status">
          {msg}
        </div>
      ) : null}

      {!canStart2 ? (
        <section className="page-panel ae-cred-banner">
          <h2>Aguarde aprovação do nível 1</h2>
          <p>
            A loja tem de estar <strong>aprovada</strong> pela equipa e com registo de dados base concluído antes de
            enviar documentos de identidade.
          </p>
          <Link to="/vendor/loja" className="btn btn-primary">
            Estado da loja
          </Link>
        </section>
      ) : null}

      <section className="page-panel ae-cred-tier">
        <div className="ae-cred-tier__head">
          <span className="ae-cred-badge">Nível 2</span>
          <h2>Selo «VERIFICADO» — BI e selfie</h2>
        </div>
        <ul className="ae-cred-list">
          <li>Bilhete de identidade: imagem (JPG·PNG·WebP·GIF) ou PDF &middot; máx. 5&nbsp;MB.</li>
          <li>Selfie a segurar o mesmo bilhete — imagem apenas, rosto e documento legíveis.</li>
          <li>Opcional: foto da fachada ou actividade (pode ser mostrada ao público após aprovação).</li>
        </ul>
        {(pending2 || approved2 || rejected2) && (
          <p className="ae-muted" style={{ fontSize: 13 }}>
            {pending2 ? <>Em análise desde {fmtDate(shop.tier2SubmittedAt)}.</> : null}
            {approved2 ? <> Aprovado em {fmtDate(shop.tier2ApprovedAt)}.</> : null}
            {rejected2 ? (
              <>
                {" "}
                <strong>Última decisão:</strong> {shop.tier2RejectedReason}
              </>
            ) : null}
          </p>
        )}

        {canStart2 ? (
          <form className="ae-form" onSubmit={(e) => void submitTier2(e)}>
            <UploadLine
              label="Bilhete de identidade (ou PDF)"
              hint="Nitidez suficiente para leitura dos dados — evite reflexos fortes."
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf"
              url={biPhotoUrl}
              onUrl={setBiPhotoUrl}
              token={token}
            />
            <UploadLine
              label="Selfie com o bilhete"
              hint="Mantenha BI e rosto dentro do enquadramento."
              accept="image/jpeg,image/png,image/webp,image/gif"
              url={selfiePhotoUrl}
              onUrl={setSelfiePhotoUrl}
              token={token}
            />
            <UploadLine
              label="Foto da loja (opcional)"
              hint="Só será usada ao público com o seu consentimento implícito e após revisão positiva."
              accept="image/jpeg,image/png,image/webp,image/gif"
              url={storePhotoUrl}
              onUrl={setStorePhotoUrl}
              token={token}
            />
            <button type="submit" className="btn btn-primary" disabled={saving2 || !biPhotoUrl.trim() || !selfiePhotoUrl.trim()}>
              {saving2 ? "A enviar…" : pending2 ? "Substituir ficheiros e reenviar" : "Submeter nível 2 para análise"}
            </button>
          </form>
        ) : null}
      </section>

      <section className={`page-panel ae-cred-tier ${approved2 ? "" : "ae-cred-tier--dim"}`}>
        <div className="ae-cred-tier__head">
          <span className="ae-cred-badge ae-cred-badge--gold">Nível 3</span>
          <h2>Selo premium — empresa e conta bancária</h2>
        </div>
        {!approved2 ? (
          <p className="ae-muted">
            Este passo abre apenas depois da aprovação do nível&nbsp;2 pela equipa administrativa.
          </p>
        ) : (
          <>
            {(pending3 || approved3 || rejected3) && (
              <p className="ae-muted" style={{ fontSize: 13 }}>
                {pending3 ? <>Em análise desde {fmtDate(shop.tier3SubmittedAt)}.</> : null}
                {approved3 ? <> Aprovado em {fmtDate(shop.tier3ApprovedAt)}.</> : null}
                {rejected3 ? (
                  <>
                    {" "}
                    <strong>Última decisão:</strong> {shop.tier3RejectedReason}
                  </>
                ) : null}
              </p>
            )}

            <form className="ae-form ae-field-grid-2" onSubmit={(e) => void submitTier3(e)}>
              <div>
                <label htmlFor="nifCred">NIF / contribuinte fiscal</label>
                <input id="nifCred" value={nif} onChange={(e) => setNif(e.target.value)} required minLength={5} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <UploadLine
                  label="Certidão / alvará (opcional)"
                  hint="PDF ou imagem; acelera a validação registal."
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf"
                  url={companyDocUrl}
                  onUrl={setCompanyDocUrl}
                  token={token}
                />
              </div>
              <div>
                <label htmlFor="holderCred">Titular da conta (recebimentos da loja)</label>
                <input id="holderCred" value={bankHolderName} onChange={(e) => setBankHolderName(e.target.value)} required minLength={2} />
              </div>
              <div>
                <label htmlFor="bankCred">Banco</label>
                <input id="bankCred" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Nome da instituição" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="ibanCred">IBAN</label>
                <input id="ibanCred" value={bankIban} onChange={(e) => setBankIban(e.target.value)} required minLength={15} spellCheck={false} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving3 || tier3SubmitLocked}
                  title={
                    tier3SubmitLocked
                      ? !approved2
                        ? "Aprove primeiro o nível 2"
                        : approved3
                          ? "Nível já aprovado"
                          : "Pedido na fila de análise"
                      : ""
                  }
                >
                  {saving3
                    ? "A enviar…"
                    : pending3
                      ? "Pedido em análise — aguarde"
                      : approved3
                        ? "Nível 3 aprovado"
                        : "Submeter nível 3 para análise"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
