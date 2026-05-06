import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type Band = {
  id: string;
  name: string;
  minDistanceKm: string | number;
  maxDistanceKm: string | number;
  price: string | number;
  sortOrder: number;
  active: boolean;
  notes?: string | null;
};

type Locality = {
  id: string;
  label: string;
  province: string;
  city: string;
  latitude: string | number;
  longitude: string | number;
  sortOrder: number;
  active: boolean;
  municipalityId?: string | null;
  municipality?: { id: string; namePt: string; province: { code: string; namePt: string } } | null;
};

type ShippingZone = {
  id: string;
  province: string;
  city: string;
  label: string | null;
  price: string | number;
  sortOrder: number;
  active: boolean;
  notes?: string | null;
  municipalityId?: string | null;
  municipality?: {
    id: string;
    namePt: string;
    code: string;
    province: { id: string; code: string; namePt: string };
  } | null;
};

type GeoMunicipalityAdmin = {
  id: string;
  namePt: string;
  code: string;
  province: { id: string; code: string; namePt: string; sortOrder: number };
};

const bandEmpty = {
  name: "",
  minDistanceKm: "0",
  maxDistanceKm: "15",
  price: "1000",
  sortOrder: "0",
};
const locEmpty = { label: "", municipalityId: "", latitude: "", longitude: "", sortOrder: "0" };
const zoneEmpty = {
  municipalityId: "",
  label: "",
  price: "1500",
  sortOrder: "0",
};

export default function AdminFreight() {
  const { token } = useAuth();
  const [bands, setBands] = useState<Band[] | null>(null);
  const [localities, setLocalities] = useState<Locality[] | null>(null);
  const [zones, setZones] = useState<ShippingZone[] | null>(null);
  const [bandForm, setBandForm] = useState(bandEmpty);
  const [locForm, setLocForm] = useState(locEmpty);
  const [zoneForm, setZoneForm] = useState(zoneEmpty);
  const [catalogMunicipalities, setCatalogMunicipalities] = useState<GeoMunicipalityAdmin[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [qZone, setQZone] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [b, l, zz, mun] = await Promise.all([
        apiFetch<{ items: Band[] }>("/admin/freight/distance-bands", { token }),
        apiFetch<{ items: Locality[] }>("/admin/freight/localities", { token }),
        apiFetch<{ items: ShippingZone[] }>("/admin/freight/zones", { token }),
        apiFetch<{ items: GeoMunicipalityAdmin[] }>("/admin/shipping/geo/municipalities", { token }),
      ]);
      setBands(b.items);
      setLocalities(l.items);
      setZones(zz.items);
      setCatalogMunicipalities(mun.items ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar frete.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitBand(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/admin/freight/distance-bands", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: bandForm.name.trim(),
          minDistanceKm: Number(bandForm.minDistanceKm),
          maxDistanceKm: Number(bandForm.maxDistanceKm),
          price: Number(bandForm.price),
          sortOrder: Number(bandForm.sortOrder) || 0,
        }),
      });
      setMsg("Faixa registada.");
      setBandForm(bandEmpty);
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function submitLoc(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/admin/freight/localities", {
        method: "POST",
        token,
        body: JSON.stringify({
          label: locForm.label.trim(),
          municipalityId: locForm.municipalityId.trim(),
          latitude: Number(locForm.latitude),
          longitude: Number(locForm.longitude),
          sortOrder: Number(locForm.sortOrder) || 0,
        }),
      });
      setMsg("Localidade registada.");
      setLocForm(locEmpty);
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function toggleBandActive(b: Band) {
    if (!token) return;
    setErr(null);
    try {
      await apiFetch(`/admin/freight/distance-bands/${b.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ active: !b.active }),
      });
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function toggleLocActive(lrow: Locality) {
    if (!token) return;
    setErr(null);
    try {
      await apiFetch(`/admin/freight/localities/${lrow.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ active: !lrow.active }),
      });
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function submitZone(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/admin/freight/zones", {
        method: "POST",
        token,
        body: JSON.stringify({
          municipalityId: zoneForm.municipalityId.trim(),
          label: zoneForm.label.trim() || null,
          price: Number(zoneForm.price),
          sortOrder: Number(zoneForm.sortOrder) || 0,
        }),
      });
      setMsg("Zona por morada registada.");
      setZoneForm(zoneEmpty);
      void load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Erro");
    }
  }

  async function toggleZoneActive(z: ShippingZone) {
    if (!token) return;
    setErr(null);
    try {
      await apiFetch(`/admin/freight/zones/${z.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ active: !z.active }),
      });
      void load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Erro");
    }
  }

  const filteredZones = (zones ?? []).filter((z) => {
    const blob = `${z.label ?? ""} ${z.city} ${z.province} ${z.municipality?.namePt ?? ""}`.toLowerCase();
    return blob.includes(qZone.trim().toLowerCase());
  });

  return (
    <div className="ae-admin-page" style={{ maxWidth: 1100 }}>
      <h1 className="ae-v-title">Fretes por morada e por distância</h1>
      <p className="ae-muted" style={{ marginTop: 8, lineHeight: 1.55 }}>
        <strong>Modo recomendado:</strong> catálogo Angola (província → município) no checkout. O preço de{" "}
        <em>frete por zona</em> associa‑se a um <strong>município</strong> (não a texto livre), evitando erros de digitação.
        O modo GPS continua disponível com âncoras ligadas ao mesmo município. Activar modos em Textos da loja (
        <code>public.zone_freight_enabled</code> / <code>public.distance_freight_enabled</code> + hub Lat/Lng quando
        aplicável).
      </p>

      {msg ? (
        <div className="ae-admin-alert ae-admin-alert--ok" role="status" style={{ marginTop: 16 }}>
          {msg}
        </div>
      ) : null}
      {err ? (
        <div className="ae-admin-alert ae-admin-alert--err" role="alert" style={{ marginTop: 16 }}>
          {err}
        </div>
      ) : null}

      <section className="ae-panel" style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Zonas por município (frete fixo)</h2>
        <p className="ae-muted" style={{ fontSize: 13 }}>
          O cliente selecciona província/município no catálogo — o preço aplica‑se a todo o pedido da loja. Um município
          só pode ter uma tarifa activa (cadastro único).
        </p>
        {!zones ? (
          <p className="ae-muted">A carregar…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ marginBottom: 10, maxWidth: 360 }}>
              <input
                className="ae-input"
                value={qZone}
                onChange={(e) => setQZone(e.target.value)}
                placeholder="Filtrar zonas por provincia, municipio..."
              />
            </div>
            <table className="ae-admin-table" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th>Etiqueta</th>
                  <th>Município (catálogo)</th>
                  <th>Prov / mun. (legado)</th>
                  <th>Preço (Kz)</th>
                  <th>Ordem</th>
                  <th>Activo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredZones.map((z) => (
                  <tr key={z.id}>
                    <td>{z.label ?? "—"}</td>
                    <td>
                      {z.municipality
                        ? `${z.municipality.namePt} (${z.municipality.province.namePt})`
                        : "— (ligue um município)"}
                    </td>
                    <td>
                      {z.city}, {z.province}
                    </td>
                    <td>{String(z.price)}</td>
                    <td>{z.sortOrder}</td>
                    <td>{z.active ? "Sim" : "Não"}</td>
                    <td>
                      <button type="button" className="btn" onClick={() => void toggleZoneActive(z)}>
                        {z.active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form className="ae-form ae-field-grid-2" onSubmit={(e) => void submitZone(e)} style={{ marginTop: 20 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Município (catálogo oficial)</label>
            <select
              value={zoneForm.municipalityId}
              onChange={(e) => setZoneForm((f) => ({ ...f, municipalityId: e.target.value }))}
              required
            >
              <option value="">— seleccione —</option>
              {(catalogMunicipalities ?? []).map((mu) => (
                <option key={mu.id} value={mu.id}>
                  {mu.province.namePt} — {mu.namePt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Etiqueta admin (opcional)</label>
            <input value={zoneForm.label} onChange={(e) => setZoneForm((f) => ({ ...f, label: e.target.value }))} />
          </div>
          <div>
            <label>Ordem</label>
            <input
              value={zoneForm.sortOrder}
              onChange={(e) => setZoneForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </div>
          <div>
            <label>Preço pedido inteiro (Kz)</label>
            <input
              value={zoneForm.price}
              onChange={(e) => setZoneForm((f) => ({ ...f, price: e.target.value }))}
              required
            />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button type="submit" className="btn btn-primary">
              Registar zona
            </button>
          </div>
        </form>
      </section>

      <section className="ae-panel" style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Faixas por quilómetro (opcional)</h2>
        <p className="ae-muted" style={{ fontSize: 13 }}>
          Cada linha aplicável quando km ≥ min e &lt; max. Última faixa habitual: intervalo alto (ex.: 99999).
        </p>
        {!bands ? (
          <p className="ae-muted">A carregar…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="ae-admin-table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Min km</th>
                  <th>Max km</th>
                  <th>Preço (Kz)</th>
                  <th>Ordem</th>
                  <th>Activo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bands.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td>{String(b.minDistanceKm)}</td>
                    <td>{String(b.maxDistanceKm)}</td>
                    <td>{String(b.price)}</td>
                    <td>{b.sortOrder}</td>
                    <td>{b.active ? "Sim" : "Não"}</td>
                    <td>
                      <button type="button" className="btn" onClick={() => void toggleBandActive(b)}>
                        {b.active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form className="ae-form ae-field-grid-2" onSubmit={(e) => void submitBand(e)} style={{ marginTop: 20 }}>
          <div>
            <label>Nova faixa · nome</label>
            <input value={bandForm.name} onChange={(e) => setBandForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label>Ordem</label>
            <input value={bandForm.sortOrder} onChange={(e) => setBandForm((f) => ({ ...f, sortOrder: e.target.value }))} />
          </div>
          <div>
            <label>Min km (inclusivo)</label>
            <input value={bandForm.minDistanceKm} onChange={(e) => setBandForm((f) => ({ ...f, minDistanceKm: e.target.value }))} required />
          </div>
          <div>
            <label>Max km (exclusivo)</label>
            <input value={bandForm.maxDistanceKm} onChange={(e) => setBandForm((f) => ({ ...f, maxDistanceKm: e.target.value }))} required />
          </div>
          <div>
            <label>Preço total do pedido (Kz)</label>
            <input value={bandForm.price} onChange={(e) => setBandForm((f) => ({ ...f, price: e.target.value }))} required />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button type="submit" className="btn btn-primary">
              Adicionar faixa
            </button>
          </div>
        </form>
      </section>

      <section className="ae-panel" style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Âncoras GPS (modo distância)</h2>
        <p className="ae-muted" style={{ fontSize: 13 }}>
          Cada âncora deve estar ligada a um município do catálogo — no checkout só aparecem as âncoras do município
          seleccionado. Coordenadas WGS‑84 (decimais).
        </p>
        {!localities ? (
          <p className="ae-muted">A carregar…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="ae-admin-table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Etiqueta</th>
                  <th>Município</th>
                  <th>Prov / mun. texto</th>
                  <th>Lat</th>
                  <th>Lng</th>
                  <th>Activo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {localities.map((l) => (
                  <tr key={l.id}>
                    <td>{l.label}</td>
                    <td>{l.municipality ? `${l.municipality.namePt}` : "—"}</td>
                    <td>
                      {l.city}, {l.province}
                    </td>
                    <td>{String(l.latitude)}</td>
                    <td>{String(l.longitude)}</td>
                    <td>{l.active ? "Sim" : "Não"}</td>
                    <td>
                      <button type="button" className="btn" onClick={() => void toggleLocActive(l)}>
                        {l.active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form className="ae-form ae-field-grid-2" onSubmit={(e) => void submitLoc(e)} style={{ marginTop: 20 }}>
          <div>
            <label>Etiqueta pública</label>
            <input value={locForm.label} onChange={(e) => setLocForm((f) => ({ ...f, label: e.target.value }))} required />
          </div>
          <div>
            <label>Ordem</label>
            <input value={locForm.sortOrder} onChange={(e) => setLocForm((f) => ({ ...f, sortOrder: e.target.value }))} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Município (liga ao checkout estrutural)</label>
            <select
              value={locForm.municipalityId}
              onChange={(e) => setLocForm((f) => ({ ...f, municipalityId: e.target.value }))}
              required
            >
              <option value="">— seleccione —</option>
              {(catalogMunicipalities ?? []).map((mu) => (
                <option key={mu.id} value={mu.id}>
                  {mu.province.namePt} — {mu.namePt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Latitude</label>
            <input value={locForm.latitude} onChange={(e) => setLocForm((f) => ({ ...f, latitude: e.target.value }))} required />
          </div>
          <div>
            <label>Longitude</label>
            <input value={locForm.longitude} onChange={(e) => setLocForm((f) => ({ ...f, longitude: e.target.value }))} required />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="btn btn-primary">
              Registar localidade
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
