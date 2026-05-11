import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type CatRow = {
  id: string;
  name: string;
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

  const catOptions = useMemo(() => (cats ? flattenCatLabels(cats) : []), [cats]);

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
      void loadCategoryDetail();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao criar atributo");
    }
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
    <div className="ae-admin-pro">
      <header className="ae-admin-pro__head">
        <div>
          <h1 className="ae-admin-pro__title">Ficha técnica e facetas</h1>
          <p className="ae-admin-pro__sub">
            Defina atributos estruturados por categoria, aliases para pesquisa, facetas na loja e presets para
            vendedores. Alinhado à API administrativa existente.
          </p>
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

      <div className="ae-panel ae-admin-catcatalog-pick">
        <label className="ae-admin-field" style={{ maxWidth: 520 }}>
          Categoria comercial
          <select
            className="ae-input"
            value={categoryId}
            onChange={(e) => onPickCategory(e.target.value)}
          >
            <option value="">Seleccionar…</option>
            {catOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!categoryId.trim() ? (
        <p className="ae-muted">Escolha uma categoria para gerir a ficha técnica.</p>
      ) : loading ? (
        <p className="ae-muted">A carregar…</p>
      ) : (
        <>
          {fillStats ? (
            <div className="ae-panel ae-admin-catcatalog-stats">
              <h2 style={{ marginTop: 0 }}>Preenchimento no catálogo</h2>
              <p className="ae-muted">
                {fillStats.productsInCategory.toLocaleString("pt-AO")} produtos na categoria ·{" "}
                {fillStats.productsWithVariants.toLocaleString("pt-AO")} com variantes ·{" "}
                {fillStats.shareWithAllRequiredAmongVariants != null
                  ? `${Math.round(fillStats.shareWithAllRequiredAmongVariants * 100)}% com obrigatórios completos`
                  : "—"}
              </p>
              <div className="ae-table-wrap">
                <table className="ae-data-table">
                  <thead>
                    <tr>
                      <th>Atributo</th>
                      <th>Cobertura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fillStats.byAttribute.map((row) => (
                      <tr key={row.attributeId}>
                        <td>
                          {row.label} <span className="ae-muted">({row.key})</span>
                        </td>
                        <td>
                          {row.coverage != null
                            ? `${Math.round(row.coverage * 100)}% (${row.filledProducts}/${row.totalProducts})`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="ae-panel">
            <h2 style={{ marginTop: 0 }}>Atributos</h2>
            <div className="ae-table-wrap">
              <table className="ae-data-table">
                <thead>
                  <tr>
                    <th>Rótulo</th>
                    <th>Chave</th>
                    <th>Tipo</th>
                    <th>Obrig.</th>
                    <th>Faceta</th>
                    <th>Rank</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {attrs.map((a) => (
                    <tr key={a.id}>
                      <td>{a.label}</td>
                      <td>
                        <code style={{ fontSize: 12 }}>{a.key}</code>
                      </td>
                      <td>{a.inputType}</td>
                      <td>{a.isRequired ? "Sim" : "—"}</td>
                      <td>{a.facetEnabled ? "Sim" : "—"}</td>
                      <td>{a.primaryRank}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button type="button" className="ae-mini-btn" onClick={() => openEdit(a)}>
                          Editar
                        </button>{" "}
                        <button
                          type="button"
                          className="ae-mini-btn"
                          onClick={() => void removeAttr(a.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editId ? (
              <div className="ae-admin-catcatalog-edit ae-panel" style={{ marginTop: 16 }}>
                {attrs
                  .filter((a) => a.id === editId)
                  .map((a) => (
                    <div key={a.id}>
                      <h3>Editar — {a.label}</h3>
                      <div className="ae-admin-form-grid">
                        <label className="ae-admin-field">
                          Rótulo
                          <input
                            className="ae-input"
                            value={String(editForm.label ?? "")}
                            onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                          />
                        </label>
                        <label className="ae-admin-field">
                          Tipo
                          <select
                            className="ae-input"
                            value={String(editForm.inputType ?? a.inputType)}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, inputType: e.target.value as AttrAdmin["inputType"] }))
                            }
                          >
                            <option value="TEXT">TEXT</option>
                            <option value="NUMBER">NUMBER</option>
                            <option value="SELECT">SELECT</option>
                          </select>
                        </label>
                        {editForm.inputType === "SELECT" ? (
                          <label className="ae-admin-field ae-admin-field--wide">
                            Opções JSON
                            <textarea
                              className="ae-input"
                              rows={3}
                              value={String(editForm.optionsJson ?? "")}
                              onChange={(e) => setEditForm((f) => ({ ...f, optionsJson: e.target.value }))}
                            />
                          </label>
                        ) : null}
                        {editForm.inputType === "NUMBER" ? (
                          <label className="ae-admin-field">
                            Unidade (standardUnits)
                            <select
                              className="ae-input"
                              value={String(editForm.unitCode ?? "")}
                              onChange={(e) => setEditForm((f) => ({ ...f, unitCode: e.target.value }))}
                            >
                              <option value="">—</option>
                              {units.map((u) => (
                                <option key={u.code} value={u.code}>
                                  {u.symbol} · {u.namePt}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        <label className="ae-admin-field">
                          Texto de ajuda
                          <input
                            className="ae-input"
                            value={String(editForm.helpText ?? "")}
                            onChange={(e) => setEditForm((f) => ({ ...f, helpText: e.target.value }))}
                          />
                        </label>
                        <label className="ae-admin-field">
                          Ordem
                          <input
                            type="number"
                            className="ae-input"
                            value={Number(editForm.sortOrder ?? 0)}
                            onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                          />
                        </label>
                        <label className="ae-admin-field">
                          Prioridade (rank)
                          <input
                            type="number"
                            className="ae-input"
                            value={Number(editForm.primaryRank ?? 0)}
                            onChange={(e) => setEditForm((f) => ({ ...f, primaryRank: Number(e.target.value) }))}
                          />
                        </label>
                        <label className="ae-admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(editForm.isRequired)}
                            onChange={(e) => setEditForm((f) => ({ ...f, isRequired: e.target.checked }))}
                          />
                          Obrigatório
                        </label>
                        <label className="ae-admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(editForm.facetEnabled)}
                            onChange={(e) => setEditForm((f) => ({ ...f, facetEnabled: e.target.checked }))}
                          />
                          Faceta na pesquisa
                        </label>
                        <label className="ae-admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(editForm.autoSuggest)}
                            onChange={(e) => setEditForm((f) => ({ ...f, autoSuggest: e.target.checked }))}
                          />
                          Sugestão / destaque no formulário do vendedor
                        </label>
                      </div>
                      <p className="ae-muted">Aliases (sinónimos)</p>
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
                          placeholder="Novo alias"
                          value={aliasDraft[a.id] ?? ""}
                          onChange={(e) => setAliasDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                        />
                        <button type="button" className="btn" onClick={() => void addAlias(a.id)}>
                          Adicionar alias
                        </button>
                      </div>
                      <button type="button" className="btn btn-primary" onClick={() => void saveEdit(a.id)}>
                        Guardar atributo
                      </button>{" "}
                      <button type="button" className="btn" onClick={() => setEditId(null)}>
                        Fechar
                      </button>
                    </div>
                  ))}
              </div>
            ) : null}

            <h3>Novo atributo</h3>
            <div className="ae-admin-form-grid">
              <label className="ae-admin-field">
                Chave técnica <code>a-z 0-9 _</code>
                <input
                  className="ae-input"
                  value={newAttr.key}
                  onChange={(e) => setNewAttr((x) => ({ ...x, key: e.target.value }))}
                  placeholder="ram_gb"
                />
              </label>
              <label className="ae-admin-field">
                Rótulo
                <input
                  className="ae-input"
                  value={newAttr.label}
                  onChange={(e) => setNewAttr((x) => ({ ...x, label: e.target.value }))}
                />
              </label>
              <label className="ae-admin-field">
                Tipo
                <select
                  className="ae-input"
                  value={newAttr.inputType}
                  onChange={(e) =>
                    setNewAttr((x) => ({ ...x, inputType: e.target.value as AttrAdmin["inputType"] }))
                  }
                >
                  <option value="TEXT">TEXT</option>
                  <option value="NUMBER">NUMBER</option>
                  <option value="SELECT">SELECT</option>
                </select>
              </label>
              {newAttr.inputType === "SELECT" ? (
                <label className="ae-admin-field ae-admin-field--wide">
                  Opções JSON
                  <textarea
                    className="ae-input"
                    rows={2}
                    value={newAttr.optionsJson}
                    onChange={(e) => setNewAttr((x) => ({ ...x, optionsJson: e.target.value }))}
                  />
                </label>
              ) : null}
              {newAttr.inputType === "NUMBER" ? (
                <label className="ae-admin-field">
                  Unidade
                  <select
                    className="ae-input"
                    value={newAttr.unitCode}
                    onChange={(e) => setNewAttr((x) => ({ ...x, unitCode: e.target.value }))}
                  >
                    <option value="">—</option>
                    {units.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.symbol} · {u.namePt}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="ae-admin-field">
                Ordem / rank / flags
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="number"
                    className="ae-input"
                    placeholder="sortOrder"
                    value={newAttr.sortOrder}
                    onChange={(e) => setNewAttr((x) => ({ ...x, sortOrder: Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    className="ae-input"
                    placeholder="primaryRank"
                    value={newAttr.primaryRank}
                    onChange={(e) => setNewAttr((x) => ({ ...x, primaryRank: Number(e.target.value) }))}
                  />
                </div>
              </label>
              <label className="ae-admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={newAttr.isRequired}
                  onChange={(e) => setNewAttr((x) => ({ ...x, isRequired: e.target.checked }))}
                />
                Obrigatório
              </label>
              <label className="ae-admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={newAttr.facetEnabled}
                  onChange={(e) => setNewAttr((x) => ({ ...x, facetEnabled: e.target.checked }))}
                />
                Faceta
              </label>
              <label className="ae-admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={newAttr.autoSuggest}
                  onChange={(e) => setNewAttr((x) => ({ ...x, autoSuggest: e.target.checked }))}
                />
                Sugestão (vendedor)
              </label>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void createAttr()}>
              Criar atributo
            </button>
          </div>

          <div className="ae-panel">
            <h2 style={{ marginTop: 0 }}>Presets de ficha</h2>
            <p className="ae-muted">
              Modelos mostrados aos vendedores (ordem dos campos). Seleccione várias linhas com Cmd/Ctrl no Windows —
              ordem = ordem de clique no Chrome pode variar; prefera seleccionar de cima a baixo.
            </p>
            <div className="ae-table-wrap">
              <table className="ae-data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Defeito</th>
                    <th>Atributos</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {presets.map((pr) => (
                    <tr key={pr.id}>
                      <td>{pr.name}</td>
                      <td>{pr.isDefault ? "Sim" : "—"}</td>
                      <td>{pr.attributes.map((x) => x.label).join(" · ")}</td>
                      <td>
                        <button type="button" className="ae-mini-btn" onClick={() => void deletePreset(pr.id)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="ae-admin-field">
              Nome do novo preset
              <input
                className="ae-input"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
            </label>
            <label className="ae-admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={presetDefault} onChange={(e) => setPresetDefault(e.target.checked)} />
              Predefinir nesta categoria
            </label>
            <label className="ae-admin-field">
              Atributos (multi-selecção)
              <select
                ref={presetSelectRef}
                multiple
                className="ae-input ae-admin-catcatalog-multiselect"
                size={Math.min(12, Math.max(4, attrs.length))}
              >
                {attrs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={() => void createPreset()}>
              Criar preset
            </button>
          </div>
        </>
      )}
    </div>
  );
}
