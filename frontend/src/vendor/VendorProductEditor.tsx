import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, uploadAdminFile } from "../api.js";
import { getPublicCategories, type PublicCategory } from "../data/publicCategoriesCache.js";
import { useAuth } from "../auth/AuthContext.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import type { ProductCondition } from "../utils/productCondition.js";
import { computeListingQualityPreview } from "../utils/listingQualityPreview.js";
import { computePublicationSteps, publicationOverallPct } from "../utils/publicationAssistant.js";
import { CATALOG_TERMS } from "../catalog/catalogTerminology.js";
import { resolveNichePack } from "../catalog/categoryNichePacks.js";
import { structuredRequiredProgress, vendorCopilotTips } from "./vendorCopilot.js";
import { listingQualityGradeCssSuffix } from "../utils/listingGradeUi.js";
import CategoryTreeSelect from "../components/CategoryTreeSelect.js";

function allowSellerFromContent(raw: string | undefined): boolean {
  const v = (raw ?? "false").trim().toLowerCase();
  return v === "true" || v === "1" || v === "sim" || v === "yes";
}

type Cat = PublicCategory;
type ShopMe = { isApproved: boolean; province: string; city: string };

type CategoryAttrDefPublic = {
  id: string;
  key: string;
  label: string;
  inputType: "TEXT" | "NUMBER" | "SELECT";
  options: string[] | null;
  helpText?: string | null;
  isRequired: boolean;
  sortOrder: number;
  unitCode: string | null;
  unit: { code: string; symbol: string; namePt: string; quantity: string } | null;
  facetEnabled: boolean;
  primaryRank: number;
  autoSuggest: boolean;
  synonyms: string[];
};

type CategoryPresetPublic = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isDefault: boolean;
  attributes: {
    id: string;
    key: string;
    label: string;
    inputType: string;
    autoSuggest: boolean;
    primaryRank: number;
    sortOrder: number;
  }[];
};

type VarForm = {
  sku: string;
  name: string;
  color: string;
  size: string;
  salePrice: string;
  priceAdjust: string;
  stock: string;
  imageUrl: string;
  properties: { label: string; value: string }[];
  /** Valores por id de CategoryAttribute (ficha técnica da categoria). */
  categoryValues: Record<string, string>;
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
  isDraft?: boolean;
  archivedAt?: string | null;
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
    properties?: { label: string; value: string }[];
    variantStructuredValues?: { attributeId: string; value: string }[];
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

const emptyVar = (): VarForm => ({
  sku: "",
  name: "",
  color: "",
  size: "",
  salePrice: "",
  priceAdjust: "",
  stock: "0",
  imageUrl: "",
  properties: [],
  categoryValues: {},
});

const emptyDel = (prov: string, city: string): DelForm => ({
  tipoEntrega: "PLATAFORMA",
  custoEntrega: "0",
  prazoEstimado: "3",
  areaProvincia: prov || "Bié",
  areaCidade: city || "Cuito",
  logisticsPartnerId: "",
});

function categoryAttrSort(a: CategoryAttrDefPublic, b: CategoryAttrDefPublic): number {
  const pr = (b.primaryRank ?? 0) - (a.primaryRank ?? 0);
  if (pr !== 0) return pr;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.label.localeCompare(b.label, "pt");
}

function categoryAttrFieldLabel(a: CategoryAttrDefPublic): string {
  if (a.inputType === "NUMBER") {
    if (a.unit?.symbol) return `${a.label} (${a.unit.symbol})`;
    if (a.unitCode) return `${a.label} (${a.unitCode})`;
  }
  return a.label;
}

function validateVariantSkus(parentSkuRaw: string, rows: VarForm[]): string | null {
  const parent = parentSkuRaw.trim().toLowerCase();
  const seen = new Set<string>();
  for (const row of rows) {
    const k = row.sku.trim().toLowerCase();
    if (!k) continue;
    if (seen.has(k)) {
      return "Cada variante precisa de um SKU distinto. Corrija linhas com o mesmo SKU.";
    }
    seen.add(k);
    if (parent && k === parent) {
      return "O SKU de uma variante não pode ser igual ao SKU principal do artigo.";
    }
  }
  return null;
}

function validateVariantProperties(rows: VarForm[]): string | null {
  for (const row of rows) {
    const seen = new Set<string>();
    for (const p of row.properties ?? []) {
      const k = p.label.trim().toLowerCase();
      if (!k) continue;
      if (seen.has(k)) {
        return "Cada característica precisa de um nome (rótulo) distinto dentro da mesma variante.";
      }
      seen.add(k);
    }
  }
  return null;
}

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
  const [categoryAttrs, setCategoryAttrs] = useState<CategoryAttrDefPublic[]>([]);
  const [categoryValues, setCategoryValues] = useState<Record<string, string>>({});
  const [categoryPresets, setCategoryPresets] = useState<CategoryPresetPublic[]>([]);
  const [presetSortId, setPresetSortId] = useState("");
  const [price, setPrice] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [images, setImages] = useState<string[]>([""]);
  const [variants, setVariants] = useState<VarForm[]>([]);
  const [deliveries, setDeliveries] = useState<DelForm[]>([emptyDel("", "")]);
  const [moderationStatus, setModerationStatus] = useState<string | null>(null);
  const [listingMeta, setListingMeta] = useState<{ isDraft: boolean; archivedAt: string | null }>({
    isDraft: false,
    archivedAt: null,
  });
  const [loadingEdit, setLoadingEdit] = useState(!isNew);
  const [shippingCarriers, setShippingCarriers] = useState<{ id: string; name: string }[]>([]);
  /** Sugestões do assistente: recolhidas por defeito para o editor ficar visível primeiro. */
  const [assistantHintsOpen, setAssistantHintsOpen] = useState(false);
  const [vendorCopilotOpen, setVendorCopilotOpen] = useState(true);
  const [productType, setProductType] = useState<"SIMPLE" | "VARIANT">("SIMPLE");
  const [technicalSectionOpen, setTechnicalSectionOpen] = useState(false);

  const selectedVendorCategory = useMemo(
    () => (categoryId.trim() ? cats.find((c) => c.id === categoryId) ?? null : null),
    [cats, categoryId],
  );

  const ancestorSlugsVendor = useMemo(() => {
    if (!cats.length || !categoryId.trim()) return [] as string[];
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

  const nichePackVendor = useMemo(() => {
    if (!selectedVendorCategory) return null;
    return resolveNichePack(selectedVendorCategory.slug, selectedVendorCategory.name, ancestorSlugsVendor);
  }, [selectedVendorCategory, ancestorSlugsVendor]);

  const vendorCopilotTipsList = useMemo(() => vendorCopilotTips(nichePackVendor), [nichePackVendor]);

  const structuredProgress = useMemo(
    () => structuredRequiredProgress(categoryAttrs, variants),
    [categoryAttrs, variants],
  );

  const categoryAttrsSorted = useMemo(() => {
    const base = [...categoryAttrs];
    if (!presetSortId) return base.sort(categoryAttrSort);
    const preset = categoryPresets.find((p) => p.id === presetSortId);
    if (!preset) return base.sort(categoryAttrSort);
    const order = new Map(preset.attributes.map((a, i) => [a.id, i] as const));
    return base.sort((a, b) => {
      const ia = order.has(a.id) ? order.get(a.id)! : 10_000;
      const ib = order.has(b.id) ? order.get(b.id)! : 10_000;
      if (ia !== ib) return ia - ib;
      return categoryAttrSort(a, b);
    });
  }, [categoryAttrs, categoryPresets, presetSortId]);

  const listingPreview = useMemo(
    () =>
      computeListingQualityPreview({
        name,
        description,
        categoryId,
        images,
        demoVideoUrl,
        condition,
        conditionDetail,
        isDraft: listingMeta.isDraft,
        variants,
        categoryAttrs: categoryAttrs.map((a) => ({ id: a.id, isRequired: a.isRequired })),
      }),
    [
      name,
      description,
      categoryId,
      images,
      demoVideoUrl,
      condition,
      conditionDetail,
      listingMeta.isDraft,
      variants,
      categoryAttrs,
    ],
  );

  const publicationSteps = useMemo(
    () =>
      computePublicationSteps({
        name,
        sku,
        categoryId,
        description,
        condition,
        conditionDetail,
        images,
        price,
        stock,
        variants,
        categoryAttrs: categoryAttrs.map((a) => ({ id: a.id, isRequired: a.isRequired })),
        deliveries,
        productType,
      }),
    [
      name,
      sku,
      categoryId,
      description,
      condition,
      conditionDetail,
      images,
      price,
      stock,
      variants,
      categoryAttrs,
      deliveries,
      productType,
    ],
  );

  const publicationAvg = useMemo(() => publicationOverallPct(publicationSteps), [publicationSteps]);

  const goVendorStep = useCallback((stepId: string) => {
    document.getElementById(`vstep-${stepId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const applyVendorDefaultPreset = useCallback(() => {
    const d = categoryPresets.find((p) => p.isDefault) ?? categoryPresets[0];
    if (d) setPresetSortId(d.id);
  }, [categoryPresets]);

  const goToTechnicalSheetVariant = useCallback(() => {
    const hasSku = variants.some((v) => v.sku.trim());
    if (!hasSku) {
      setVariants((prev) => {
        if (prev.some((v) => v.sku.trim())) return prev;
        if (prev.length === 0) {
          const row = emptyVar();
          row.sku = sku.trim() || "";
          return [row];
        }
        const nx = [...prev];
        const ix = nx.findIndex((v) => !v.sku.trim());
        if (ix >= 0) {
          nx[ix] = { ...nx[ix], sku: sku.trim() || nx[ix].sku };
          return nx;
        }
        const row = emptyVar();
        row.sku = sku.trim() || "";
        return [...nx, row];
      });
    }
    goVendorStep("4");
  }, [variants, sku, goVendorStep]);

  useEffect(() => {
    void getPublicCategories().then(setCats);
  }, []);

  useEffect(() => {
    void apiFetch<{ id: string; name: string }[]>("/shipping-carriers")
      .then(setShippingCarriers)
      .catch(() => setShippingCarriers([]));
  }, []);

  useEffect(() => {
    if (!categoryId.trim()) {
      setCategoryAttrs([]);
      setCategoryValues({});
      return;
    }
    let cancelled = false;
    void apiFetch<CategoryAttrDefPublic[]>(`/categories/${encodeURIComponent(categoryId.trim())}/attributes`)
      .then((rows) => {
        if (!cancelled) {
          setCategoryAttrs(rows);
          setCategoryValues({});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCategoryAttrs([]);
          setCategoryValues({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  useEffect(() => {
    if (!categoryId.trim()) {
      setCategoryPresets([]);
      setPresetSortId("");
      return;
    }
    let cancelled = false;
    void apiFetch<{ items: CategoryPresetPublic[] }>(
      `/categories/${encodeURIComponent(categoryId.trim())}/attribute-presets`,
    )
      .then((r) => {
        if (cancelled) return;
        const items = r.items ?? [];
        setCategoryPresets(items);
        const def = items.find((p) => p.isDefault);
        setPresetSortId((prev) => {
          if (prev && items.some((p) => p.id === prev)) return prev;
          return def?.id ?? "";
        });
      })
      .catch(() => {
        if (!cancelled) {
          setCategoryPresets([]);
          setPresetSortId("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

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
        
        // Determine product type based on variants
        const hasVariants = p.variants.length > 0;
        setProductType(hasVariants ? "VARIANT" : "SIMPLE");
        
        // Load category values for simple products
        if (!hasVariants && p.categoryId) {
          void apiFetch<{ attributeId: string; value: string }[]>(`/vendor/product/${productId}/category-attributes`, { token })
            .then((attrs) => {
              setCategoryValues(Object.fromEntries(attrs.map((a) => [a.attributeId, a.value])));
            })
            .catch(() => setCategoryValues({}));
        }
        
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
                properties: (v.properties ?? []).map((pr) => ({
                  label: pr.label ?? "",
                  value: pr.value ?? "",
                })),
                categoryValues: Object.fromEntries(
                  (v.variantStructuredValues ?? []).map((sv) => [sv.attributeId, sv.value]),
                ),
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
        setListingMeta({ isDraft: Boolean(p.isDraft), archivedAt: p.archivedAt ?? null });
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
      setListingMeta({ isDraft: false, archivedAt: null });
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

    // Build category attribute values for simple products
    const simpleCatVals =
      productType === "SIMPLE" && categoryId.trim() !== ""
        ? Object.entries(categoryValues ?? {})
            .map(([attributeId, value]) => ({ attributeId, value: value.trim() }))
            .filter((x) => x.value.length > 0)
        : [];

    const varPayload = variants
      .filter((v) => v.sku.trim())
      .map((v) => {
        const props =
          v.properties
            ?.map((p) => ({ label: p.label.trim(), value: p.value.trim() }))
            .filter((p) => p.label && p.value) ?? [];
        const catVals =
          categoryId.trim() === ""
            ? []
            : Object.entries(v.categoryValues ?? {})
                .map(([attributeId, value]) => ({ attributeId, value: value.trim() }))
                .filter((x) => x.value.length > 0);
        return {
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
          ...(props.length ? { properties: props } : {}),
          ...(catVals.length ? { categoryAttributeValues: catVals } : {}),
        };
      });

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
      ...(simpleCatVals.length ? { categoryAttributeValues: simpleCatVals } : {}),
    };
  }

  function buildDraftPartialPayload(): Record<string, unknown> {
    const full = buildPayload();
    const out: Record<string, unknown> = {
      name: full.name,
      description: full.description,
      sku: full.sku,
      condition: full.condition,
      categoryId: full.categoryId,
      price: full.price,
      promoPrice: full.promoPrice,
      stock: full.stock,
      demoVideoUrl: full.demoVideoUrl,
      conditionDetail: full.conditionDetail,
    };
    if (full.images.length >= 1) out.images = full.images;
    if (full.variants.length > 0) out.variants = full.variants;
    const dels = full.deliveryOptions.filter(
      (d) => d.areaProvincia.trim().length >= 2 && d.areaCidade.trim().length >= 2,
    );
    if (dels.length >= 1) out.deliveryOptions = dels;
    return out;
  }

  async function saveDraftProgress() {
    if (!token || shopOk !== true || !productId) return;
    setErr(null);
    const skuErr = validateVariantSkus(sku, variants);
    if (skuErr) {
      setErr(skuErr);
      return;
    }
    const propErr = validateVariantProperties(variants);
    if (propErr) {
      setErr(propErr);
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/vendor/products/${productId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(buildDraftPartialPayload()),
      });
      await loadProduct();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Não foi possível gravar o progresso.");
    } finally {
      setSaving(false);
    }
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
    const skuErr = validateVariantSkus(sku, variants);
    if (skuErr) {
      setErr(skuErr);
      return;
    }
    const propErr = validateVariantProperties(variants);
    if (propErr) {
      setErr(propErr);
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

      {!isNew && listingMeta.archivedAt ? (
        <div className="ae-admin-alert ae-admin-alert--err" role="alert">
          Esta referência está arquivada: não aparece na vitrina e a edição da ficha está bloqueada até restaurar no
          catálogo («Restaurar do arquivo»).
        </div>
      ) : null}
      {!isNew && listingMeta.isDraft ? (
        <div
          className="ae-admin-alert"
          role="status"
          style={{
            marginTop: shopOk === false ? 12 : 0,
            borderColor: "var(--ae-line)",
            background: "#fafbfc",
          }}
        >
          Modo rascunho: adicione descrição (mín. 10 caracteres), pelo menos uma imagem e uma opção de envio antes de
          activar a venda.
        </div>
      ) : null}

      <div className="ae-v-prod-layout">
        <nav className="ae-v-prod-rail" aria-label="Assistente de publicação — etapas">
          <p className="ae-v-prod-rail__title">Etapas</p>
          <p className="ae-v-prod-rail__sub">Toque para saltar à secção. O assistente acompanha o preenchimento.</p>
          <ol className="ae-v-prod-rail__list">
            {publicationSteps.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`ae-v-prod-rail__btn${s.pct >= 88 ? " ae-v-prod-rail__btn--done" : ""}`}
                  onClick={() => goVendorStep(s.id)}
                >
                  <span className="ae-v-prod-rail__btn-label">{s.label}</span>
                  <span className="ae-v-prod-rail__btn-meta">
                    {s.pct >= 88 ? "✓ " : ""}
                    {s.pct}%
                  </span>
                </button>
                <div className="ae-v-prod-rail__microbar" aria-hidden>
                  <div className="ae-v-prod-rail__microfill" style={{ width: `${s.pct}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </nav>

        <div className="ae-v-prod-maincol">
          <div className="ae-v-prod-assistant">
            <div className="ae-v-prod-assistant__head">
              <div>
                <h2 className="ae-v-prod-assistant__title">Assistente de publicação</h2>
                <p className="ae-v-prod-assistant__lead">
                  O Bazar calcula a <strong>qualidade do anúncio</strong> e guia-o nas melhorias que mais aumentam
                  confiança e desempenho na loja.
                </p>
              </div>
              <div
                className={`ae-v-prod-score-ring ae-v-prod-score-ring--${listingQualityGradeCssSuffix(listingPreview.grade)}`}
                style={{ "--ae-score": String(listingPreview.score) } as CSSProperties}
                aria-hidden
              >
                <div className="ae-v-prod-score-ring__inner">
                  <span className="ae-v-prod-score-ring__val">{listingPreview.score}</span>
                  <span className="ae-v-prod-score-ring__max">/100</span>
                </div>
              </div>
            </div>

            <div className="ae-v-prod-assistant__global">
              <div className="ae-v-prod-assistant__global-row">
                <span>Progresso global do formulário</span>
                <strong>{publicationAvg}%</strong>
              </div>
              <div className="ae-v-prod-assistant__bar" aria-hidden>
                <div className="ae-v-prod-assistant__fill" style={{ width: `${publicationAvg}%` }} />
              </div>
            </div>

            <div className="ae-v-prod-assistant__quality-row">
              <span
                className={`ae-badge ae-listing-quality-preview__grade ae-listing-quality-preview__grade--${listingQualityGradeCssSuffix(listingPreview.grade)}`}
              >
                Qualidade: {listingPreview.grade}
              </span>
              <span className="ae-v-prod-assistant__impact">
                {listingPreview.score < 72
                  ? "Fichas mais completas tendem a receber mais cliques e aprovação mais rápida."
                  : "Bom nível — pequenos retoques em fotos e ficha técnica podem elevar ainda mais a conversão."}
              </span>
            </div>

            {listingPreview.hintItems.length > 0 ? (
              <>
                <div className="ae-v-prod-assistant__hints-toolbar">
                  <button
                    type="button"
                    className="ae-v-prod-assistant__hints-toggle"
                    aria-expanded={assistantHintsOpen}
                    onClick={() => setAssistantHintsOpen((v) => !v)}
                  >
                    {assistantHintsOpen
                      ? "Ocultar sugestões de melhoria"
                      : `Ver sugestões de melhoria (${listingPreview.hintItems.length})`}
                  </button>
                </div>
                {assistantHintsOpen ? (
                  <ul className="ae-v-prod-hint-cards">
                    {listingPreview.hintItems.map((h, hi) => (
                      <li key={hi} className="ae-v-prod-hint-card">
                        <div className="ae-v-prod-hint-card__top">
                          {h.impactPts != null ? (
                            <span className="ae-v-prod-hint-card__pts">+{h.impactPts} pts</span>
                          ) : (
                            <span className="ae-v-prod-hint-card__pts ae-v-prod-hint-card__pts--info">Dica</span>
                          )}
                        </div>
                        <p className="ae-v-prod-hint-card__msg">{h.message}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="ae-v-prod-assistant__ok">
                Tudo coerente neste momento. Avance para as imagens e a ficha técnica para maximizar a pontuação.
              </p>
            )}
          </div>

      <form className="ae-form" onSubmit={(e) => void onSubmit(e)}>
        <section className="ae-v-prod-sec ae-panel" id="vstep-1">
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
            <CategoryTreeSelect
              categories={cats}
              value={categoryId}
              onChange={(next) => {
                if (next === categoryId) return;
                setCategoryId(next);
                setCategoryValues({});
                setVariants((prev) => prev.map((row) => ({ ...row, categoryValues: {} })));
                setProductType("SIMPLE");
              }}
              placeholder="Seleccionar categoria…"
            />
            <p className="ae-field-hint">{CATALOG_TERMS.vendorCategoryPickHint}</p>
          </div>

          {categoryId.trim() ? (
            <div>
              <label>Tipo de produto</label>
              <div className="ae-field-grid-2">
                <div>
                  <input
                    type="radio"
                    id="ptype-simple"
                    name="productType"
                    value="SIMPLE"
                    checked={productType === "SIMPLE"}
                    onChange={() => {
                      setProductType("SIMPLE");
                      setVariants([]);
                    }}
                  />
                  <label htmlFor="ptype-simple" style={{ marginLeft: 8, cursor: "pointer" }}>
                    Produto simples (sem variantes)
                  </label>
                </div>
                <div>
                  <input
                    type="radio"
                    id="ptype-variant"
                    name="productType"
                    value="VARIANT"
                    checked={productType === "VARIANT"}
                    onChange={() => {
                      setProductType("VARIANT");
                      if (variants.length === 0) {
                        setVariants([emptyVar()]);
                      }
                    }}
                  />
                  <label htmlFor="ptype-variant" style={{ marginLeft: 8, cursor: "pointer" }}>
                    Produto com variantes
                  </label>
                </div>
              </div>
              <p className="ae-field-hint">
                {productType === "SIMPLE"
                  ? "Produto único: define um SKU, preço e stock globais."
                  : "Produto com variantes: define SKU, preço e stock por cada variante (cor, tamanho, etc.)."}
              </p>
            </div>
          ) : null}

          {categoryId.trim() && categoryAttrs.length > 0 ? (
            <div className="ae-v-copilot">
              <div className="ae-v-copilot__top">
                <div className="ae-v-copilot__intro">
                  <h3 className="ae-v-copilot__title">Copiloto comercial</h3>
                  <p className="ae-v-copilot__sub">
                    {nichePackVendor ? (
                      <>
                        Segmento identificado: <strong>{nichePackVendor.label}</strong>. Orientação alinhada ao catálogo
                        oficial e às boas práticas deste nicho.
                      </>
                    ) : (
                      <>
                        Guia para preencher a <strong>ficha técnica</strong> com consistência — melhora filtros, busca e
                        validação do anúncio.
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className="ae-v-copilot__collapse"
                  aria-expanded={vendorCopilotOpen}
                  onClick={() => setVendorCopilotOpen((x) => !x)}
                >
                  {vendorCopilotOpen ? "Recolher" : "Expandir"}
                </button>
              </div>
              {vendorCopilotOpen ? (
                <div className="ae-v-copilot__body">
                  <div className="ae-v-copilot__progress-block">
                    <div className="ae-v-copilot__progress-head">
                      <span>Obrigatórios da ficha (todas as variantes com SKU)</span>
                      <strong>
                        {structuredProgress.requiredTotal === 0
                          ? "Sem campos obrigatórios nesta categoria"
                          : structuredProgress.activeVariantRows === 0
                            ? `${structuredProgress.requiredTotal} campo(s) — adicione variante com SKU`
                            : `${structuredProgress.satisfiedAcrossAllActive} / ${structuredProgress.requiredTotal} completos em todas as variantes`}
                      </strong>
                    </div>
                    {structuredProgress.requiredTotal > 0 ? (
                      <div className="ae-v-copilot__bar" aria-hidden>
                        <div
                          className="ae-v-copilot__fill"
                          style={{
                            width: `${structuredProgress.activeVariantRows === 0 ? 0 : Math.min(100, Math.round((structuredProgress.satisfiedAcrossAllActive / structuredProgress.requiredTotal) * 100))}%`,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="ae-v-copilot__actions">
                    <button type="button" className="btn btn-primary" onClick={goToTechnicalSheetVariant}>
                      Ir à ficha técnica (secção 04)
                    </button>
                    {categoryPresets.length > 0 ? (
                      <button type="button" className="btn" onClick={applyVendorDefaultPreset}>
                        Ordenar campos pelo modelo sugerido
                      </button>
                    ) : null}
                  </div>
                  <ul className="ae-v-copilot__tips">
                    {vendorCopilotTipsList.map((t, ti) => (
                      <li key={ti}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

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

        <section className="ae-v-prod-sec ae-panel" id="vstep-2">
          <h2 className="ae-v-prod-sec__h">02 · Imagens</h2>
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

        {categoryId.trim() && productType === "SIMPLE" ? (
          <section className="ae-v-prod-sec ae-panel" id="vstep-3">
            <h2 className="ae-v-prod-sec__h">03 · Inventário</h2>
            <p className="ae-v-prod-sec__lede">
              Valores em kwanzas angolanos (Kz). O preço promocional, quando utilizado, deve ser estritamente inferior ao
              preço de referência.
            </p>
            <div className="ae-field-grid-2">
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
                <label htmlFor="pstock">Stock (unidades)</label>
                <input
                  id="pstock"
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  required
                />
              </div>
            </div>
          </section>
        ) : null}

        {categoryId.trim() && productType === "VARIANT" ? (
          <section className="ae-v-prod-sec ae-panel" id="vstep-4">
            <h2 className="ae-v-prod-sec__h">03 · Variantes</h2>
            <p className="ae-v-prod-sec__lede">
              Cada variante tem o seu <strong>SKU</strong>, <strong>preço</strong> e <strong>stock</strong>. Defina as
              diferenças entre as versões do produto (cor, tamanho, capacidade, etc.).
            </p>
          {categoryAttrs.length > 0 ? (
            <div className="ae-v-prod-suggest">
              <strong>Sugestões inteligentes para esta categoria</strong>
              <p className="ae-v-prod-suggest__lede">
                Campos do catálogo oficial: o <strong>Copiloto comercial</strong> (secção 01) indica o nicho e o progresso
                dos obrigatórios; aqui pode saltar directamente aos campos em destaque.
              </p>
              <div className="ae-v-prod-suggest__chips">
                {categoryAttrsSorted
                  .filter((a) => a.isRequired || a.autoSuggest)
                  .slice(0, 12)
                  .map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="ae-v-prod-suggest-chip"
                      onClick={() => goVendorStep("4")}
                    >
                      {categoryAttrFieldLabel(a)}
                      {a.isRequired ? <span className="ae-v-prod-suggest-chip__req">*</span> : null}
                      {a.autoSuggest && !a.isRequired ? (
                        <span className="ae-v-prod-suggest-chip__tag">recomendado</span>
                      ) : null}
                    </button>
                  ))}
              </div>
              <p className="ae-field-hint" style={{ marginTop: 8 }}>
                O painel <strong>Assistente de publicação</strong> (no topo) mostra a pontuação e o impacto estimado das
                melhorias — actualiza-se enquanto edita.
              </p>
            </div>
          ) : null}
          <p className="ae-field-hint" style={{ marginBottom: 14 }}>
            Se várias variantes partilham a mesma <strong>cor</strong>, preencha sempre{" "}
            <strong>tamanho / medida</strong> ou uma <strong>designação</strong> diferente por SKU — assim os botões na
            página do produto mostram texto legível em vez de pastilhas vazias.
          </p>
          {categoryAttrs.length > 0 && categoryPresets.length > 0 ? (
            <div className="ae-v-preset-row" style={{ marginBottom: 16 }}>
              <label htmlFor="preset-sort" style={{ display: "block", marginBottom: 6 }}>
                Modelo de ficha (ordena os atributos sugeridos para esta categoria)
              </label>
              <select
                id="preset-sort"
                value={presetSortId}
                onChange={(e) => setPresetSortId(e.target.value)}
              >
                <option value="">Ordem padrão (destaque da categoria)</option>
                {categoryPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isDefault ? " (predefinido)" : ""}
                  </option>
                ))}
              </select>
              <p className="ae-field-hint" style={{ marginTop: 6 }}>
                Não altera valores já escritos — só a ordem dos campos por variante, para seguir o modelo escolhido na
                administração.
              </p>
            </div>
          ) : null}
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
              {categoryAttrs.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <p className="ae-field-hint" style={{ marginBottom: 6 }}>
                    <strong>{CATALOG_TERMS.vendorCatalogAttrsLead}</strong> —{" "}
                    {CATALOG_TERMS.vendorStructuredFieldsHint}
                  </p>
                  <p className="ae-field-hint ae-muted" style={{ marginBottom: 10, fontSize: 12 }}>
                    {CATALOG_TERMS.vendorStructuredFieldsBadgesHint}
                  </p>
                  {categoryAttrsSorted.map((a) => (
                      <div key={a.id} style={{ marginBottom: 12 }}>
                        <label style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                          <span>
                            {categoryAttrFieldLabel(a)}
                            {a.isRequired ? " *" : ""}
                          </span>
                          {a.autoSuggest ? (
                            <span className="ae-badge ae-badge--feat" style={{ fontSize: 10, fontWeight: 600 }}>
                              Sugerido
                            </span>
                          ) : null}
                        </label>
                        {a.synonyms?.length ? (
                          <p className="ae-field-hint" style={{ margin: "4px 0 6px" }}>
                            Também conhecido por: {a.synonyms.join(", ")}
                          </p>
                        ) : null}
                        {a.inputType === "SELECT" && a.options && a.options.length > 0 ? (
                          <>
                            <select
                              value={v.categoryValues[a.id] ?? ""}
                              onChange={(e) =>
                                setVariants((p) =>
                                  p.map((x, i) =>
                                    i === ix
                                      ? {
                                          ...x,
                                          categoryValues: { ...x.categoryValues, [a.id]: e.target.value },
                                        }
                                      : x,
                                  ),
                                )
                              }
                            >
                              <option value="">— seleccionar —</option>
                              {a.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            {a.options.length <= 12 ? (
                              <div className="ae-v-attr-quickpick" role="group" aria-label={`Valores rápidos: ${a.label}`}>
                                {a.options.map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    className={
                                      "ae-v-attr-quickpick__chip" +
                                      ((v.categoryValues[a.id] ?? "") === opt ? " ae-v-attr-quickpick__chip--on" : "")
                                    }
                                    onClick={() =>
                                      setVariants((p) =>
                                        p.map((x, i) =>
                                          i === ix
                                            ? {
                                                ...x,
                                                categoryValues: { ...x.categoryValues, [a.id]: opt },
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="ae-field-hint" style={{ marginTop: 6 }}>
                                Muitas opções neste campo — use o menu acima para escolher com precisão.
                              </p>
                            )}
                          </>
                        ) : (
                          <input
                            type="text"
                            inputMode={a.inputType === "NUMBER" ? "decimal" : "text"}
                            value={v.categoryValues[a.id] ?? ""}
                            onChange={(e) =>
                              setVariants((p) =>
                                p.map((x, i) =>
                                  i === ix
                                    ? {
                                        ...x,
                                        categoryValues: { ...x.categoryValues, [a.id]: e.target.value },
                                      }
                                    : x,
                                ),
                              )
                            }
                            placeholder={a.inputType === "NUMBER" ? "Ex.: 8" : ""}
                          />
                        )}
                        {a.helpText ? <p className="ae-field-hint">{a.helpText}</p> : null}
                      </div>
                    ))}
                </div>
              ) : null}
              <div className="ae-v-prod-variant-props">
                <p className="ae-field-hint" style={{ marginBottom: 10 }}>
                  <strong>{CATALOG_TERMS.vendorFreeformTitle}</strong> — {CATALOG_TERMS.vendorFreeformHelp}
                </p>
                {(v.properties ?? []).map((prop, pi) => (
                  <div key={pi} className="ae-field-grid-2" style={{ marginBottom: 10 }}>
                    <div>
                      <label>Atributo</label>
                      <input
                        value={prop.label}
                        placeholder="Ex.: Género"
                        onChange={(e) =>
                          setVariants((p) =>
                            p.map((x, i) =>
                              i === ix
                                ? {
                                    ...x,
                                    properties: (x.properties ?? []).map((q, qi) =>
                                      qi === pi ? { ...q, label: e.target.value } : q,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                    <div>
                      <label>Valor</label>
                      <input
                        value={prop.value}
                        placeholder="Ex.: Homem"
                        onChange={(e) =>
                          setVariants((p) =>
                            p.map((x, i) =>
                              i === ix
                                ? {
                                    ...x,
                                    properties: (x.properties ?? []).map((q, qi) =>
                                      qi === pi ? { ...q, value: e.target.value } : q,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <button
                        type="button"
                        className="ae-mini-btn"
                        onClick={() =>
                          setVariants((p) =>
                            p.map((x, i) =>
                              i === ix
                                ? { ...x, properties: (x.properties ?? []).filter((_, qi) => qi !== pi) }
                                : x,
                            ),
                          )
                        }
                      >
                        Remover linha
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: 4 }}
                  onClick={() =>
                    setVariants((p) =>
                      p.map((x, i) =>
                        i === ix ? { ...x, properties: [...(x.properties ?? []), { label: "", value: "" }] } : x,
                      ),
                    )
                  }
                >
                  + Adicionar característica
                </button>
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
        ) : null}

        {categoryId.trim() && productType === "SIMPLE" && categoryAttrs.length > 0 ? (
          <section className="ae-v-prod-sec ae-panel" id="vstep-4">
            <h2 className="ae-v-prod-sec__h">04 · Características técnicas</h2>
            <button
              type="button"
              className="ae-v-prod-sec__toggle"
              aria-expanded={technicalSectionOpen}
              onClick={() => setTechnicalSectionOpen((x) => !x)}
            >
              {technicalSectionOpen ? "Recolher" : "Expandir"}
            </button>
            {technicalSectionOpen ? (
              <>
                <p className="ae-v-prod-sec__lede">
                  Preencha os atributos específicos da categoria seleccionada. Campos marcados com * são obrigatórios.
                </p>
                {categoryAttrsSorted.map((a) => (
                  <div key={a.id} style={{ marginBottom: 12 }}>
                    <label style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      <span>
                        {categoryAttrFieldLabel(a)}
                        {a.isRequired ? " *" : ""}
                      </span>
                      {a.autoSuggest ? (
                        <span className="ae-badge ae-badge--feat" style={{ fontSize: 10, fontWeight: 600 }}>
                          Sugerido
                        </span>
                      ) : null}
                    </label>
                    {a.synonyms?.length ? (
                      <p className="ae-field-hint" style={{ margin: "4px 0 6px" }}>
                        Também conhecido por: {a.synonyms.join(", ")}
                      </p>
                    ) : null}
                    {a.inputType === "SELECT" && a.options && a.options.length > 0 ? (
                      <>
                        <select
                          value={categoryValues[a.id] ?? ""}
                          onChange={(e) => setCategoryValues((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        >
                          <option value="">— seleccionar —</option>
                          {a.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        {a.options.length <= 12 ? (
                          <div className="ae-v-attr-quickpick" role="group" aria-label={`Valores rápidos: ${a.label}`}>
                            {a.options.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                className={
                                  "ae-v-attr-quickpick__chip" +
                                  ((categoryValues[a.id] ?? "") === opt ? " ae-v-attr-quickpick__chip--on" : "")
                                }
                                onClick={() => setCategoryValues((prev) => ({ ...prev, [a.id]: opt }))}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="ae-field-hint" style={{ marginTop: 6 }}>
                            Muitas opções neste campo — use o menu acima para escolher com precisão.
                          </p>
                        )}
                      </>
                    ) : (
                      <input
                        type="text"
                        inputMode={a.inputType === "NUMBER" ? "decimal" : "text"}
                        value={categoryValues[a.id] ?? ""}
                        onChange={(e) => setCategoryValues((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        placeholder={a.inputType === "NUMBER" ? "Ex.: 8" : ""}
                      />
                    )}
                    {a.helpText ? <p className="ae-field-hint">{a.helpText}</p> : null}
                  </div>
                ))}
              </>
            ) : null}
          </section>
        ) : null}

        <section className="ae-v-prod-sec ae-panel" id="vstep-5">
          <h2 className="ae-v-prod-sec__h">{productType === "VARIANT" ? "04 · Envio" : "05 · Envio"}</h2>
          <p className="ae-v-prod-sec__lede">
            Indique pelo menos uma modalidade. Por defeito, seleccione a logística operada pela plataforma (BAZAR DO
            BIÉ). Para cada expedición da plataforma pode associar uma transportadora activa já registada pelo
            administrador (o cliente vê esse nome ao escolher o envio). O
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
          {!isNew && listingMeta.isDraft ? (
            <button
              type="button"
              className="btn"
              disabled={saving || shopOk !== true}
              onClick={() => void saveDraftProgress()}
            >
              Guardar progresso (rascunho)
            </button>
          ) : null}
          <Link to="/vendor/products" className="btn">
            Fechar sem gravar
          </Link>
        </div>
      </form>
        </div>
      </div>
    </div>
  );
}
