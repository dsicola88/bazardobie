import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, uploadAdminFile } from "../api.js";
import { getPublicCategories, type PublicCategory } from "../data/publicCategoriesCache.js";
import { useAuth } from "../auth/AuthContext.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import type { ProductCondition } from "../utils/productCondition.js";

function allowSellerFromContent(raw: string | undefined): boolean {
  const v = (raw ?? "false").trim().toLowerCase();
  return v === "true" || v === "1" || v === "sim" || v === "yes";
}

type Cat = PublicCategory;
type ShopMe = { isApproved: boolean; province: string; city: string };

type VarForm = {
  sku: string;
  name: string;
  color: string;
  size: string;
  salePrice: string;
  priceAdjust: string;
  stock: string;
  imageUrl: string;
};

type DelForm = {
  tipoEntrega: "VENDEDOR" | "PLATAFORMA";
  custoEntrega: string;
  prazoEstimado: string;
  areaProvincia: string;
  areaCidade: string;
  /** Só aplicável quando `tipoEntrega === "PLATAFORMA"` — empresas registadas pela administração. */
  logisticsPartnerId: string;
};

type ProductLoaded = {
  id: string;
  name: string;
  description: string;
  demoVideoUrl?: string | null;
  sku: string;
  condition: ProductCondition;
  conditionDetail?: string | null;
  price: string;
  promoPrice?: string | null;
  stock: number;
  categoryId?: string | null;
  moderationStatus: string;
  images: { url: string }[];
  variants: {
    sku: string;
    name?: string | null;
    color?: string | null;
    size?: string | null;
    priceAdjust?: string | null;
    salePrice?: string | null;
    stock: number;
    imageUrl?: string | null;
  }[];
  deliveryOptions: {
    id?: string;
    tipoEntrega: string;
    custoEntrega: string;
    prazoEstimado: number;
    areaProvincia: string;
    areaCidade: string;
    logisticsPartnerId?: string | null;
    logisticsPartner?: { id: string; name: string } | null;
  }[];
};

function flattenCats(cats: Cat[]): { id: string; label: string }[] {
  const byId = new Map(cats.map((c) => [c.id, c] as const));
  return [...cats]
    .sort((a, b) => a.name.localeCompare(b.name, "pt"))
    .map((c) => ({
      id: c.id,
      label: c.parentId ? `${byId.get(c.parentId)?.name ?? "—"} › ${c.name}` : c.name,
    }));
}

const emptyVar = (): VarForm => ({
  sku: "",
  name: "",
  color: "",
  size: "",
  salePrice: "",
  priceAdjust: "",
  stock: "0",
  imageUrl: "",
});

const emptyDel = (prov: string, city: string): DelForm => ({
  tipoEntrega: "PLATAFORMA",
  custoEntrega: "0",
  prazoEstimado: "3",
  areaProvincia: prov || "Bié",
  areaCidade: city || "Cuito",
  logisticsPartnerId: "",
});

export default function VendorProductEditor() {
  const { token } = useAuth();
  const { content } = useSiteContent();
  const allowSellerDelivery = allowSellerFromContent(content["public.allow_seller_delivery"]);
  const nav = useNavigate();
  const { productId } = useParams();
  const isNew = !productId;

  const [shopOk, setShopOk] = useState<boolean | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploadingIx, setUploadingIx] = useState<number | null>(null);
  const [uploadingVariantIx, setUploadingVariantIx] = useState<number | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [demoVideoUrl, setDemoVideoUrl] = useState("");
  const [sku, setSku] = useState("");
  const [condition, setCondition] = useState<ProductCondition>("NEW");
  const [conditionDetail, setConditionDetail] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [images, setImages] = useState<string[]>([""]);
  const [variants, setVariants] = useState<VarForm[]>([]);
  const [deliveries, setDeliveries] = useState<DelForm[]>([emptyDel("", "")]);
  const [moderationStatus, setModerationStatus] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(!isNew);
  const [shippingCarriers, setShippingCarriers] = useState<{ id: string; name: string }[]>([]);

  const catOptions = useMemo(() => flattenCats(cats), [cats]);

  useEffect(() => {
    void getPublicCategories().then(setCats);
  }, []);

  useEffect(() => {
    void apiFetch<{ id: string; name: string }[]>("/shipping-carriers")
      .then(setShippingCarriers)
      .catch(() => setShippingCarriers([]));
  }, []);

  useEffect(() => {
    if (!token) return;
    void apiFetch<ShopMe>("/vendor/shop/me", { token })
      .then((s) => {
        setShopOk(s.isApproved);
        setDeliveries((d) =>
          d.length === 1 && d[0].areaProvincia === "" && d[0].areaCidade === ""
            ? [emptyDel(s.province, s.city)]
            : d,
        );
      })
      .catch(() => setShopOk(false));
  }, [token]);

  const loadProduct = useCallback(() => {
    if (!token || !productId) return;
    setLoadErr(null);
    setLoadingEdit(true);
    void apiFetch<ProductLoaded>(`/vendor/product/${productId}`, { token })
      .then((p) => {
        setName(p.name);
        setDescription(p.description);
        setDemoVideoUrl(p.demoVideoUrl ?? "");
        setSku(p.sku);
        setCondition(p.condition ?? "NEW");
        setConditionDetail(p.conditionDetail ?? "");
        setCategoryId(p.categoryId ?? "");
        setPrice(String(p.price));
        setPromoPrice(p.promoPrice != null && Number(p.promoPrice) > 0 ? String(p.promoPrice) : "");
        setStock(String(p.stock));
        setImages(p.images.length ? p.images.map((i) => i.url) : [""]);
        setVariants(
          p.variants.length
            ? p.variants.map((v) => ({
                sku: v.sku,
                name: v.name ?? "",
                color: v.color ?? "",
                size: v.size ?? "",
                salePrice:
                  v.salePrice != null && String(v.salePrice).trim() !== "" && Number(v.salePrice) > 0
                    ? String(v.salePrice)
                    : "",
                priceAdjust:
                  v.salePrice != null &&
                  String(v.salePrice).trim() !== "" &&
                  Number(v.salePrice) > 0
                    ? ""
                    : v.priceAdjust != null
                      ? String(v.priceAdjust)
                      : "",
                stock: String(v.stock),
                imageUrl: v.imageUrl ?? "",
              }))
            : [],
        );
        setDeliveries(
          p.deliveryOptions.map((d) => ({
            tipoEntrega:
              !allowSellerDelivery && d.tipoEntrega === "VENDEDOR"
                ? "PLATAFORMA"
                : (d.tipoEntrega as DelForm["tipoEntrega"]),
            custoEntrega: String(d.custoEntrega),
            prazoEstimado: String(d.prazoEstimado),
            areaProvincia: d.areaProvincia,
            areaCidade: d.areaCidade,
            logisticsPartnerId:
              d.tipoEntrega === "VENDEDOR"
                ? ""
                : d.logisticsPartner?.id ?? d.logisticsPartnerId?.trim() ?? "",
          })),
        );
        setModerationStatus(p.moderationStatus);
      })
      .catch((e: unknown) =>
        setLoadErr(e instanceof Error ? e.message : "Não foi possível obter os dados desta referência."),
      )
      .finally(() => setLoadingEdit(false));
  }, [token, productId, allowSellerDelivery]);

  useEffect(() => {
    if (allowSellerDelivery) return;
    setDeliveries((prev) =>
      prev.map((d) => (d.tipoEntrega === "VENDEDOR" ? { ...d, tipoEntrega: "PLATAFORMA" } : d)),
    );
  }, [allowSellerDelivery]);

  useEffect(() => {
    if (isNew) {
      setLoadingEdit(false);
      setLoadErr(null);
      setName("");
      setDescription("");
      setDemoVideoUrl("");
      setSku("");
      setCondition("NEW");
      setConditionDetail("");
      setCategoryId("");
      setPrice("");
      setPromoPrice("");
      setStock("0");
      setImages([""]);
      setVariants([]);
      setModerationStatus(null);
      return;
    }
    loadProduct();
  }, [isNew, productId, loadProduct]);

  function buildPayload() {
    const imgList = images.map((u) => u.trim()).filter(Boolean);
    const priceN = Number(price);
    const stockN = Number(stock);
    const promoRaw = promoPrice.trim();
    const promoN = promoRaw === "" ? null : Number(promoRaw);

    const varPayload = variants
      .filter((v) => v.sku.trim())
      .map((v) => ({
        sku: v.sku.trim(),
        name: v.name.trim() || undefined,
        color: v.color.trim() || undefined,
        size: v.size.trim() || undefined,
        salePrice: v.salePrice.trim() === "" ? undefined : Number(v.salePrice),
        priceAdjust:
          v.salePrice.trim() !== ""
            ? undefined
            : v.priceAdjust.trim() === ""
              ? undefined
              : Number(v.priceAdjust),
        stock: Number(v.stock) || 0,
        imageUrl: v.imageUrl.trim() || undefined,
      }));

    const delPayload = deliveries.map((d) => {
      const base = {
        tipoEntrega: d.tipoEntrega,
        custoEntrega: Number(d.custoEntrega) || 0,
        prazoEstimado: Math.max(1, Math.floor(Number(d.prazoEstimado) || 1)),
        areaProvincia: d.areaProvincia.trim(),
        areaCidade: d.areaCidade.trim(),
      };
      if (d.tipoEntrega !== "PLATAFORMA") return base;
      const pid = d.logisticsPartnerId.trim();
      return pid ? { ...base, logisticsPartnerId: pid } : base;
    });

    return {
      name: name.trim(),
      description: description.trim(),
      demoVideoUrl: demoVideoUrl.trim() || null,
      sku: sku.trim(),
      condition,
      conditionDetail: condition === "USED" ? conditionDetail.trim() || null : null,
      categoryId: categoryId.trim() === "" ? null : categoryId.trim(),
      price: priceN,
      promoPrice: promoN,
      stock: stockN,
      images: imgList,
      variants: varPayload,
      deliveryOptions: delPayload,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || shopOk !== true) return;
    setErr(null);
    const body = buildPayload();

    if (body.images.length < 1) {
      setErr("Indique pelo menos uma imagem (URL válida ou ficheiro carregado).");
      return;
    }
    if (body.description.length < 10) {
      setErr(
        "A descrição deve conter, no mínimo, 10 caracteres. Inclua especificações técnicas, dimensões, materiais e condições de venda relevantes.",
      );
      return;
    }
    if (body.deliveryOptions.some((d) => d.areaProvincia.length < 2 || d.areaCidade.length < 2)) {
      setErr("Em cada modalidade de envio, indique província e cidade com a ortografia correcta (mínimo 2 caracteres por campo).");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await apiFetch("/vendor/products", { method: "POST", token, body: JSON.stringify(body) });
      } else {
        await apiFetch(`/vendor/products/${productId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(body),
        });
      }
      nav("/vendor/products");
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Não foi possível guardar. Verifique os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function onUploadFile(ix: number, file: File) {
    if (!token) return;
    setUploadingIx(ix);
    setErr(null);
    try {
      const url = await uploadAdminFile(token, file);
      setImages((prev) => {
        const next = [...prev];
        next[ix] = url;
        return next;
      });
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Falha no carregamento do ficheiro.");
    } finally {
      setUploadingIx(null);
    }
  }

  async function onUploadVideo(file: File) {
    if (!token) return;
    setUploadingVideo(true);
    setErr(null);
    try {
      const url = await uploadAdminFile(token, file);
      setDemoVideoUrl(url);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Falha no carregamento do video.");
    } finally {
      setUploadingVideo(false);
    }
  }

  async function onUploadVariantFile(ix: number, file: File) {
    if (!token) return;
    setUploadingVariantIx(ix);
    setErr(null);
    try {
      const url = await uploadAdminFile(token, file);
      setVariants((prev) => prev.map((v, i) => (i === ix ? { ...v, imageUrl: url } : v)));
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Falha no carregamento da imagem da variante.");
    } finally {
      setUploadingVariantIx(null);
    }
  }

  function moveImage(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  }

  if (!isNew && loadErr) {
    return (
      <div className="ae-panel" style={{ maxWidth: 520 }}>
        <p className="ae-muted">{loadErr}</p>
        <Link to="/vendor/products" className="btn btn-primary">
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  if (!isNew && loadingEdit) {
    return <p className="ae-muted">A sincronizar dados da referência…</p>;
  }

  return (
    <div className="ae-v-prod-flow">
      <header className="ae-v-head">
        <div>
          <h1 className="ae-v-title">{isNew ? "Nova publicação" : "Editar ficha de produto"}</h1>
          <p className="ae-v-prod-intro">
            Informação fiável e imagens de qualidade permitem uma validação mais rápida e reforçam a confiança do comprador.
            Os novos artigos e as alterações relevantes são revistos pela equipa antes da activação na loja pública.
          </p>
          {!isNew && moderationStatus === "APPROVED" ? (
            <p className="ae-admin-alert ae-admin-alert--ok" style={{ marginTop: 12 }} role="status">
              Se alterar conteúdos ou condições comercialmente relevantes, esta referência será novamente submetida à equipa
              antes de regressar à vitrine.
            </p>
          ) : null}
        </div>
        <Link to="/vendor/products" className="btn">
          Catálogo
        </Link>
      </header>

      {shopOk === false ? (
        <div className="ae-admin-alert ae-admin-alert--err" role="alert">
          A sua conta comercial ainda não está activa para publicações. Conclua o registo da loja e aguarde aprovação
          pela equipa BAZAR DO BIÉ.
          <Link to="/vendor/loja" style={{ marginLeft: 10 }}>
            Estado do registo
          </Link>
        </div>
      ) : null}

      <form className="ae-form" onSubmit={(e) => void onSubmit(e)}>
        <section className="ae-v-prod-sec ae-panel">
          <h2 className="ae-v-prod-sec__h">01 · Identificação e classificação</h2>
          <p className="ae-v-prod-sec__lede">
            Utilize uma designação comercial clara, um código de stock (SKU) exclusivo na sua loja e a categoria mais
            adequada ao artigo.
          </p>
          <div className="ae-field-grid-2">
            <div>
              <label htmlFor="pname">Designação do artigo</label>
              <input
                id="pname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={200}
                placeholder="Ex.: Pen USB 3.0 — 128 GB, cap metálica"
              />
            </div>
            <div>
              <label htmlFor="psku">SKU · código interno (único na loja)</label>
              <input
                id="psku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
                minLength={1}
                placeholder="Ex.: USB-128-MET-01"
              />
            </div>
            <div>
              <label htmlFor="pcondition">Condição do artigo</label>
              <select
                id="pcondition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as ProductCondition)}
              >
                <option value="NEW">Novo</option>
                <option value="USED">Usado</option>
                <option value="REFURBISHED">Recondicionado</option>
              </select>
            </div>
          </div>
          {condition === "USED" ? (
            <div>
              <label htmlFor="pcondition-detail">Estado do usado (preenchido pelo vendedor)</label>
              <textarea
                id="pcondition-detail"
                rows={3}
                value={conditionDetail}
                onChange={(e) => setConditionDetail(e.target.value)}
                minLength={6}
                maxLength={600}
                required
                placeholder="Ex.: 8 meses de uso, sem riscos no ecrã, bateria original."
              />
            </div>
          ) : null}
          <div>
            <label htmlFor="pcat">Categoria comercial</label>
            <select id="pcat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Seleccionar categoria…</option>
              {catOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pdesc">Descrição comercial · mínimo 10 caracteres</label>
            <textarea
              id="pdesc"
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={10}
              maxLength={20000}
              placeholder="Especificações técnicas, conteúdo da embalagem, dimensões, peso, garantia, compatibilidades, instruções de uso sucintas e condições de devolução, quando aplicável."
            />
            <p className="ae-field-hint">{description.length.toLocaleString("pt-AO")} caracteres · limite 20 000</p>
          </div>
          <div>
            <label htmlFor="pvideo">Video curto de demonstracao (opcional)</label>
            <div className="ae-v-prod-img-row">
              <input
                id="pvideo"
                value={demoVideoUrl}
                onChange={(e) => setDemoVideoUrl(e.target.value)}
                placeholder="URL https://...mp4 | .webm | .mov"
              />
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="sr-only"
                id="pvideo-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void onUploadVideo(f);
                }}
              />
              <label htmlFor="pvideo-file" className="btn" style={{ cursor: "pointer", margin: 0 }}>
                {uploadingVideo ? "A importar..." : "Carregar video"}
              </label>
              {demoVideoUrl ? (
                <button type="button" className="ae-mini-btn" onClick={() => setDemoVideoUrl("")}>
                  Remover
                </button>
              ) : null}
            </div>
            <p className="ae-field-hint">Limite recomendado: ate 60 segundos e ate 720p para ficheiro leve.</p>
          </div>
        </section>

        <section className="ae-v-prod-sec ae-panel">
          <h2 className="ae-v-prod-sec__h">02 · Recursos visuais</h2>
          <p className="ae-v-prod-sec__lede">
            Até 15 imagens. A primeira é utilizada como imagem principal nas grelhas de catálogo. Prefira fundo neutro,
            iluminação uniforme e foco nítido sobre o artigo. A primeira imagem deve representar fielmente o produto
            oferecido.
          </p>
          {images.map((u, ix) => (
            <div key={ix} className="ae-v-prod-img-row">
              <input
                value={u}
                onChange={(e) => setImages((prev) => prev.map((x, i) => (i === ix ? e.target.value : x)))}
                placeholder="URL https://… ou utilize «Carregar ficheiro»"
              />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                id={`pimg-${ix}`}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void onUploadFile(ix, f);
                }}
              />
              <label htmlFor={`pimg-${ix}`} className="btn" style={{ cursor: "pointer", margin: 0 }}>
                {uploadingIx === ix ? "A importar…" : "Carregar ficheiro"}
              </label>
              <button type="button" className="ae-mini-btn" disabled={ix === 0} onClick={() => moveImage(ix, ix - 1)}>
                ↑
              </button>
              <button
                type="button"
                className="ae-mini-btn"
                disabled={ix === images.length - 1}
                onClick={() => moveImage(ix, ix + 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="ae-mini-btn"
                disabled={images.length <= 1}
                onClick={() => setImages((prev) => prev.filter((_, i) => i !== ix))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn"
            disabled={images.length >= 15}
            onClick={() => setImages((prev) => [...prev, ""])}
          >
            + Adicionar imagem
          </button>
        </section>

        <section className="ae-v-prod-sec ae-panel">
          <h2 className="ae-v-prod-sec__h">03 · Preçário e inventário</h2>
          <p className="ae-v-prod-sec__lede">
            Valores em kwanzas angolanos (Kz). O preço promocional, quando utilizado, deve ser estritamente inferior ao
            preço de referência.
          </p>
          <div className="ae-field-grid-2">
            <div>
              <label htmlFor="pprice">Preço de referência (Kz)</label>
              <input
                id="pprice"
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="ppromo">Preço promocional (opcional, Kz)</label>
              <input
                id="ppromo"
                type="number"
                step="0.01"
                min="0.01"
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
                placeholder="Em branco se não aplicável"
              />
            </div>
            <div>
              <label htmlFor="pstock">Stock global (unidades)</label>
              <input
                id="pstock"
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                required
              />
              <p className="ae-field-hint">
                Se definir variantes infra, o controlo de existências passa a ser feito por SKU de variante; este campo
                mantém-se como stock base quando não há variantes.
              </p>
            </div>
          </div>
        </section>

        <section className="ae-v-prod-sec ae-panel">
          <h2 className="ae-v-prod-sec__h">04 · Variantes (opcional)</h2>
          <p className="ae-v-prod-sec__lede">
            Cada variante tem o seu SKU e stock. Defina um <strong>preço final próprio</strong> por variante (recomendado,
            estilo marketplaces como AliExpress). A opção «ajuste ±» permanece só por compatibilidade com fichas antigas.
          </p>
          {variants.map((v, ix) => (
            <div key={ix} className="ae-v-prod-variant-block">
              <div className="ae-field-grid-2">
                <div>
                  <label>SKU da variante</label>
                  <input value={v.sku} onChange={(e) => setVariants((p) => p.map((x, i) => (i === ix ? { ...x, sku: e.target.value } : x)))} />
                </div>
                <div>
                  <label>Designação da variante</label>
                  <input
                    value={v.name}
                    onChange={(e) => setVariants((p) => p.map((x, i) => (i === ix ? { ...x, name: e.target.value } : x)))}
                    placeholder="Ex.: 128 GB · grafite"
                  />
                </div>
                <div>
                  <label>Atributo — cor</label>
                  <input
                    value={v.color}
                    onChange={(e) => setVariants((p) => p.map((x, i) => (i === ix ? { ...x, color: e.target.value } : x)))}
                  />
                </div>
                <div>
                  <label>Atributo — tamanho, medida ou capacidade</label>
                  <input
                    value={v.size}
                    onChange={(e) => setVariants((p) => p.map((x, i) => (i === ix ? { ...x, size: e.target.value } : x)))}
                    placeholder="Ex.: M · 42 · 64 GB"
                  />
                </div>
                <div>
                  <label>Preço final desta variante (Kz)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={v.salePrice}
                    onChange={(e) =>
                      setVariants((p) =>
                        p.map((x, i) => (i === ix ? { ...x, salePrice: e.target.value } : x)),
                      )
                    }
                    placeholder="Ex.: 13000 (deixe em branco para usar ajuste ±)"
                  />
                </div>
                <div>
                  <label>Ajuste ao preço da ficha (± Kz, legado)</label>
                  <input
                    value={v.priceAdjust}
                    onChange={(e) =>
                      setVariants((p) =>
                        p.map((x, i) =>
                          i === ix ? { ...x, priceAdjust: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Usado só se o preço final acima estiver vazio"
                  />
                </div>
                <div>
                  <label>Existências</label>
                  <input
                    type="number"
                    min="0"
                    value={v.stock}
                    onChange={(e) => setVariants((p) => p.map((x, i) => (i === ix ? { ...x, stock: e.target.value } : x)))}
                  />
                </div>
              </div>
              <div>
                <label>Imagem específica (URL, opcional)</label>
                <div className="ae-v-prod-img-row">
                  <input
                    value={v.imageUrl}
                    onChange={(e) => setVariants((p) => p.map((x, i) => (i === ix ? { ...x, imageUrl: e.target.value } : x)))}
                    placeholder="https://… ou carregue ficheiro"
                  />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    id={`pvarimg-${ix}`}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void onUploadVariantFile(ix, f);
                    }}
                  />
                  <label htmlFor={`pvarimg-${ix}`} className="btn" style={{ cursor: "pointer", margin: 0 }}>
                    {uploadingVariantIx === ix ? "A importar…" : "Carregar ficheiro"}
                  </label>
                </div>
              </div>
              <button type="button" className="ae-mini-btn" onClick={() => setVariants((p) => p.filter((_, i) => i !== ix))}>
                Eliminar variante
              </button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => setVariants((p) => [...p, emptyVar()])}>
            + Incluir variante
          </button>
        </section>

        <section className="ae-v-prod-sec ae-panel">
          <h2 className="ae-v-prod-sec__h">05 · Condições de expedição</h2>
          <p className="ae-v-prod-sec__lede">
            Indique pelo menos uma modalidade. Por defeito, seleccione a logística operada pela plataforma (BAZAR DO
            BIÉ). Para cada expedición da plataforma pode associar uma transportadora activa já registada pelo
            administrador (o cliente vê esse nome ao escolher o envio, ao estilo de marketplaces como AliExpress). O
            prazo indicado corresponde a dias úteis estimados para preparação e envio na área definida.
            {allowSellerDelivery ? (
              <>
                {" "}
                A expedição directamente pela sua loja está autorizada nesta instalação; utilize-a apenas se cumprir o
                serviço anunciado.
              </>
            ) : (
              <>
                {" "}
                A modalidade «envio pela loja» só estará disponível quando a equipa a activar ao nível da
                plataforma.
              </>
            )}
          </p>
          {deliveries.map((d, ix) => (
            <div key={ix} className="ae-v-prod-del-block">
              <div className="ae-field-grid-2">
                <div>
                  <label>Modalidade de envio</label>
                  <select
                    value={d.tipoEntrega}
                    onChange={(e) =>
                      setDeliveries((p) =>
                        p.map((x, i) => {
                          if (i !== ix) return x;
                          const tipo = e.target.value as DelForm["tipoEntrega"];
                          return {
                            ...x,
                            tipoEntrega: tipo,
                            logisticsPartnerId: tipo === "VENDEDOR" ? "" : x.logisticsPartnerId,
                          };
                        }),
                      )
                    }
                  >
                    <option value="PLATAFORMA">BAZAR DO BIÉ — logística da plataforma</option>
                    {allowSellerDelivery ? <option value="VENDEDOR">Expedição pela minha loja</option> : null}
                  </select>
                </div>
                <div>
                  <label>Portes (Kz)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={d.custoEntrega}
                    onChange={(e) => setDeliveries((p) => p.map((x, i) => (i === ix ? { ...x, custoEntrega: e.target.value } : x)))}
                  />
                  <p className="ae-field-hint">0 = portes grátis para esta modalidade e zona.</p>
                </div>
                <div>
                  <label>Prazo estimado (dias úteis)</label>
                  <input
                    type="number"
                    min="1"
                    value={d.prazoEstimado}
                    onChange={(e) => setDeliveries((p) => p.map((x, i) => (i === ix ? { ...x, prazoEstimado: e.target.value } : x)))}
                  />
                </div>
              </div>
              {d.tipoEntrega === "PLATAFORMA" ? (
                <div>
                  <label>Transportadora na última milha (opcional)</label>
                  <select
                    value={d.logisticsPartnerId}
                    onChange={(e) =>
                      setDeliveries((p) => p.map((x, i) => (i === ix ? { ...x, logisticsPartnerId: e.target.value } : x)))
                    }
                  >
                    <option value="">Sem designação específica (equipa ou rota da plataforma)</option>
                    {shippingCarriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="ae-field-hint">
                    Lista alimentada em Admin → Transportadoras. Apenas empresas activas aparecem aqui.
                  </p>
                </div>
              ) : null}
              <div className="ae-field-grid-2">
                <div>
                  <label>Província de cobertura</label>
                  <input
                    value={d.areaProvincia}
                    onChange={(e) => setDeliveries((p) => p.map((x, i) => (i === ix ? { ...x, areaProvincia: e.target.value } : x)))}
                    required
                    minLength={2}
                  />
                </div>
                <div>
                  <label>Cidade ou zona de cobertura</label>
                  <input
                    value={d.areaCidade}
                    onChange={(e) => setDeliveries((p) => p.map((x, i) => (i === ix ? { ...x, areaCidade: e.target.value } : x)))}
                    required
                    minLength={2}
                  />
                </div>
              </div>
              <button
                type="button"
                className="ae-mini-btn"
                disabled={deliveries.length <= 1}
                onClick={() => setDeliveries((p) => p.filter((_, i) => i !== ix))}
              >
                Remover modalidade
              </button>
            </div>
          ))}
          <button type="button" className="btn" disabled={deliveries.length >= 12} onClick={() => setDeliveries((p) => [...p, emptyDel(p[0]?.areaProvincia ?? "", p[0]?.areaCidade ?? "")])}>
            + Outra modalidade de envio
          </button>
        </section>

        {err ? (
          <div className="ae-admin-alert ae-admin-alert--err" role="alert">
            {err}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || shopOk !== true}>
            {saving ? "A gravar…" : isNew ? "Enviar para validação" : "Gravar alterações"}
          </button>
          <Link to="/vendor/products" className="btn">
            Fechar sem gravar
          </Link>
        </div>
      </form>
    </div>
  );
}
