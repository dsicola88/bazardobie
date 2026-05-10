import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import {
  partnerTermsSections,
  PARTNER_TERMS_DOC_REF_KEY,
  PARTNER_TERMS_DOC_REF_FALLBACK,
  PARTNER_TERMS_FOOTER_KEY,
} from "../legal/partnerTermsBuiltin.js";
import { useSiteContent } from "../site/SiteContentContext.js";

type ItemRow = {
  key: string;
  label: string;
  hint?: string;
  value: string;
  defaultValue: string;
};

export default function AdminPartnerTerms() {
  const token = useAuth().token;
  const { refresh } = useSiteContent();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setLoading(true);
    try {
      const out = await apiFetch<{ items: ItemRow[] }>("/admin/partner-terms", { token });
      setItems(out.items);
      const v: Record<string, string> = {};
      for (const it of out.items) v[it.key] = it.value;
      setValues(v);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
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
      await apiFetch("/admin/partner-terms", {
        method: "PUT",
        token,
        body: JSON.stringify({ settings: values }),
      });
      setMsg(
        "Termos actualizados. A página /termos-parceiros passa a usar esta versão (recarregar no browser para ver já aqui)."
      );
      void refresh();
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  function rowByKey(key: string): ItemRow | undefined {
    return items.find((i) => i.key === key);
  }

  const sections = partnerTermsSections();

  if (loading) {
    return <p className="ae-muted">A carregar editores dos termos…</p>;
  }

  const docHint = rowByKey(PARTNER_TERMS_DOC_REF_KEY)?.hint ?? "";
  const footerHint = rowByKey(PARTNER_TERMS_FOOTER_KEY)?.hint ?? "";

  return (
    <div className="ae-admin-pro ae-admin-canvas-wide">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Termos do programa de parceiros</h1>
          <p className="ae-admin-pro__sub">
            Texto público na rota <Link to="/termos-parceiros">/termos-parceiros</Link> · Impressão / PDF.
            Perfis <strong>ADMINISTRADOR</strong> e <strong>SUPORTE</strong> editam este conteúdo. Campos vazios mantêm os
            textos por defeito da aplicação.
          </p>
        </div>
      </header>

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

      <div className="ae-panel" style={{ marginBottom: 16 }}>
        <p className="ae-muted" style={{ marginTop: 0 }}>
          Opcional primeira linha de cada bloco: <code># Título personalizado</code> substitui o título dessa secção
          apenas. Parágrafos separados por linha em branco; cada linha com <code>- item</code> forma lista.
        </p>
      </div>

      <div className="ae-panel ae-form" style={{ maxWidth: 920 }}>
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="pt-doc-ref" style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
            Linha «Referência» (cabeçalho imprimível)
          </label>
          <input
            id="pt-doc-ref"
            placeholder={PARTNER_TERMS_DOC_REF_FALLBACK}
            value={values[PARTNER_TERMS_DOC_REF_KEY] ?? ""}
            onChange={(e) => setValues((p) => ({ ...p, [PARTNER_TERMS_DOC_REF_KEY]: e.target.value }))}
          />
          <p className="ae-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
            {docHint}
          </p>
        </div>

        {sections.map((spec) => {
          const row = rowByKey(spec.key);
          return (
            <div key={spec.key} style={{ marginBottom: 24 }}>
              <label htmlFor={spec.key} style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                {spec.defaultTitle}
              </label>
              <textarea
                id={spec.key}
                rows={12}
                style={{ width: "100%", minHeight: 180 }}
                value={values[spec.key] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [spec.key]: e.target.value }))}
                spellCheck={true}
              />
              {row?.hint ? (
                <p className="ae-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
                  {row.hint}
                </p>
              ) : null}
            </div>
          );
        })}

        <div style={{ marginBottom: 24 }}>
          <label htmlFor={PARTNER_TERMS_FOOTER_KEY} style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
            Rodapé do documento
          </label>
          <textarea
            id={PARTNER_TERMS_FOOTER_KEY}
            rows={5}
            style={{ width: "100%", minHeight: 100 }}
            value={values[PARTNER_TERMS_FOOTER_KEY] ?? ""}
            onChange={(e) => setValues((p) => ({ ...p, [PARTNER_TERMS_FOOTER_KEY]: e.target.value }))}
          />
          <p className="ae-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
            {footerHint}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "A guardar…" : "Guardar termos públicos"}
          </button>
          <Link to="/termos-parceiros" target="_blank" rel="noopener noreferrer" className="btn">
            Pré-visualizar no site
          </Link>
        </div>
      </div>
    </div>
  );
}
