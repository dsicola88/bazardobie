import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, uploadAdminFile } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type GeoProvinceDto = { id: string; code: string; namePt: string };
type GeoMunicipalityDto = { id: string; namePt: string; provinceId: string };

type ShopMe = {
  id: string;
  name: string;
  ownerResponsibleName?: string | null;
  description?: string | null;
  isApproved: boolean;
  province: string;
  city: string;
  phone?: string | null;
  whatsapp?: string | null;
  logoUrl?: string | null;
  municipalityId?: string | null;
  municipality?: {
    id: string;
    namePt: string;
    code: string;
    province: { namePt: string; code: string };
  } | null;
};

export default function VendorShopSetup() {
  const { token } = useAuth();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [existing, setExisting] = useState<ShopMe | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [ownerResponsibleName, setOwnerResponsibleName] = useState("");
  const [description, setDescription] = useState("");
  const [geoProvinces, setGeoProvinces] = useState<GeoProvinceDto[]>([]);
  const [geoProvinceId, setGeoProvinceId] = useState("");
  const [geoMunicipalities, setGeoMunicipalities] = useState<GeoMunicipalityDto[]>([]);
  const [municipalityId, setMunicipalityId] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const editRequested = searchParams.get("editar") === "1";
  const isEditing = Boolean(existing && editRequested);

  useEffect(() => {
    void apiFetch<{ items: GeoProvinceDto[] }>("/shipping/geo/provinces")
      .then((r) => setGeoProvinces(r.items ?? []))
      .catch(() => setGeoProvinces([]));
  }, []);

  useEffect(() => {
    if (!geoProvinceId) {
      setGeoMunicipalities([]);
      return;
    }
    void apiFetch<{ items: GeoMunicipalityDto[] }>(
      `/shipping/geo/municipalities?provinceId=${encodeURIComponent(geoProvinceId)}`
    )
      .then((r) => setGeoMunicipalities(r.items ?? []))
      .catch(() => setGeoMunicipalities([]));
  }, [geoProvinceId]);

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

  useEffect(() => {
    if (!existing || !isEditing) return;
    setName(existing.name ?? "");
    setOwnerResponsibleName(existing.ownerResponsibleName ?? "");
    setDescription(existing.description ?? "");
    setPhone(existing.phone ?? "");
    setWhatsapp(existing.whatsapp ?? "");
    setLogoUrl(existing.logoUrl ?? "");
    const provId = geoProvinces.find((p) => p.namePt.toLowerCase() === (existing.province ?? "").toLowerCase())?.id ?? "";
    if (provId) setGeoProvinceId(provId);
    if (existing.municipalityId) setMunicipalityId(existing.municipalityId);
  }, [existing, isEditing, geoProvinces]);

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
    const mid = municipalityId.trim();
    if (!mid) {
      setErr("Seleccione província e município na lista oficial (localização estrutural).");
      return;
    }
    setSaving(true);
    try {
      const method = existing ? "PATCH" : "POST";
      await apiFetch("/vendor/shop", {
        method,
        token,
        body: JSON.stringify({
          name: name.trim(),
          ownerResponsibleName: ownerResponsibleName.trim(),
          description: description.trim() || undefined,
          municipalityId: mid,
          phone: phone.trim(),
          whatsapp: whatsapp.trim(),
          logoUrl: logoUrl.trim() || undefined,
        }),
      });
      setMsg(
        existing
          ? "Dados da loja actualizados com sucesso."
          : "Loja registada. A nossa equipa vai analisar e aprovar antes de aparecer na loja pública."
      );
      if (existing) {
        setTimeout(() => {
          const next = new URLSearchParams(searchParams);
          next.delete("editar");
          setSearchParams(next, { replace: true });
          setLoadKey((k) => k + 1);
        }, 800);
      } else {
        setTimeout(() => nav("/vendor", { replace: true }), 1600);
      }
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Não foi possível guardar os dados da loja.");
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

  if (existing && !isEditing) {
    const catLabel =
      existing.municipality?.namePt && existing.municipality?.province?.namePt
        ? `${existing.municipality.namePt} · ${existing.municipality.province.namePt} (catálogo)`
        : null;
    return (
      <div>
        <header className="ae-v-head">
          <h1 className="ae-v-title">A minha loja</h1>
        </header>
        <div className="ae-panel">
          <p>
            <strong>{existing.name}</strong>
            <br />
            <span style={{ marginTop: 6, display: "inline-block" }}>
              {existing.city}, {existing.province}
            </span>
            {catLabel ? (
              <>
                <br />
                <span className="ae-muted" style={{ fontSize: 13 }}>
                  {catLabel}
                </span>
              </>
            ) : null}
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
          <button
            type="button"
            className="btn"
            style={{ marginTop: 12, marginLeft: 8 }}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set("editar", "1");
              setSearchParams(next, { replace: true });
            }}
          >
            Editar dados da loja
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="ae-v-head">
        <div>
          <h1 className="ae-v-title">{isEditing ? "Editar dados da loja" : "Dados da loja (nível 1)"}</h1>
          <p className="ae-muted" style={{ margin: "6px 0 0" }}>
            A localização da loja utiliza o mesmo catálogo oficial de Angola que o cliente vê no checkout — sem texto
            livre de província/município, para alinhar com fretes e estatísticas. Depois de submeter, a equipa BAZAR DO BIÉ
            valida antes da loja aparecer nas pesquisas públicas.
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
        <div>
          <label htmlFor="vss-prov">Província · catálogo oficial</label>
          <select
            id="vss-prov"
            required
            value={geoProvinceId}
            onChange={(e) => {
              setGeoProvinceId(e.target.value);
              setMunicipalityId("");
            }}
          >
            <option value="">— seleccione —</option>
            {geoProvinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.namePt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="vss-mun">Município / comuna (sede da loja)</label>
          <select
            id="vss-mun"
            required
            disabled={!geoProvinceId}
            value={municipalityId}
            onChange={(e) => setMunicipalityId(e.target.value)}
          >
            <option value="">{geoProvinceId ? "— seleccione —" : "— primeiro escolha a província —"}</option>
            {geoMunicipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.namePt}
              </option>
            ))}
          </select>
          <p className="ae-field-hint">Este campo alinha a sua loja com fretes estruturais e com o formulário dos compradores.</p>
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
          {saving ? "A guardar…" : isEditing ? "Guardar alterações da loja" : "Submeter loja para análise"}
        </button>
      </form>
    </div>
  );
}
