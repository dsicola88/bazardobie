import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

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
      setMsg("Textos públicos publicados com sucesso.");
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Conteúdo do site</h1>
          <p className="ae-admin-pro__sub">
            Mensagens institucionais, telefone de suporte, barra promocional e textos da página inicial. Alterações
            aplicam-se em tempo real para novos visitantes.
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
        <h2 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>Campos de texto</h2>
        <p className="ae-muted" style={{ margin: "0 0 18px", fontSize: 13 }}>
          Os valores por defeito aparecem em cinza sob cada campo. A faixa de confiança usa o formato{" "}
          <code>título|descrição</code>.
        </p>
        <div className="ae-form" style={{ gap: 16 }}>
          {items.map((it) => (
            <div key={it.key} className="ae-admin-field-block">
              <label htmlFor={it.key}>{it.label}</label>
              {it.hint ? <p className="ae-field-hint">{it.hint}</p> : null}
              {it.value.length > 80 || it.key.includes("note") || it.key.includes("promo") ? (
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
          ))}
        </div>
        <button type="button" className="btn btn-primary" style={{ marginTop: 20 }} disabled={saving} onClick={() => void save()}>
          {saving ? "A guardar…" : "Guardar textos"}
        </button>
      </div>
    </div>
  );
}
