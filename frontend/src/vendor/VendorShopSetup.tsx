import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, uploadAdminFile } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type ShopMe = {
  id: string;
  name: string;
  isApproved: boolean;
  province: string;
  city: string;
};

export default function VendorShopSetup() {
  const { token } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [existing, setExisting] = useState<ShopMe | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [ownerResponsibleName, setOwnerResponsibleName] = useState("");
  const [description, setDescription] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    setLoadErr(null);
    void apiFetch<ShopMe>("/vendor/shop/me", { token })
      .then((s) => setExisting(s))
      .catch((e: unknown) => {
        const st = e && typeof e === "object" && "status" in e ? Number((e as { status: number }).status) : 0;
        if (st === 404) {
          setExisting(null);
          return;
        }
        setExisting(undefined);
        setLoadErr(e instanceof Error ? e.message : "Não foi possível carregar a sua loja");
      });
  }, [token, loadKey]);

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !token) return;
    setUploading(true);
    setErr(null);
    try {
      const url = await uploadAdminFile(token, f);
      setLogoUrl(url);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      await apiFetch("/vendor/shop", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: name.trim(),
          ownerResponsibleName: ownerResponsibleName.trim(),
          description: description.trim() || undefined,
          province: province.trim(),
          city: city.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim(),
          logoUrl: logoUrl.trim() || undefined,
        }),
      });
      setMsg("Loja registada. A nossa equipa vai analisar e aprovar antes de aparecer na loja pública.");
      setTimeout(() => nav("/vendor", { replace: true }), 1600);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Não foi possível registar a loja.");
    } finally {
      setSaving(false);
    }
  }

  if (loadErr) {
    return (
      <div className="ae-panel" style={{ maxWidth: 520 }}>
        <h2 className="ae-v-title" style={{ marginTop: 0 }}>
          Não foi possível carregar os dados
        </h2>
        <p className="ae-muted">{loadErr}</p>
        <button type="button" className="btn btn-primary" onClick={() => setLoadKey((k) => k + 1)}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (existing === undefined) {
    return <p className="ae-muted">A carregar…</p>;
  }

  if (existing) {
    return (
      <div>
        <header className="ae-v-head">
          <h1 className="ae-v-title">A minha loja</h1>
        </header>
        <div className="ae-panel">
          <p>
            <strong>{existing.name}</strong> · {existing.city}, {existing.province}
          </p>
          <p className="ae-muted">
            Estado:{" "}
            <strong>
              {existing.isApproved
                ? "Aprovada — pode criar produtos (cada anúncio passa ainda por moderação antes de aparecer na loja pública)."
                : "Pendente — a loja não é pública e não pode criar produtos até a equipa aprovar."}
            </strong>
          </p>
          <Link to="/vendor" className="btn btn-primary" style={{ marginTop: 12 }}>
            Voltar ao painel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="ae-v-head">
        <div>
          <h1 className="ae-v-title">Dados da loja (nível 1)</h1>
          <p className="ae-muted" style={{ margin: "6px 0 0" }}>
            Informação obrigatória para abrir a loja. Depois de submeter, a equipa BAZAR DO BIÉ valida antes da loja
            aparecer nas pesquisas públicas.
          </p>
        </div>
      </header>

      {msg ? (
        <div className="ae-admin-alert ae-admin-alert--ok" role="status">
          {msg}
        </div>
      ) : null}
      {err ? (
        <div className="ae-admin-alert ae-admin-alert--err" role="alert">
          {err}
        </div>
      ) : null}

      <form className="ae-panel ae-form" onSubmit={(e) => void submit(e)} style={{ maxWidth: 640 }}>
        <div className="ae-field-grid-2">
          <div>
            <label htmlFor="sn">Nome da loja</label>
            <input id="sn" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="Ex.: Tecidos Luena" />
          </div>
          <div>
            <label htmlFor="own">Nome do responsável</label>
            <input id="own" value={ownerResponsibleName} onChange={(e) => setOwnerResponsibleName(e.target.value)} required minLength={2} />
          </div>
        </div>
        <div>
          <label htmlFor="desc">Descrição (opcional)</label>
          <textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que vende, horário de contacto, etc." />
        </div>
        <div className="ae-field-grid-2">
          <div>
            <label htmlFor="prov">Província</label>
            <input id="prov" value={province} onChange={(e) => setProvince(e.target.value)} required minLength={2} />
          </div>
          <div>
            <label htmlFor="cit">Cidade / município</label>
            <input id="cit" value={city} onChange={(e) => setCity(e.target.value)} required minLength={2} />
          </div>
        </div>
        <div className="ae-field-grid-2">
          <div>
            <label htmlFor="ph">Telefone da loja</label>
            <input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={6} autoComplete="tel" />
          </div>
          <div>
            <label htmlFor="wa">WhatsApp</label>
            <input id="wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required minLength={6} placeholder="9xx xxx xxx" />
          </div>
        </div>
        <div>
          <label>Logótipo (opcional)</label>
          <p className="ae-field-hint">URL ou carregar imagem (PNG/JPG).</p>
          <div className="ae-input-row">
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
            <button type="button" className="btn" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? "A carregar…" : "Carregar logótipo"}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void onLogo(e)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "A enviar…" : "Submeter loja para análise"}
        </button>
      </form>
    </div>
  );
}
