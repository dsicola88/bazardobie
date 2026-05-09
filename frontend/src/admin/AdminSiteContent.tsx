import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, uploadAdminFile } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { resolveMediaUrl } from "../utils/media.js";

type Item = {
  key: string;
  label: string;
  value: string;
  defaultValue: string;
  hint?: string;
};

export default function AdminSiteContent() {
  const token = useAuth().token;
  const [items, setItems] = useState<Item[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingPromoImage, setUploadingPromoImage] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const s = await apiFetch<{ items: Item[] }>("/admin/site-settings", { token });
      setItems(s.items);
      const v: Record<string, string> = {};
      for (const it of s.items) v[it.key] = it.value;
      setValues(v);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!token) return;
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      await apiFetch("/admin/site-settings", {
        method: "PUT",
        token,
        body: JSON.stringify({ settings: values }),
      });
      setMsg("Configurações publicadas com sucesso.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function onUploadFavicon(file: File | null) {
    if (!token || !file) return;
    setErr(null);
    setMsg(null);
    setUploadingFavicon(true);
    try {
      const url = await uploadAdminFile(token, file);
      setValues((prev) => ({ ...prev, "public.favicon_url": url }));
      setMsg("Favicon carregado. Clique em \"Guardar textos\" para publicar.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível carregar favicon.");
    } finally {
      setUploadingFavicon(false);
    }
  }

  async function onUploadPromoImage(file: File | null) {
    if (!token || !file) return;
    setErr(null);
    setMsg(null);
    setUploadingPromoImage(true);
    try {
      const url = await uploadAdminFile(token, file);
      setValues((prev) => ({ ...prev, "public.header_promo_image_url": url }));
      setMsg("Imagem da promoção carregada. Clique em \"Guardar textos\" para publicar.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível carregar imagem da promoção.");
    } finally {
      setUploadingPromoImage(false);
    }
  }

  const PROMO_KEYS = new Set([
    "public.header_promo_bar_enabled",
    "public.header_promo_popup_enabled",
    "public.header_promo_enabled",
    "public.header_promo_mode",
    "public.header_promo_text",
    "public.header_promo_popup_text",
    "public.header_promo_bar_start_at",
    "public.header_promo_bar_end_at",
    "public.header_promo_popup_start_at",
    "public.header_promo_popup_end_at",
    "public.header_promo_start_at",
    "public.header_promo_end_at",
    "public.header_promo_priority",
    "public.header_promo_position",
    "public.header_promo_delay_seconds",
    "public.header_promo_cta_text",
    "public.header_promo_link_url",
    "public.header_promo_price",
    "public.header_promo_image_url",
    "public.header_promo_keywords",
    "public.header_promo_popup_keywords",
    "public.header_promo_marquee",
  ]);

  function triSelect(
    key: "public.header_promo_bar_enabled" | "public.header_promo_popup_enabled",
    label: string,
    id: string
  ) {
    const raw = (values[key] ?? "").trim();
    return (
      <div style={{ marginBottom: 12 }}>
        <label htmlFor={id} style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
          {label}
        </label>
        <select
          id={id}
          value={raw === "true" || raw === "1" ? "true" : raw === "false" || raw === "0" ? "false" : ""}
          onChange={(e) => {
            const v = e.target.value;
            setValues((prev) => ({ ...prev, [key]: v === "" ? "" : v }));
          }}
        >
          <option value="">Automático — usa «Modo único antigo» abaixo</option>
          <option value="true">Ligado (sempre que o conteúdo e o calendário permitirem)</option>
          <option value="false">Desligado</option>
        </select>
        <p className="ae-muted" style={{ margin: "6px 0 0", fontSize: 11 }}>
          Com ambos em «Automático», vale apenas um dos dois conforme o modo legado (barra ou popup).
        </p>
      </div>
    );
  }

  return (
    <div className="ae-admin-pro ae-admin-canvas-wide">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Configurações do site</h1>
          <p className="ae-admin-pro__sub">
            Textos públicos, campanhas no topo, favicon e regras de negócio. Para dar acesso a <strong>suporte</strong>,{" "}
            <strong>logística</strong> ou outros perfis, use{" "}
            <Link to="/admin/team" style={{ fontWeight: 700 }}>
              Equipa, suporte e logística
            </Link>
            .
          </p>
        </div>
      </header>

      <div className="ae-admin-next">
        <div>
          <h2>Carrossel de imagens</h2>
          <p>
            Crie e ordenize os slides principais da página inicial — com upload, pré-visualização e activação imediata.
          </p>
        </div>
        <Link to="/admin/banners" className="btn btn-primary">
          Gerir banners
        </Link>
      </div>

      <div className="ae-admin-callout ae-admin-callout--soft" style={{ marginBottom: 18 }}>
        <strong>Suporte e equipa interna.</strong> Não se cadastram aqui: crie a conta em{" "}
        <Link to="/login?register=1">Registo público</Link> e depois, em{" "}
        <Link to="/admin/team">Equipa, suporte e logística</Link>, altere o papel para <strong>SUPORTE</strong>,{" "}
        <strong>LOGISTICA</strong>, etc. Só administradores da plataforma vêem essa página.
      </div>

      {err ? (
        <div className="ae-admin-alert ae-admin-alert--err" role="alert">
          {err}
        </div>
      ) : null}
      {msg ? (
        <div className="ae-admin-alert ae-admin-alert--ok" role="status">
          {msg}
        </div>
      ) : null}

      <div className="ae-panel" style={{ borderRadius: 10 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>Textos e parâmetros</h2>
        <p className="ae-muted" style={{ margin: "0 0 18px", fontSize: 13 }}>
          Os valores por defeito aparecem em cinza sob cada campo. A faixa de confiança usa o formato{" "}
          <code>título|descrição</code>.
        </p>

        <div className="ae-panel" style={{ marginBottom: 16, background: "#f5f9ff", borderColor: "#b8d4ec" }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Ajuda para vendedores (canal de vídeos)</h3>
          <p className="ae-muted" style={{ marginTop: 0, fontSize: 12 }}>
            O link configurado aqui aparece na área do vendedor em <strong>Aprender a usar a app</strong> e abre
            diretamente o canal de vídeos.
          </p>
          <label htmlFor="public.vendor_help_channel_url" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
            URL do canal
          </label>
          <input
            id="public.vendor_help_channel_url"
            value={values["public.vendor_help_channel_url"] ?? ""}
            onChange={(e) => setValues((prev) => ({ ...prev, "public.vendor_help_channel_url": e.target.value }))}
            placeholder="https://www.youtube.com/@seu-canal"
          />
        </div>

        <div className="ae-panel ae-admin-promo-wrap" style={{ marginBottom: 16, background: "#fff7f2", borderColor: "#f3c2b1" }}>
          <h3 style={{ marginTop: 0, marginBottom: 6 }}>Campanhas no topo do site</h3>
          <p className="ae-muted" style={{ marginTop: 0, fontSize: 13, lineHeight: 1.5 }}>
            A <strong>barra vermelha</strong> e o <strong>popup</strong> são independentes: pode ligar só um, os dois ao mesmo
            tempo, ou nenhum. Cada um tem o seu horário e conteúdo.
          </p>

          <div className="ae-admin-promo-split">
            <div className="ae-panel" style={{ margin: 0, background: "#fff", borderColor: "#ead5cb" }}>
              <h4 style={{ margin: "0 0 10px", fontSize: 15 }}>Barra compacta</h4>
              {triSelect("public.header_promo_bar_enabled", "Estado da barra", "hdr_bar_en")}
              <label htmlFor="public.header_promo_text" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                Texto na faixa
              </label>
              <input
                id="public.header_promo_text"
                value={values["public.header_promo_text"] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_text": e.target.value }))}
                placeholder="Ex.: Promoções até 30% · entrega rápida"
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 12 }}>
                <div>
                  <label htmlFor="public.header_promo_bar_start_at" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Início da barra
                  </label>
                  <input
                    id="public.header_promo_bar_start_at"
                    type="datetime-local"
                    value={values["public.header_promo_bar_start_at"] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_bar_start_at": e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="public.header_promo_bar_end_at" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Fim da barra
                  </label>
                  <input
                    id="public.header_promo_bar_end_at"
                    type="datetime-local"
                    value={values["public.header_promo_bar_end_at"] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_bar_end_at": e.target.value }))}
                  />
                </div>
              </div>
              <p className="ae-muted" style={{ margin: "8px 0 0", fontSize: 11 }}>
                Se deixar as datas da barra vazias, usa o intervalo «Legado» no fim desta secção (se também estiver vazio para o popup).
              </p>
              <label
                htmlFor="public.header_promo_keywords"
                style={{ fontWeight: 700, display: "block", margin: "12px 0 6px" }}
              >
                Chips na barra (|)
              </label>
              <textarea
                id="public.header_promo_keywords"
                rows={2}
                value={values["public.header_promo_keywords"] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_keywords": e.target.value }))}
              />
              <label className="ae-check" htmlFor="public.header_promo_marquee" style={{ marginTop: 10 }}>
                <input
                  id="public.header_promo_marquee"
                  type="checkbox"
                  checked={(values["public.header_promo_marquee"] ?? "true").trim().toLowerCase() === "true"}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      "public.header_promo_marquee": e.target.checked ? "true" : "false",
                    }))
                  }
                />
                <span>Animar chips (marquee)</span>
              </label>
            </div>

            <div className="ae-panel" style={{ margin: 0, background: "#fff", borderColor: "#ead5cb" }}>
              <h4 style={{ margin: "0 0 10px", fontSize: 15 }}>Popup ao visitar</h4>
              {triSelect("public.header_promo_popup_enabled", "Estado do popup", "hdr_popup_en")}
              <label htmlFor="public.header_promo_popup_text" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                Mensagem do card (independente da barra)
              </label>
              <input
                id="public.header_promo_popup_text"
                value={values["public.header_promo_popup_text"] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_popup_text": e.target.value }))}
                placeholder="Se vazio no site, o popup reutiliza o texto da barra."
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 12 }}>
                <div>
                  <label htmlFor="public.header_promo_popup_start_at" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Início do popup
                  </label>
                  <input
                    id="public.header_promo_popup_start_at"
                    type="datetime-local"
                    value={values["public.header_promo_popup_start_at"] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_popup_start_at": e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="public.header_promo_popup_end_at" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Fim do popup
                  </label>
                  <input
                    id="public.header_promo_popup_end_at"
                    type="datetime-local"
                    value={values["public.header_promo_popup_end_at"] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_popup_end_at": e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="public.header_promo_delay_seconds" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Atraso (s)
                  </label>
                  <input
                    id="public.header_promo_delay_seconds"
                    type="number"
                    min={0}
                    max={180}
                    value={values["public.header_promo_delay_seconds"] ?? "2"}
                    onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_delay_seconds": e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="public.header_promo_priority" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Prioridade / camadas
                  </label>
                  <input
                    id="public.header_promo_priority"
                    type="number"
                    value={values["public.header_promo_priority"] ?? "50"}
                    onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_priority": e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label htmlFor="public.header_promo_position" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Posição
                </label>
                <select
                  id="public.header_promo_position"
                  value={values["public.header_promo_position"] ?? "center"}
                  onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_position": e.target.value }))}
                >
                  <option value="center">Centro</option>
                  <option value="top-right">Topo à direita</option>
                  <option value="bottom-right">Fundo à direita</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 12 }}>
                <div>
                  <label htmlFor="public.header_promo_price" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Preço em destaque
                  </label>
                  <input
                    id="public.header_promo_price"
                    value={values["public.header_promo_price"] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_price": e.target.value }))}
                    placeholder="Kz 9.900"
                  />
                </div>
                <div>
                  <label htmlFor="public.header_promo_cta_text" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Texto do botão
                  </label>
                  <input
                    id="public.header_promo_cta_text"
                    value={values["public.header_promo_cta_text"] ?? "Comprar agora"}
                    onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_cta_text": e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label htmlFor="public.header_promo_link_url" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Link do botão
                </label>
                <input
                  id="public.header_promo_link_url"
                  value={values["public.header_promo_link_url"] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_link_url": e.target.value }))}
                  placeholder="https://... ou /search?..."
                />
              </div>
              <label
                htmlFor="public.header_promo_popup_keywords"
                style={{ fontWeight: 700, display: "block", margin: "12px 0 6px" }}
              >
                Chips no popup (|) — opcional
              </label>
              <textarea
                id="public.header_promo_popup_keywords"
                rows={2}
                value={values["public.header_promo_popup_keywords"] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_popup_keywords": e.target.value }))}
                placeholder="Vazio = reutiliza os chips da barra no card."
              />
              <div style={{ marginTop: 12 }}>
                <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>Imagem do card</label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingPromoImage}
                  onChange={(e) => void onUploadPromoImage(e.target.files?.[0] ?? null)}
                />
                {values["public.header_promo_image_url"] ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <img
                      src={resolveMediaUrl(values["public.header_promo_image_url"])}
                      alt="Pré-visualização"
                      style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid var(--ae-line)" }}
                    />
                    <code style={{ fontSize: 12 }}>{values["public.header_promo_image_url"]}</code>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <details style={{ marginTop: 16 }} className="ae-admin-legacy-details">
            <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Modo único antigo (compatibilidade)</summary>
            <p className="ae-muted" style={{ fontSize: 12, marginTop: 8 }}>
              Só é usado quando «Estado da barra» e «Estado do popup» estão em <strong>Automático</strong>. Prefira definir
              cada canal explicitamente.
            </p>
            <label className="ae-check" htmlFor="public.header_promo_enabled" style={{ marginTop: 8 }}>
              <input
                id="public.header_promo_enabled"
                type="checkbox"
                checked={(values["public.header_promo_enabled"] ?? "").trim().toLowerCase() === "true"}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, "public.header_promo_enabled": e.target.checked ? "true" : "false" }))
                }
              />
              <span>Activar promo (legado)</span>
            </label>
            <div style={{ marginTop: 10 }}>
              <span className="ae-muted" style={{ fontSize: 12, fontWeight: 700 }}>
                Mostrar só um:
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                <label className="ae-check" htmlFor="promo_mode_bar">
                  <input
                    id="promo_mode_bar"
                    type="radio"
                    name="promo_mode"
                    checked={(values["public.header_promo_mode"] ?? "bar") !== "popup"}
                    onChange={() => setValues((prev) => ({ ...prev, "public.header_promo_mode": "bar" }))}
                  />
                  <span>Barra</span>
                </label>
                <label className="ae-check" htmlFor="promo_mode_popup">
                  <input
                    id="promo_mode_popup"
                    type="radio"
                    name="promo_mode"
                    checked={(values["public.header_promo_mode"] ?? "bar") === "popup"}
                    onChange={() => setValues((prev) => ({ ...prev, "public.header_promo_mode": "popup" }))}
                  />
                  <span>Popup</span>
                </label>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
              <div>
                <label htmlFor="public.header_promo_start_at" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Intervalo legado — início
                </label>
                <input
                  id="public.header_promo_start_at"
                  type="datetime-local"
                  value={values["public.header_promo_start_at"] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_start_at": e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="public.header_promo_end_at" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Intervalo legado — fim
                </label>
                <input
                  id="public.header_promo_end_at"
                  type="datetime-local"
                  value={values["public.header_promo_end_at"] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_end_at": e.target.value }))}
                />
              </div>
            </div>
          </details>
        </div>
        <div className="ae-panel" style={{ marginBottom: 16, background: "#fafbfc" }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Favicon do site</h3>
          <p className="ae-muted" style={{ marginTop: 0, fontSize: 12 }}>
            Recomendado: ícone quadrado 64x64 ou 128x128 em PNG/ICO/SVG.
          </p>
          <div className="ae-admin-toolbar">
            <input
              type="file"
              accept=".ico,image/png,image/svg+xml,image/x-icon"
              disabled={uploadingFavicon}
              onChange={(e) => void onUploadFavicon(e.target.files?.[0] ?? null)}
            />
          </div>
          {values["public.favicon_url"] ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <img
                src={resolveMediaUrl(values["public.favicon_url"])}
                alt="Pré-visualização do favicon"
                style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid var(--ae-line)" }}
              />
              <code style={{ fontSize: 12 }}>{values["public.favicon_url"]}</code>
            </div>
          ) : null}
        </div>
        <div className="ae-form" style={{ gap: 16 }}>
          {items.map((it) => {
            if (PROMO_KEYS.has(it.key)) return null;
            if (it.key === "public.favicon_url" || it.key === "public.vendor_help_channel_url") return null;
            const isBool =
              (it.defaultValue === "true" || it.defaultValue === "false") &&
              (it.key.startsWith("public.") || it.key.startsWith("logistics.") || it.key.includes("enabled"));
            const current = values[it.key] ?? it.value ?? it.defaultValue;
            if (isBool) {
              const checked = (current ?? "").trim().toLowerCase() === "true";
              return (
                <div key={it.key} className="ae-admin-field-block">
                  <label className="ae-check" htmlFor={it.key}>
                    <input
                      id={it.key}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [it.key]: e.target.checked ? "true" : "false",
                        }))
                      }
                    />
                    <span>{it.label}</span>
                  </label>
                  {it.hint ? <p className="ae-field-hint">{it.hint}</p> : null}
                  <p className="ae-muted" style={{ fontSize: 11, margin: "4px 0 0" }}>
                    Valor actual: {checked ? "true" : "false"} · por defeito: {it.defaultValue}
                  </p>
                </div>
              );
            }
            const isLong =
              it.value.length > 80 ||
              it.key.includes("note") ||
              it.key.includes("checkout_transfer_instructions") ||
              it.key.includes("promo_keywords");
            return (
              <div key={it.key} className="ae-admin-field-block">
                <label htmlFor={it.key}>{it.label}</label>
                {it.hint ? <p className="ae-field-hint">{it.hint}</p> : null}
                {isLong ? (
                  <textarea
                    id={it.key}
                    rows={it.key.includes("note") ? 4 : 2}
                    value={values[it.key] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [it.key]: e.target.value }))}
                  />
                ) : (
                  <input
                    id={it.key}
                    value={values[it.key] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [it.key]: e.target.value }))}
                  />
                )}
                <p className="ae-muted" style={{ fontSize: 11, margin: "6px 0 0" }}>
                  Por defeito: {it.defaultValue.length > 70 ? `${it.defaultValue.slice(0, 70)}…` : it.defaultValue}
                </p>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn btn-primary" style={{ marginTop: 20 }} disabled={saving} onClick={() => void save()}>
          {saving ? "A guardar…" : "Guardar textos"}
        </button>
      </div>
    </div>
  );
}
