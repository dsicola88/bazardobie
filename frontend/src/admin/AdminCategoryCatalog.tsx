import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { CATALOG_TERMS } from "../catalog/catalogTerminology.js";
import {
  resolveNichePack,
  suggestionToOptionsJson,
  type NicheAttrSuggestion,
} from "../catalog/categoryNichePacks.js";

type CatRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  productCount: number;
};

type StandardUnit = { code: string; symbol: string; namePt: string; quantity: string };

type AttrAdmin = {
  id: string;
  categoryId: string;
  key: string;
  label: string;
  inputType: "TEXT" | "NUMBER" | "SELECT";
  options: string[] | null;
  optionsJson: string | null;
  helpText?: string | null;
  isRequired: boolean;
  sortOrder: number;
  unitCode: string | null;
  facetEnabled: boolean;
  primaryRank: number;
  autoSuggest: boolean;
  synonyms: string[];
  aliases: { id: string; label: string; normalized: string }[];
};

type FillStats = {
  definitionsCount: number;
  productsInCategory: number;
  productsWithVariants: number;
  shareWithAllRequiredAmongVariants: number | null;
  byAttribute: Array<{
    attributeId: string;
    key: string;
    label: string;
    coverage: number | null;
    filledProducts: number;
    totalProducts: number;
  }>;
};

type PresetRow = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  attributes: { id: string; label: string }[];
};

const INPUT_TYPE_LABELS: Record<AttrAdmin["inputType"], string> = {
  TEXT: "Texto livre",
  NUMBER: "Número",
  SELECT: "Lista de opções",
};

function slugifyAttributeKey(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return (s.slice(0, 64) || "atributo").replace(/^_+|_+$/g, "") || "atributo";
}

type CoverageTier = "na" | "bad" | "mid" | "good";

function coverageTier(c: number | null): CoverageTier {
  if (c == null) return "na";
  if (c >= 0.8) return "good";
  if (c >= 0.5) return "mid";
  return "bad";
}

function flattenCatLabels(rows: CatRow[]): { id: string; label: string }[] {
  const byId = new Map(rows.map((c) => [c.id, c] as const));
  return [...rows]
    .sort((a, b) => a.name.localeCompare(b.name, "pt"))
    .map((c) => ({
      id: c.id,
      label: c.parentId ? `${byId.get(c.parentId)?.name ?? "—"} › ${c.name}` : c.name,
    }));
}

const emptyAttrForm = {
  key: "",
  label: "",
  inputType: "TEXT" as AttrAdmin["inputType"],
  optionsJson: '["Opção A","Opção B"]',
  helpText: "",
  isRequired: false,
  sortOrder: 0,
  unitCode: "",
  facetEnabled: false,
  primaryRank: 0,
  autoSuggest: false,
};

export default function AdminCategoryCatalog() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cats, setCats] = useState<CatRow[] | null>(null);
  const [units, setUnits] = useState<StandardUnit[]>([]);
  const [categoryId, setCategoryId] = useState(() => searchParams.get("cat") ?? "");
  const [attrs, setAttrs] = useState<AttrAdmin[]>([]);
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [fillStats, setFillStats] = useState<FillStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number | boolean>>({});
  const [newAttr, setNewAttr] = useState(emptyAttrForm);
  const [aliasDraft, setAliasDraft] = useState<Record<string, string>>({});
  const [presetName, setPresetName] = useState("");
  const [presetDefault, setPresetDefault] = useState(false);
  const presetSelectRef = useRef<HTMLSelectElement | null>(null);
  const [newAttrKeyTouched, setNewAttrKeyTouched] = useState(false);
  const [nicheBulkBusy, setNicheBulkBusy] = useState(false);

  const catOptions = useMemo(() => (cats ? flattenCatLabels(cats) : []), [cats]);

  const selectedCategory = useMemo(
    () => (cats && categoryId ? cats.find((c) => c.id === categoryId) ?? null : null),
    [cats, categoryId],
  );

  const ancestorSlugs = useMemo(() => {
    if (!cats?.length || !categoryId) return [] as string[];
    const byId = new Map(cats.map((c) => [c.id, c] as const));
    const out: string[] = [];
    let cur = byId.get(categoryId);
    while (cur?.parentId) {
      const p = byId.get(cur.parentId);
      if (!p) break;
      out.push(p.slug);
      cur = p;
    }
    return out;
  }, [cats, categoryId]);

  const nichePack = useMemo(() => {
    if (!selectedCategory) return null;
    return resolveNichePack(selectedCategory.slug, selectedCategory.name, ancestorSlugs);
  }, [selectedCategory, ancestorSlugs]);

  const missingNicheSuggestions = useMemo(() => {
    if (!nichePack) return [] as NicheAttrSuggestion[];
    const keys = new Set(attrs.map((a) => a.key));
    return nichePack.attributes.filter((s) => !keys.has(s.key));
  }, [nichePack, attrs]);

  /** Ordem do multiselect alinhada ao pacote — a mesma ordem é enviada ao criar o modelo. */
  const orderedAttrsForPreset = useMemo(() => {
    if (!nichePack || attrs.length === 0) return attrs;
    const inPack: AttrAdmin[] = [];
    const seen = new Set<string>();
    for (const s of nichePack.attributes) {
      const a = attrs.find((x) => x.key === s.key);
      if (a) {
        inPack.push(a);
        seen.add(a.id);
      }
    }
    return [...inPack, ...attrs.filter((a) => !seen.has(a.id))];
  }, [attrs, nichePack]);

  const coverageSorted = useMemo(() => {
    if (!fillStats?.byAttribute?.length) return [];
    return [...fillStats.byAttribute].sort((a, b) => {
      const ca = a.coverage ?? -1;
      const cb = b.coverage ?? -1;
      if (ca !== cb) return ca - cb;
      return a.label.localeCompare(b.label, "pt");
    });
  }, [fillStats]);

  const loadCats = useCallback(async () => {
    if (!token) return;
    try {
      const list = await apiFetch<CatRow[]>("/admin/categories", { token });
      setCats(list);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar categorias");
    }
  }, [token]);

  useEffect(() => {
    void loadCats();
  }, [loadCats]);

  useEffect(() => {
    void apiFetch<{ units: StandardUnit[] }>("/catalog/standard-units")
      .then((r) => setUnits(r.units ?? []))
      .catch(() => setUnits([]));
  }, []);

  const loadCategoryDetail = useCallback(async () => {
    if (!token || !categoryId.trim()) {
      setAttrs([]);
      setPresets([]);
      setFillStats(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const [a, pr, st] = await Promise.all([
        apiFetch<AttrAdmin[]>(`/admin/categories/${encodeURIComponent(categoryId)}/attributes`, { token }),
        apiFetch<{ items: PresetRow[] }>(
          `/categories/${encodeURIComponent(categoryId)}/attribute-presets`,
        ).catch(() => ({ items: [] as PresetRow[] })),
        apiFetch<FillStats>(`/admin/categories/${encodeURIComponent(categoryId)}/catalog-fill-stats`, {
          token,
        }).catch(() => null),
      ]);
      setAttrs(a);
      setPresets(pr.items ?? []);
      setFillStats(st);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar ficha técnica");
      setAttrs([]);
      setPresets([]);
      setFillStats(null);
    } finally {
      setLoading(false);
    }
  }, [token, categoryId]);

  useEffect(() => {
    void loadCategoryDetail();
  }, [loadCategoryDetail]);

  useEffect(() => {
    const c = searchParams.get("cat") ?? "";
    if (c !== categoryId) setCategoryId(c);
  }, [searchParams, categoryId]);

  function onPickCategory(id: string) {
    setCategoryId(id);
    setEditId(null);
    setMsg(null);
    if (id) setSearchParams({ cat: id }, { replace: true });
    else setSearchParams({}, { replace: true });
  }

  async function createAttr() {
    if (!token || !categoryId.trim()) return;
    setMsg(null);
    setErr(null);
    const body: Record<string, unknown> = {
      key: newAttr.key.trim(),
      label: newAttr.label.trim(),
      inputType: newAttr.inputType,
      helpText: newAttr.helpText.trim() || null,
      isRequired: newAttr.isRequired,
      sortOrder: Number(newAttr.sortOrder) || 0,
      facetEnabled: newAttr.facetEnabled,
      primaryRank: Number(newAttr.primaryRank) || 0,
      autoSuggest: newAttr.autoSuggest,
    };
    if (newAttr.inputType === "SELECT") {
      body.optionsJson = newAttr.optionsJson.trim();
    }
    if (newAttr.inputType === "NUMBER" && newAttr.unitCode.trim()) {
      body.unitCode = newAttr.unitCode.trim().toLowerCase();
    }
    try {
      await apiFetch(`/admin/categories/${encodeURIComponent(categoryId)}/attributes`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      setMsg("Atributo criado.");
      setNewAttr(emptyAttrForm);
      setNewAttrKeyTouched(false);
      void loadCategoryDetail();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao criar atributo");
    }
  }

  function applyNicheSuggestionToForm(s: NicheAttrSuggestion) {
    const nextOrder = Math.max(0, ...attrs.map((a) => a.sortOrder), 0) + 10;
    setNewAttr({
      key: s.key,
      label: s.label,
      inputType: s.inputType,
      optionsJson: suggestionToOptionsJson(s),
      helpText: s.helpText ?? "",
      isRequired: s.isRequired ?? false,
      sortOrder: s.sortOrder ?? nextOrder,
      unitCode: s.unitCode ?? "",
      facetEnabled: s.facetEnabled ?? false,
      primaryRank: s.primaryRank ?? 0,
      autoSuggest: s.autoSuggest ?? false,
    });
    setNewAttrKeyTouched(true);
    setMsg(`Sugestão «${s.label}» aplicada ao formulário «Novo atributo» em baixo — reveja e crie.`);
  }

  async function createMissingNicheAttrs() {
    if (!token || !categoryId.trim() || !nichePack || missingNicheSuggestions.length === 0) return;
    setNicheBulkBusy(true);
    setErr(null);
    setMsg(null);
    let baseOrder = Math.max(0, ...attrs.map((a) => a.sortOrder), 0);
    const nMissing = missingNicheSuggestions.length;
    try {
      for (const s of missingNicheSuggestions) {
        baseOrder += 10;
        const body: Record<string, unknown> = {
          key: s.key,
          label: s.label,
          inputType: s.inputType,
          helpText: s.helpText?.trim() || null,
          isRequired: s.isRequired ?? false,
          sortOrder: s.sortOrder ?? baseOrder,
          facetEnabled: s.facetEnabled ?? false,
          primaryRank: s.primaryRank ?? 0,
          autoSuggest: s.autoSuggest ?? false,
        };
        if (s.inputType === "SELECT") {
          body.optionsJson = suggestionToOptionsJson(s);
        }
        if (s.inputType === "NUMBER" && s.unitCode?.trim()) {
          body.unitCode = s.unitCode.trim().toLowerCase();
        }
        await apiFetch(`/admin/categories/${encodeURIComponent(categoryId)}/attributes`, {
          method: "POST",
          token,
          body: JSON.stringify(body),
        });
      }
      setMsg(`Foram criados ${nMissing} atributos sugeridos para «${nichePack.label}».`);
      void loadCategoryDetail();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao criar atributos sugeridos");
    } finally {
      setNicheBulkBusy(false);
    }
  }

  function selectPresetOptionsMatchingPack() {
    if (!presetSelectRef.current || !nichePack) return;
    const sel = presetSelectRef.current;
    const want = new Set(
      nichePack.attributes
        .map((s) => attrs.find((a) => a.key === s.key)?.id)
        .filter(Boolean) as string[],
    );
    for (let i = 0; i < sel.options.length; i++) {
      sel.options[i].selected = want.has(sel.options[i].value);
    }
    setMsg(
      "Multiselect actualizado com os atributos do pacote (ordem = ordem do nicho na lista). Defina o nome do modelo e clique em «Criar modelo».",
    );
  }

  function suggestPresetNameFromNiche() {
    if (!nichePack) return;
    setPresetName(`${nichePack.label} — modelo base`);
    setMsg("Nome do modelo preenchido — pode editar antes de criar.");
  }

  function openEdit(a: AttrAdmin) {
    setEditId(a.id);
    setEditForm({
      label: a.label,
      inputType: a.inputType,
      optionsJson:
        a.optionsJson?.trim() ||
        (a.options?.length ? JSON.stringify(a.options) : '["Opção A","Opção B"]'),
      helpText: a.helpText ?? "",
      isRequired: a.isRequired,
      sortOrder: a.sortOrder,
      unitCode: a.unitCode ?? "",
      facetEnabled: a.facetEnabled,
      primaryRank: a.primaryRank,
      autoSuggest: a.autoSuggest,
    });
  }

  async function saveEdit(attrId: string) {
    if (!token) return;
    setErr(null);
    const inputType = editForm.inputType as AttrAdmin["inputType"];
    const body: Record<string, unknown> = {
      label: String(editForm.label).trim(),
      inputType,
      helpText: String(editForm.helpText).trim() || null,
      isRequired: Boolean(editForm.isRequired),
      sortOrder: Number(editForm.sortOrder) || 0,
      facetEnabled: Boolean(editForm.facetEnabled),
      primaryRank: Number(editForm.primaryRank) || 0,
      autoSuggest: Boolean(editForm.autoSuggest),
    };
    if (inputType === "SELECT") {
      body.optionsJson = String(editForm.optionsJson).trim();
    } else {
      body.optionsJson = null;
    }
    if (inputType === "NUMBER") {
      const u = String(editForm.unitCode ?? "").trim();
      body.unitCode = u ? u.toLowerCase() : null;
    } else {
      body.unitCode = null;
    }
    try {
      await apiFetch(`/admin/category-attributes/${encodeURIComponent(attrId)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setMsg("Atributo actualizado.");
      setEditId(null);
      void loadCategoryDetail();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao guardar");
    }
  }

  async function removeAttr(attrId: string) {
    if (!token) return;
    if (!window.confirm("Eliminar este atributo? Valores nas variantes deixam de estar ligados.")) return;
    try {
      await apiFetch(`/admin/category-attributes/${encodeURIComponent(attrId)}`, { method: "DELETE", token });
      setMsg("Atributo eliminado.");
      setEditId(null);
      void loadCategoryDetail();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao eliminar");
    }
  }

  async function addAlias(attrId: string) {
    const label = (aliasDraft[attrId] ?? "").trim();
    if (!token || !label) return;
    try {
      await apiFetch(`/admin/category-attributes/${encodeURIComponent(attrId)}/aliases`, {
        method: "POST",
        token,
        body: JSON.stringify({ label }),
      });
      setAliasDraft((p) => ({ ...p, [attrId]: "" }));
      void loadCategoryDetail();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao adicionar alias");
    }
  }

  async function delAlias(aliasId: string) {
    if (!token) return;
    try {
      await apiFetch(`/admin/category-attribute-aliases/${encodeURIComponent(aliasId)}`, {
        method: "DELETE",
        token,
      });
      void loadCategoryDetail();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao remover alias");
    }
  }

  async function createPreset() {
    if (!token || !categoryId.trim() || !presetName.trim()) return;
    const sel = presetSelectRef.current;
    const attributeIds = sel ? Array.from(sel.selectedOptions).map((o) => o.value) : [];
    if (attributeIds.length === 0) {
      setErr("Seleccione pelo menos um atributo (ordem = ordem no preset).");
      return;
    }
    setErr(null);
    try {
      await apiFetch(`/admin/categories/${encodeURIComponent(categoryId)}/attribute-presets`, {
        method: "POST",
        token,
        body: JSON.stringify({
          name: presetName.trim(),
          isDefault: presetDefault,
          attributeIds,
        }),
      });
      setMsg("Preset criado.");
      setPresetName("");
      setPresetDefault(false);
      void loadCategoryDetail();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao criar preset");
    }
  }

  async function deletePreset(id: string) {
    if (!token) return;
    if (!window.confirm("Eliminar este preset?")) return;
    try {
      await apiFetch(`/admin/category-attribute-presets/${encodeURIComponent(id)}`, { method: "DELETE", token });
      void loadCategoryDetail();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao eliminar preset");
    }
  }

  return (
    <div className="ae-admin-pro ae-admin-catcatalog-page">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Ficha técnica e facetas</h1>
          <p className="ae-admin-pro__sub">{CATALOG_TERMS.adminCatalogPageSubtitle}</p>
        </div>
        <Link to="/admin/categories" className="btn">
          Voltar às categorias
        </Link>
      </header>

      {err ? (
        <p className="ae-admin-alert ae-admin-alert--err" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="ae-admin-alert ae-admin-alert--ok" role="status">
          {msg}
        </p>
      ) : null}

      <div className="ae-admin-catcatalog-stack">
        <div className="ae-panel ae-admin-catcatalog__section ae-admin-catcatalog__section--pick">
          <label className="ae-admin-field" style={{ maxWidth: 560 }}>
            <span>Categoria comercial</span>
            <select className="ae-input" value={categoryId} onChange={(e) => onPickCategory(e.target.value)}>
              <option value="">Seleccionar categoria…</option>
              {catOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="ae-admin-field-hint">{CATALOG_TERMS.adminCatalogPickCategoryHint}</span>
          </label>
        </div>

        {!categoryId.trim() ? (
          <p className="ae-muted">Escolha uma categoria para gerir atributos, filtros na loja e modelos de ficha.</p>
        ) : loading ? (
          <p className="ae-muted">A carregar…</p>
        ) : (
          <>
            <div className="ae-admin-callout ae-admin-callout--soft ae-admin-catcatalog-quicktips">
              <strong>{CATALOG_TERMS.adminCatalogQuickTipsTitle}</strong>
              <ul className="ae-admin-catcatalog-quicktips__list">
                <li>{CATALOG_TERMS.adminCatalogQuickTipFacet}</li>
                <li>{CATALOG_TERMS.adminCatalogQuickTipRequired}</li>
                <li>{CATALOG_TERMS.adminCatalogQuickTipModel}</li>
              </ul>
            </div>

            <div className="ae-admin-callout ae-admin-callout--soft ae-admin-catcatalog-glossary">
              <strong>{CATALOG_TERMS.adminCatalogGlossaryTitle}</strong>
              <ul>
                <li>{CATALOG_TERMS.adminCatalogGlossaryAttribute}</li>
                <li>{CATALOG_TERMS.adminCatalogGlossaryFacet}</li>
                <li>{CATALOG_TERMS.adminCatalogGlossaryRequired}</li>
                <li>{CATALOG_TERMS.adminCatalogGlossarySuggest}</li>
                <li>{CATALOG_TERMS.adminCatalogGlossaryPreset}</li>
                <li>{CATALOG_TERMS.adminCatalogGlossaryCoverage}</li>
              </ul>
            </div>

            {nichePack ? (
              <div className="ae-admin-callout ae-admin-niche-assistant" role="region" aria-label="Assistente de nicho">
                <h2 className="ae-admin-catcatalog__head" style={{ marginTop: 0 }}>
                  Assistente de nicho
                </h2>
                <p className="ae-admin-catcatalog__lead" style={{ marginBottom: 12 }}>
                  Para <strong>{selectedCategory?.name}</strong> foi detectado o pacote{" "}
                  <strong>{nichePack.label}</strong> (slug e hierarquia da categoria, ou palavras‑chave no nome).
                  Pré-preenche o formulário de novo atributo ou cria vários campos de uma vez; depois sincronize o modelo de
                  ficha em baixo.
                </p>
                {missingNicheSuggestions.length === 0 ? (
                  <p className="ae-muted" style={{ margin: 0 }}>
                    Todos os campos deste pacote já existem nesta categoria. Pode definir facetas ou criar um modelo com o
                    multiselect (botões «Seleccionar atributos do pacote» e «Sugerir nome» na secção de modelos).
                  </p>
                ) : (
                  <>
                    <p className="ae-muted" style={{ marginTop: 0, marginBottom: 10 }}>
                      {missingNicheSuggestions.length} sugestão(ões) ainda não criada(s):
                    </p>
                    <ul className="ae-admin-niche-suggest-list">
                      {missingNicheSuggestions.map((s) => (
                        <li key={s.key} className="ae-admin-niche-suggest-item">
                          <div>
                            <strong>{s.label}</strong>
                            <span className="ae-admin-niche-suggest-meta">
                              {INPUT_TYPE_LABELS[s.inputType]} · <code>{s.key}</code>
                            </span>
                          </div>
                          <button type="button" className="ae-mini-btn" onClick={() => applyNicheSuggestionToForm(s)}>
                            Aplicar ao formulário «Novo atributo»
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="ae-admin-niche-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={nicheBulkBusy || !token}
                        onClick={() => void createMissingNicheAttrs()}
                      >
                        {nicheBulkBusy ? "A criar…" : `Criar todos em falta (${missingNicheSuggestions.length})`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            <section className="ae-panel ae-admin-catcatalog__section ae-admin-catcatalog-stats">
              <h2 className="ae-admin-catcatalog__head">Preenchimento no catálogo</h2>
              <p className="ae-admin-catcatalog__lead">{CATALOG_TERMS.adminCatalogStatsLead}</p>
              {fillStats ? (
                <>
                  <div className="ae-admin-catcatalog-kpis">
                    <div className="ae-admin-catcatalog-kpi">
                      <div className="ae-admin-catcatalog-kpi__val">
                        {fillStats.productsInCategory.toLocaleString("pt-AO")}
                      </div>
                      <div className="ae-admin-catcatalog-kpi__lbl">Produtos na categoria</div>
                    </div>
                    <div className="ae-admin-catcatalog-kpi">
                      <div className="ae-admin-catcatalog-kpi__val">
                        {fillStats.productsWithVariants.toLocaleString("pt-AO")}
                      </div>
                      <div className="ae-admin-catcatalog-kpi__lbl">Com variantes</div>
                    </div>
                    <div className="ae-admin-catcatalog-kpi">
                      <div className="ae-admin-catcatalog-kpi__val">
                        {fillStats.shareWithAllRequiredAmongVariants != null
                          ? `${Math.round(fillStats.shareWithAllRequiredAmongVariants * 100)}%`
                          : "—"}
                      </div>
                      <div className="ae-admin-catcatalog-kpi__lbl">Variantes com obrigatórios completos</div>
                    </div>
                  </div>
                  <p className="ae-admin-coverage-sort-hint ae-muted">{CATALOG_TERMS.adminCatalogCoverageListHint}</p>
                  {coverageSorted.length === 0 ? (
                    <p className="ae-muted">Sem atributos definidos ainda — a cobertura aparece depois de criar atributos.</p>
                  ) : (
                    <div className="ae-admin-coverage-list">
                      {coverageSorted.map((row) => {
                        const tier = coverageTier(row.coverage);
                        const pct = row.coverage != null ? Math.round(row.coverage * 100) : null;
                        const rowMod =
                          tier === "bad" ? " ae-admin-coverage-row--crit" : tier === "mid" ? " ae-admin-coverage-row--warn" : "";
                        return (
                          <div key={row.attributeId} className={`ae-admin-coverage-row${rowMod}`}>
                            <div className="ae-admin-coverage-top">
                              <div>
                                <span className="ae-admin-coverage-name">{row.label}</span>
                                <span className="ae-admin-coverage-key">{row.key}</span>
                              </div>
                              <div
                                className={
                                  "ae-admin-coverage-pct " +
                                  (tier === "good"
                                    ? "ae-admin-coverage-pct--good"
                                    : tier === "mid"
                                      ? "ae-admin-coverage-pct--mid"
                                      : tier === "bad"
                                        ? "ae-admin-coverage-pct--bad"
                                        : "ae-admin-coverage-pct--na")
                                }
                              >
                                {pct != null ? `${pct}%` : "—"}
                              </div>
                            </div>
                            <div className="ae-admin-coverage-bar">
                              <div
                                className={
                                  "ae-admin-coverage-bar__fill ae-admin-coverage-bar__fill--" +
                                  (tier === "na" ? "na" : tier)
                                }
                                style={{
                                  width: row.coverage != null ? `${Math.min(100, Math.max(0, row.coverage * 100))}%` : "0%",
                                }}
                              />
                            </div>
                            <div className="ae-admin-coverage-foot">
                              {row.coverage != null
                                ? `${row.filledProducts.toLocaleString("pt-AO")} de ${row.totalProducts.toLocaleString("pt-AO")} produtos com valor`
                                : "Sem dados de preenchimento"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <p className="ae-muted" role="status">
                  Não foi possível carregar as estatísticas de preenchimento. Recarregue a página ou tente mais tarde.
                </p>
              )}
            </section>

            <section className="ae-panel ae-admin-catcatalog__section">
              <h2 className="ae-admin-catcatalog__head">Atributos da categoria</h2>
              <p className="ae-admin-catcatalog__lead">{CATALOG_TERMS.adminCatalogAttributesLead}</p>

              {attrs.length === 0 ? (
                <p className="ae-muted">Ainda não há atributos. Crie o primeiro abaixo.</p>
              ) : (
                <div className="ae-admin-attr-grid">
                  {attrs.map((a) => (
                    <article key={a.id} className="ae-admin-attr-card">
                      <h3 className="ae-admin-attr-card__title">{a.label}</h3>
                      <div className="ae-admin-attr-card__key">{a.key}</div>
                      <div className="ae-admin-badge-row">
                        <span className="ae-admin-badge ae-admin-badge--type">{INPUT_TYPE_LABELS[a.inputType]}</span>
                        {a.isRequired ? <span className="ae-admin-badge ae-admin-badge--ok">Obrigatório</span> : null}
                        {a.facetEnabled ? <span className="ae-admin-badge ae-admin-badge--facet">Filtro na loja</span> : null}
                        {a.autoSuggest ? (
                          <span className="ae-admin-badge ae-admin-badge--suggest">Em destaque p/ vendedor</span>
                        ) : null}
                        {!a.isRequired && !a.facetEnabled && !a.autoSuggest ? (
                          <span className="ae-admin-badge ae-admin-badge--muted">Opcional</span>
                        ) : null}
                      </div>
                      <div className="ae-admin-attr-card__meta">
                        Ordem no formulário: {a.sortOrder} · Prioridade na ficha pública: {a.primaryRank}
                        {a.unitCode ? ` · Unidade: ${a.unitCode}` : null}
                      </div>
                      <div className="ae-admin-attr-card__actions">
                        <button type="button" className="ae-mini-btn" onClick={() => openEdit(a)}>
                          Editar
                        </button>
                        <button type="button" className="ae-mini-btn" onClick={() => void removeAttr(a.id)}>
                          Eliminar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {editId ? (
                <div className="ae-admin-catcatalog-edit-inner">
                  {attrs
                    .filter((a) => a.id === editId)
                    .map((a) => (
                      <div key={a.id}>
                        <h3 className="ae-admin-catcatalog__head" style={{ marginBottom: 4 }}>
                          Editar atributo
                        </h3>
                        <p className="ae-admin-catcatalog__lead" style={{ marginBottom: 16 }}>
                          {a.label}
                        </p>
                        <div className="ae-admin-form-stack">
                          <label className="ae-admin-field">
                            <span>Nome visível (comprador / vendedor)</span>
                            <input
                              className="ae-input"
                              value={String(editForm.label ?? "")}
                              onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                            />
                          </label>
                          <label className="ae-admin-field">
                            <span>Tipo do atributo</span>
                            <select
                              className="ae-input"
                              value={String(editForm.inputType ?? a.inputType)}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, inputType: e.target.value as AttrAdmin["inputType"] }))
                              }
                            >
                              {(Object.keys(INPUT_TYPE_LABELS) as AttrAdmin["inputType"][]).map((k) => (
                                <option key={k} value={k}>
                                  {INPUT_TYPE_LABELS[k]}
                                </option>
                              ))}
                            </select>
                          </label>
                          {editForm.inputType === "NUMBER" ? (
                            <label className="ae-admin-field">
                              <span>Unidade (quando aplicável)</span>
                              <select
                                className="ae-input"
                                value={String(editForm.unitCode ?? "")}
                                onChange={(e) => setEditForm((f) => ({ ...f, unitCode: e.target.value }))}
                              >
                                <option value="">Nenhuma</option>
                                {units.map((u) => (
                                  <option key={u.code} value={u.code}>
                                    {u.symbol} · {u.namePt}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          {editForm.inputType === "SELECT" ? (
                            <label className="ae-admin-field">
                              <span>Opções da lista (JSON)</span>
                              <textarea
                                className="ae-input"
                                rows={3}
                                value={String(editForm.optionsJson ?? "")}
                                onChange={(e) => setEditForm((f) => ({ ...f, optionsJson: e.target.value }))}
                              />
                              <span className="ae-admin-field-hint">Formato: lista JSON de texto, ex. [&quot;32 GB&quot;,&quot;64 GB&quot;]</span>
                            </label>
                          ) : null}

                          <label className="ae-admin-check--rich">
                            <div className="ae-admin-check--rich__row">
                              <input
                                type="checkbox"
                                checked={Boolean(editForm.isRequired)}
                                onChange={(e) => setEditForm((f) => ({ ...f, isRequired: e.target.checked }))}
                              />
                              <div className="ae-admin-check--rich__text">
                                <strong>Obrigatório</strong>
                                <span>O vendedor tem de preencher este campo nas variantes; reforça a qualidade do catálogo.</span>
                              </div>
                            </div>
                          </label>
                          <label className="ae-admin-check--rich">
                            <div className="ae-admin-check--rich__row">
                              <input
                                type="checkbox"
                                checked={Boolean(editForm.facetEnabled)}
                                onChange={(e) => setEditForm((f) => ({ ...f, facetEnabled: e.target.checked }))}
                              />
                              <div className="ae-admin-check--rich__text">
                                <strong>Usar como filtro na loja (faceta)</strong>
                                <span>Aparece como critério de filtro na pesquisa para compradores.</span>
                              </div>
                            </div>
                          </label>
                          <label className="ae-admin-check--rich">
                            <div className="ae-admin-check--rich__row">
                              <input
                                type="checkbox"
                                checked={Boolean(editForm.autoSuggest)}
                                onChange={(e) => setEditForm((f) => ({ ...f, autoSuggest: e.target.checked }))}
                              />
                              <div className="ae-admin-check--rich__text">
                                <strong>Destacar no formulário do vendedor</strong>
                                <span>Sobe a visibilidade do campo no painel do parceiro para guiar o preenchimento.</span>
                              </div>
                            </div>
                          </label>

                          <details className="ae-admin-advanced">
                            <summary>Configurações avançadas</summary>
                            <div className="ae-admin-form-grid" style={{ maxWidth: "100%" }}>
                              <label className="ae-admin-field">
                                <span>Chave técnica (API / integrações)</span>
                                <input className="ae-input" value={a.key} readOnly disabled />
                                <span className="ae-admin-field-hint">Identificador estável; não é editável para não quebrar dados existentes.</span>
                              </label>
                              <label className="ae-admin-field">
                                <span>Ordem no formulário do vendedor</span>
                                <input
                                  type="number"
                                  className="ae-input"
                                  value={Number(editForm.sortOrder ?? 0)}
                                  onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                                />
                              </label>
                              <label className="ae-admin-field">
                                <span>Prioridade na ficha pública (0 = normal)</span>
                                <input
                                  type="number"
                                  className="ae-input"
                                  value={Number(editForm.primaryRank ?? 0)}
                                  onChange={(e) => setEditForm((f) => ({ ...f, primaryRank: Number(e.target.value) }))}
                                />
                                <span className="ae-admin-field-hint">Valores mais altos tendem a aparecer primeiro na ficha do produto.</span>
                              </label>
                              <label className="ae-admin-field ae-admin-field--wide">
                                <span>Texto de ajuda (opcional)</span>
                                <input
                                  className="ae-input"
                                  value={String(editForm.helpText ?? "")}
                                  onChange={(e) => setEditForm((f) => ({ ...f, helpText: e.target.value }))}
                                />
                              </label>
                            </div>
                            <p className="ae-muted" style={{ marginTop: 12, marginBottom: 8 }}>
                              Sinónimos para pesquisa e matching
                            </p>
                            <ul className="ae-admin-catcatalog-aliaslist">
                              {a.aliases.map((al) => (
                                <li key={al.id}>
                                  {al.label}{" "}
                                  <button type="button" className="ae-mini-btn" onClick={() => void delAlias(al.id)}>
                                    ✕
                                  </button>
                                </li>
                              ))}
                            </ul>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                              <input
                                className="ae-input"
                                style={{ flex: "1 1 200px" }}
                                placeholder="Novo sinónimo"
                                value={aliasDraft[a.id] ?? ""}
                                onChange={(e) => setAliasDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                              />
                              <button type="button" className="btn" onClick={() => void addAlias(a.id)}>
                                Adicionar sinónimo
                              </button>
                            </div>
                          </details>
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
                          <button type="button" className="btn btn-primary" onClick={() => void saveEdit(a.id)}>
                            Guardar alterações
                          </button>
                          <button type="button" className="btn" onClick={() => setEditId(null)}>
                            Fechar
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : null}

              <h3 className="ae-admin-catcatalog__head" style={{ marginTop: 28 }}>
                Novo atributo
              </h3>
              <p className="ae-admin-catcatalog__lead">
                {CATALOG_TERMS.adminCatalogNewAttributeLead}
              </p>
              <div className="ae-admin-form-stack">
                <label className="ae-admin-field">
                  <span>Nome visível</span>
                  <input
                    className="ae-input"
                    value={newAttr.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      setNewAttr((x) => ({
                        ...x,
                        label,
                        key: newAttrKeyTouched ? x.key : slugifyAttributeKey(label),
                      }));
                    }}
                    placeholder="Ex.: Memória RAM"
                  />
                  <span className="ae-admin-field-hint">{CATALOG_TERMS.adminCatalogVisibleNameHint}</span>
                </label>
                <label className="ae-admin-field">
                  <span>Tipo do atributo</span>
                  <select
                    className="ae-input"
                    value={newAttr.inputType}
                    onChange={(e) => setNewAttr((x) => ({ ...x, inputType: e.target.value as AttrAdmin["inputType"] }))}
                  >
                    {(Object.keys(INPUT_TYPE_LABELS) as AttrAdmin["inputType"][]).map((k) => (
                      <option key={k} value={k}>
                        {INPUT_TYPE_LABELS[k]}
                      </option>
                    ))}
                  </select>
                  <span className="ae-admin-field-hint">{CATALOG_TERMS.adminCatalogTypeHint}</span>
                </label>
                {newAttr.inputType === "NUMBER" ? (
                  <label className="ae-admin-field">
                    <span>Unidade</span>
                    <select
                      className="ae-input"
                      value={newAttr.unitCode}
                      onChange={(e) => setNewAttr((x) => ({ ...x, unitCode: e.target.value }))}
                    >
                      <option value="">Nenhuma</option>
                      {units.map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.symbol} · {u.namePt}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {newAttr.inputType === "SELECT" ? (
                  <label className="ae-admin-field">
                    <span>Opções da lista (JSON)</span>
                    <textarea
                      className="ae-input"
                      rows={3}
                      value={newAttr.optionsJson}
                      onChange={(e) => setNewAttr((x) => ({ ...x, optionsJson: e.target.value }))}
                    />
                    <span className="ae-admin-field-hint">Lista de valores permitidos para o vendedor escolher.</span>
                  </label>
                ) : null}

                <label className="ae-admin-check--rich">
                  <div className="ae-admin-check--rich__row">
                    <input
                      type="checkbox"
                      checked={newAttr.isRequired}
                      onChange={(e) => setNewAttr((x) => ({ ...x, isRequired: e.target.checked }))}
                    />
                    <div className="ae-admin-check--rich__text">
                      <strong>Obrigatório</strong>
                      <span>Exige preenchimento nas variantes; útil para atributos críticos (marca, capacidade, etc.).</span>
                    </div>
                  </div>
                </label>
                <label className="ae-admin-check--rich">
                  <div className="ae-admin-check--rich__row">
                    <input
                      type="checkbox"
                      checked={newAttr.facetEnabled}
                      onChange={(e) => setNewAttr((x) => ({ ...x, facetEnabled: e.target.checked }))}
                    />
                    <div className="ae-admin-check--rich__text">
                      <strong>Usar como filtro na loja (faceta)</strong>
                      <span>O comprador filtra resultados por este atributo na pesquisa.</span>
                    </div>
                  </div>
                </label>
                <label className="ae-admin-check--rich">
                  <div className="ae-admin-check--rich__row">
                    <input
                      type="checkbox"
                      checked={newAttr.autoSuggest}
                      onChange={(e) => setNewAttr((x) => ({ ...x, autoSuggest: e.target.checked }))}
                    />
                    <div className="ae-admin-check--rich__text">
                      <strong>Destacar no formulário do vendedor</strong>
                      <span>O campo ganha destaque no cadastro para reduzir ficha incompleta.</span>
                    </div>
                  </div>
                </label>

                <details className="ae-admin-advanced">
                  <summary>Configurações avançadas</summary>
                  <div className="ae-admin-form-grid" style={{ maxWidth: "100%" }}>
                    <label className="ae-admin-field">
                      <span>Chave técnica (API, relatórios)</span>
                      <input
                        className="ae-input"
                        value={newAttr.key}
                        onChange={(e) => {
                          setNewAttrKeyTouched(true);
                          setNewAttr((x) => ({ ...x, key: e.target.value }));
                        }}
                        placeholder="gerada automaticamente a partir do nome"
                      />
                      <span className="ae-admin-field-hint">Apenas a-z, números e underscore. Deixe em automático salvo integrações específicas.</span>
                    </label>
                    <label className="ae-admin-field">
                      <span>Ordem no formulário do vendedor</span>
                      <input
                        type="number"
                        className="ae-input"
                        value={newAttr.sortOrder}
                        onChange={(e) => setNewAttr((x) => ({ ...x, sortOrder: Number(e.target.value) }))}
                      />
                    </label>
                    <label className="ae-admin-field">
                      <span>Prioridade na ficha pública</span>
                      <input
                        type="number"
                        className="ae-input"
                        value={newAttr.primaryRank}
                        onChange={(e) => setNewAttr((x) => ({ ...x, primaryRank: Number(e.target.value) }))}
                      />
                    </label>
                    <label className="ae-admin-field ae-admin-field--wide">
                      <span>Texto de ajuda (opcional)</span>
                      <input
                        className="ae-input"
                        value={newAttr.helpText}
                        onChange={(e) => setNewAttr((x) => ({ ...x, helpText: e.target.value }))}
                      />
                    </label>
                  </div>
                </details>
              </div>
              <button type="button" className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => void createAttr()}>
                Criar atributo
              </button>
            </section>

            <section className="ae-panel ae-admin-catcatalog__section ae-admin-catcatalog-presets-section">
              <h2 className="ae-admin-catcatalog__head">Modelos de ficha (templates)</h2>
              <p className="ae-admin-catcatalog__lead">{CATALOG_TERMS.adminCatalogPresetsLead}</p>

              {nichePack ? (
                <p className="ae-admin-catcatalog__sync-hint">
                  <strong>Sincronização com o assistente de nicho:</strong> a lista abaixo ordena os atributos na mesma
                  sequência do pacote «{nichePack.label}»; ao criar o modelo, a ordem segue esta lista (não a ordem em que
                  clicar com Ctrl). Use os botões para pré-seleccionar e sugerir o nome do modelo.
                </p>
              ) : null}

              {presets.length === 0 ? (
                <p className="ae-muted">Nenhum modelo ainda. Crie um abaixo quando tiver atributos definidos.</p>
              ) : (
                <div className="ae-admin-preset-grid">
                  {presets.map((pr) => (
                    <article key={pr.id} className="ae-admin-preset-card">
                      <div className="ae-admin-preset-card__head">
                        <h3 className="ae-admin-preset-card__name">{pr.name}</h3>
                        {pr.isDefault ? <span className="ae-admin-badge ae-admin-badge--ok">Predefinido</span> : null}
                      </div>
                      <div className="ae-admin-preset-card__chips">
                        {pr.attributes.map((x) => (
                          <span key={x.id} className="ae-admin-preset-chip">
                            {x.label}
                          </span>
                        ))}
                      </div>
                      <button type="button" className="ae-mini-btn" onClick={() => void deletePreset(pr.id)}>
                        Eliminar modelo
                      </button>
                    </article>
                  ))}
                </div>
              )}

              <h3 className="ae-admin-catcatalog__head" style={{ marginTop: 24 }}>
                Criar novo modelo
              </h3>
              <div className="ae-admin-catcatalog-preset-create">
                {nichePack && attrs.length > 0 ? (
                  <div className="ae-admin-niche-preset-tools">
                    <button type="button" className="btn" onClick={() => selectPresetOptionsMatchingPack()}>
                      Seleccionar atributos do pacote
                    </button>
                    <button type="button" className="btn" onClick={() => suggestPresetNameFromNiche()}>
                      Sugerir nome do modelo
                    </button>
                  </div>
                ) : null}
                <div className="ae-admin-form-stack" style={{ marginTop: 12 }}>
                  <label className="ae-admin-field">
                    <span>Nome do modelo</span>
                    <input
                      className="ae-input"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Ex.: Modelo smartphone Android"
                    />
                    <span className="ae-admin-field-hint">Use linguagem que o vendedor reconhece no dia-a-dia.</span>
                  </label>
                  <label className="ae-admin-check--rich">
                    <div className="ae-admin-check--rich__row">
                      <input type="checkbox" checked={presetDefault} onChange={(e) => setPresetDefault(e.target.checked)} />
                      <div className="ae-admin-check--rich__text">
                        <strong>Modelo por defeito nesta categoria</strong>
                        <span>Sugerido primeiro aos vendedores ao escolherem esta categoria.</span>
                      </div>
                    </div>
                  </label>
                  <label className="ae-admin-field ae-admin-field--preset-multiselect">
                    <span>Atributos incluídos (ordem = ordem no modelo)</span>
                    <select
                      ref={presetSelectRef}
                      multiple
                      className="ae-input ae-admin-catcatalog-multiselect"
                      size={Math.min(12, Math.max(5, orderedAttrsForPreset.length || 5))}
                    >
                      {orderedAttrsForPreset.map((at) => (
                        <option key={at.id} value={at.id}>
                          {at.label} · {at.key}
                        </option>
                      ))}
                    </select>
                    <span className="ae-admin-field-hint">
                      A ordem dos itens na lista é a ordem enviada ao criar o modelo (use «Seleccionar atributos do pacote»
                      para marcar o conjunto sugerido). Segure Ctrl (Windows) ou ⌘ (Mac) para ajustar a selecção.
                    </span>
                  </label>
                </div>
                <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => void createPreset()}>
                  Criar modelo
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
