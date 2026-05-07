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

  const promoEnabled = (values["public.header_promo_enabled"] ?? "").trim().toLowerCase() === "true";
  const promoMode = (values["public.header_promo_mode"] ?? "bar").trim().toLowerCase();

  const PROMO_KEYS = new Set([
    "public.header_promo_enabled",
    "public.header_promo_mode",
    "public.header_promo_text",
    "public.header_promo_keywords",
    "public.header_promo_marquee",
  ]);

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Configurações do site</h1>
          <p className="ae-admin-pro__sub">
            Textos públicos, barra/popup promocional e opções de funcionamento (ex.: frete por distância, envio pela loja).
            Alterações aplicam-se em tempo real para novos visitantes.
          </p>
        </div>
      </header>

      <div className="ae-admin-next">
        <div>
          <h2>Carrossel de imagens</h2>
          <p>
            Crie e ordenize os slides principais da página inicial — com upload, pré-visualização e activação
            imediata.
          </p>
        </div>
        <Link to="/admin/banners" className="btn btn-primary">
          Gerir banners
        </Link>
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

        <div className="ae-panel" style={{ marginBottom: 16, background: "#fff7f2", borderColor: "#f3c2b1" }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Promoções (barra vermelha / popup)</h3>
          <p className="ae-muted" style={{ marginTop: 0, fontSize: 12 }}>
            Aqui controla se a <strong>barra vermelha</strong> aparece, ou se em vez disso deve aparecer um{" "}
            <strong>popup</strong> ao visitar o site.
          </p>

          <label className="ae-check" htmlFor="public.header_promo_enabled">
            <input
              id="public.header_promo_enabled"
              type="checkbox"
              checked={promoEnabled}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  "public.header_promo_enabled": e.target.checked ? "true" : "false",
                }))
              }
            />
            <span>Ativar promo (barra/popup)</span>
          </label>

          {promoEnabled ? (
            <>
              <div style={{ marginTop: 10 }}>
                <div className="ae-muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Onde mostrar?
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <label className="ae-check" htmlFor="promo_mode_bar">
                    <input
                      id="promo_mode_bar"
                      type="radio"
                      name="promo_mode"
                      checked={promoMode !== "popup"}
                      onChange={() => setValues((prev) => ({ ...prev, "public.header_promo_mode": "bar" }))}
                    />
                    <span>Barra vermelha (compacta)</span>
                  </label>
                  <label className="ae-check" htmlFor="promo_mode_popup">
                    <input
                      id="promo_mode_popup"
                      type="radio"
                      name="promo_mode"
                      checked={promoMode === "popup"}
                      onChange={() => setValues((prev) => ({ ...prev, "public.header_promo_mode": "popup" }))}
                    />
                    <span>Popup ao visitar</span>
                  </label>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label htmlFor="public.header_promo_text" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Mensagem principal
                </label>
                <input
                  id="public.header_promo_text"
                  value={values["public.header_promo_text"] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_text": e.target.value }))}
                  placeholder="Ex.: Promoções até 30% · entrega rápida"
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label
                  htmlFor="public.header_promo_keywords"
                  style={{ fontWeight: 700, display: "block", marginBottom: 6 }}
                >
                  Chips (separados por |)
                </label>
                <textarea
                  id="public.header_promo_keywords"
                  rows={2}
                  value={values["public.header_promo_keywords"] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, "public.header_promo_keywords": e.target.value }))}
                  placeholder="Ex.: Super oferta|Entrega rápida|Preço baixo|Qualidade verificada"
                />
                <p className="ae-muted" style={{ margin: "6px 0 0", fontSize: 11 }}>
                  Nota: na barra mostramos no máximo 4 chips para não ficar “texto demais”.
                </p>
              </div>

              <div style={{ marginTop: 10 }}>
                <label className="ae-check" htmlFor="public.header_promo_marquee">
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
            </>
          ) : (
            <p className="ae-muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 12 }}>
              Estado: <strong>desativado</strong>. A barra vermelha e o popup ficam ocultos.
            </p>
          )}
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
