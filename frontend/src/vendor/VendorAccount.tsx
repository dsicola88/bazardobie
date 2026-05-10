import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth, type AuthUser } from "../auth/AuthContext.js";

type GeoProvinceDto = { id: string; code: string; namePt: string };
type GeoMunicipalityDto = { id: string; namePt: string; provinceId: string };

/**
 * Dados pessoais da conta (`/auth/profile`), separados dos dados comerciais da loja em `/vendor/loja`.
 */
export default function VendorAccount() {
  const { token, user, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const [msg, setMsg] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [geoProvinces, setGeoProvinces] = useState<GeoProvinceDto[]>([]);
  const [geoProvinceId, setGeoProvinceId] = useState("");
  const [geoMunicipalities, setGeoMunicipalities] = useState<GeoMunicipalityDto[]>([]);
  const [geoMunicipalityId, setGeoMunicipalityId] = useState("");

  const [phoneDraft, setPhoneDraft] = useState("");
  const [neighborhoodDraft, setNeighborhoodDraft] = useState("");
  const [addressLineDraft, setAddressLineDraft] = useState("");

  const [savingPhone, setSavingPhone] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);

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
      `/shipping/geo/municipalities?provinceId=${encodeURIComponent(geoProvinceId)}`,
    )
      .then((r) => setGeoMunicipalities(r.items ?? []))
      .catch(() => setGeoMunicipalities([]));
  }, [geoProvinceId]);

  useEffect(() => {
    if (!token) return;
    setLoadErr(null);
    void refreshMe().catch(() => setLoadErr("Não foi possível sincronizar os dados da conta. Tente actualizar a página."));
  }, [token, refreshMe]);

  useEffect(() => {
    if (!user) return;
    setPhoneDraft(user.phone?.trim() ?? "");
    setNeighborhoodDraft(user.neighborhood?.trim() ?? "");
    setAddressLineDraft(user.addressLine?.trim() ?? "");
    if (user.municipality?.province?.id) setGeoProvinceId(user.municipality.province.id);
    else setGeoProvinceId("");
    if (user.municipality?.id) setGeoMunicipalityId(user.municipality.id);
    else setGeoMunicipalityId("");
  }, [user]);

  async function savePhone() {
    if (!token) return;
    const p = phoneDraft.trim();
    if (p.length < 6) {
      setMsg(null);
      setLoadErr("O telefone deve ter pelo menos 6 caracteres.");
      return;
    }
    setSavingPhone(true);
    setLoadErr(null);
    setMsg(null);
    try {
      await apiFetch<AuthUser>("/auth/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({ phone: p }),
      });
      await refreshMe();
      setMsg("Telefone da conta actualizado.");
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : "Não foi possível guardar o telefone.");
    } finally {
      setSavingPhone(false);
    }
  }

  async function saveAddress() {
    if (!token) return;
    if (!geoMunicipalityId.trim()) {
      setMsg(null);
      setLoadErr("Seleccione o município principal da conta.");
      return;
    }
    setSavingAddr(true);
    setLoadErr(null);
    setMsg(null);
    try {
      await apiFetch<AuthUser>("/auth/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          municipalityId: geoMunicipalityId.trim(),
          neighborhood: neighborhoodDraft.trim() || "",
          addressLine: addressLineDraft.trim() || "",
        }),
      });
      await refreshMe();
      setMsg("Morada principal da conta actualizada.");
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : "Não foi possível guardar a morada.");
    } finally {
      setSavingAddr(false);
    }
  }

  function onLogout() {
    logout();
    navigate("/", { replace: true });
  }

  if (!user) {
    return <p className="ae-muted">A carregar dados da conta…</p>;
  }

  return (
    <div className="ae-v-account">
      <h1 className="ae-v-title">Conta do utilizador</h1>
      <p className="ae-muted" style={{ marginTop: 0, marginBottom: 20, maxWidth: 640 }}>
        Estes dados são os da <strong>sua conta na plataforma</strong> (contacto e morada principal). São independentes
        dos dados comerciais da loja em «Dados da loja», mas devem estar correctos para comunicação da equipa e para
        quando também compra como cliente.
      </p>

      {loadErr ? (
        <div className="ae-admin-alert ae-admin-alert--err" role="alert" style={{ marginBottom: 16 }}>
          {loadErr}
        </div>
      ) : null}
      {msg ? (
        <div className="ae-admin-alert ae-admin-alert--ok" role="status" style={{ marginBottom: 16 }}>
          {msg}
        </div>
      ) : null}

      <div className="page-panel ae-v-account__panel">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Identificação</h2>
        <dl className="ae-v-account__dl">
          <div>
            <dt>Nome</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>E-mail da conta</dt>
            <dd>
              <span translate="no">{user.email}</span>
              <span className="ae-muted" style={{ display: "block", fontSize: 12, marginTop: 6 }}>
                O e-mail não pode ser alterado aqui. Para corrigir dados de registo, contacte o suporte do marketplace.
              </span>
            </dd>
          </div>
          <div>
            <dt>Perfil na plataforma</dt>
            <dd>{user.role === "VENDEDOR" ? "Parceiro (vendedor)" : user.role}</dd>
          </div>
        </dl>
      </div>

      <div className="page-panel ae-v-account__panel">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Telefone da conta</h2>
        <p className="ae-muted" style={{ fontSize: 13, marginTop: 0 }}>
          Usado para alertas e validações (ex.: activação de parceiro). Mínimo 6 caracteres.
        </p>
        <div className="form-stack" style={{ maxWidth: 420 }}>
          <label htmlFor="va-phone">Telefone</label>
          <input
            id="va-phone"
            type="tel"
            autoComplete="tel"
            value={phoneDraft}
            onChange={(e) => setPhoneDraft(e.target.value)}
            placeholder="+244 …"
          />
          <button type="button" className="btn btn-primary" disabled={savingPhone} onClick={() => void savePhone()}>
            {savingPhone ? "A guardar…" : "Guardar telefone"}
          </button>
        </div>
      </div>

      <div className="page-panel ae-v-account__panel">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Morada principal da conta</h2>
        <p className="ae-muted" style={{ fontSize: 13, marginTop: 0 }}>
          Catálogo oficial de província e município (Angola). Opcional: bairro e linha de morada para referência.
        </p>
        <div className="form-stack" style={{ maxWidth: 520 }}>
          <label htmlFor="va-province">Província</label>
          <select
            id="va-province"
            value={geoProvinceId}
            onChange={(e) => {
              setGeoProvinceId(e.target.value);
              setGeoMunicipalityId("");
            }}
          >
            <option value="">— Seleccionar —</option>
            {geoProvinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.namePt}
              </option>
            ))}
          </select>
          <label htmlFor="va-municipality">Município</label>
          <select
            id="va-municipality"
            value={geoMunicipalityId}
            onChange={(e) => setGeoMunicipalityId(e.target.value)}
            disabled={!geoProvinceId}
          >
            <option value="">— Seleccionar —</option>
            {geoMunicipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.namePt}
              </option>
            ))}
          </select>
          <label htmlFor="va-neighborhood">Bairro / zona (opcional)</label>
          <input
            id="va-neighborhood"
            value={neighborhoodDraft}
            onChange={(e) => setNeighborhoodDraft(e.target.value)}
            maxLength={160}
          />
          <label htmlFor="va-address">Morada livre (opcional)</label>
          <textarea
            id="va-address"
            rows={3}
            value={addressLineDraft}
            onChange={(e) => setAddressLineDraft(e.target.value)}
            maxLength={600}
          />
          <button type="button" className="btn btn-primary" disabled={savingAddr} onClick={() => void saveAddress()}>
            {savingAddr ? "A guardar…" : "Guardar morada principal"}
          </button>
        </div>
      </div>

      <div className="page-panel ae-v-account__panel">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Palavra-passe e segurança</h2>
        <p style={{ marginTop: 0, lineHeight: 1.55 }}>
          Para definir uma <strong>nova palavra-passe</strong>, termine a sessão e na página de entrada utilize{" "}
          <strong>«Esqueci a senha»</strong> com este mesmo e-mail — receberá um link seguro (válido por tempo limitado).
        </p>
        <p className="ae-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Se a sua conta foi criada apenas com <strong>Google</strong> ou <strong>Facebook</strong>, não há palavra-passe
          local: continue a usar o mesmo botão «Continuar com…» na página de entrada.
        </p>
        <p style={{ marginBottom: 0 }}>
          <Link className="btn" to={`/login?next=${encodeURIComponent("/vendor/conta")}`}>
            Abrir página de entrada
          </Link>
        </p>
      </div>

      <div className="page-panel ae-v-account__panel">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Sessão</h2>
        <p className="ae-muted" style={{ marginTop: 0 }}>
          Terminar sessão neste dispositivo. Necessitará de voltar a autenticar-se para aceder ao painel de parceiro.
        </p>
        <button type="button" className="btn btn-ghost" onClick={onLogout}>
          Terminar sessão
        </button>
      </div>
    </div>
  );
}
