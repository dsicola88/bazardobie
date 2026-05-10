import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { apiFetch, cartSessionHeaders, withCartSession } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { FavoriteToggle } from "../components/FavoriteToggle.js";
import { ProductReportModal } from "../components/ProductReportModal.js";
import { ProductCard, type ProductCardData } from "../components/ProductCard.js";
import { StarRating } from "../components/StarRating.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import { formatKz, formatFreteKz, formatRating } from "../utils/format.js";
import { resolveMediaUrl } from "../utils/media.js";
import { productConditionLabel } from "../utils/productCondition.js";
import { useSeo } from "../seo/useSeo.js";
import { variantEffectiveUnitKz } from "../utils/variantPrice.js";

type Img = { url: string };
type Variant = {
  id: string;
  sku: string;
  name?: string | null;
  color?: string | null;
  size?: string | null;
  stock: number;
  imageUrl?: string | null;
  salePrice?: string | null;
  priceAdjust?: string | null;
};
type Delivery = {
  id: string;
  tipoEntrega: string;
  custoEntrega: string;
  prazoEstimado: number;
  areaProvincia: string;
  areaCidade: string;
  logisticsPartner?: { id: string; name: string } | null;
};

type ProductDetail = {
  id: string;
  name: string;
  condition?: string | null;
  conditionDetail?: string | null;
  description: string;
  demoVideoUrl?: string | null;
  price: string;
  promoPrice?: string | null;
  displayPrice: string;
  soldCount: number;
  stock: number;
  averageRating?: string | null;
  reviewCount: number;
  images: Img[];
  variants: Variant[];
  deliveryOptions: Delivery[];
  shop?: {
    id: string;
    name: string;
    city: string;
    province: string;
    logoUrl?: string | null;
    credibilidade?: {
      nivel: number;
      seloVerificado: boolean;
      seloPremium: boolean;
      prioridadePesquisa: number;
      garantiasAoComprador?: {
        identidadeRevistaPelaPlataforma: boolean;
        empresaFormalmenteRevistaPelaPlataforma: boolean;
        fachadaParceiraUrl: string | null;
        textoChips: string[];
      };
    };
  };
  reviews: { rating: number; comment?: string | null; photoUrls?: string[]; user?: { name: string } }[];
  /** Contagens por estrela: [5★, 4★, 3★, 2★, 1★]; vindo da API para gráfico de barras */
  ratingDistribution?: number[];
};

type Tab = "overview" | "reviews" | "ship";

function variantLabel(v: Variant): string {
  const parts = [v.name, v.color, v.size].map((x) => (x ?? "").trim()).filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return v.sku;
}

function normSelKey(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

type ColorUiGroup = {
  colorKey: string;
  label: string;
  variants: Variant[];
  thumbnailVariant: Variant;
};

/** Duas ou mais cores distintas, todas as variantes com `color`. */
function buildColorUiGroups(variants: Variant[]): ColorUiGroup[] | null {
  if (variants.length === 0) return null;
  if (!variants.every((v) => normSelKey(v.color).length > 0)) return null;
  const byKey = new Map<string, Variant[]>();
  for (const v of variants) {
    const k = normSelKey(v.color);
    const arr = byKey.get(k) ?? [];
    arr.push(v);
    byKey.set(k, arr);
  }
  if (byKey.size < 2) return null;
  const groups: ColorUiGroup[] = [];
  for (const [, list] of byKey) {
    list.sort((a, b) => normSelKey(a.size).localeCompare(normSelKey(b.size), "pt"));
    const thumbnailVariant = list.find((x) => x.imageUrl?.trim()) ?? list[0];
    groups.push({
      colorKey: normSelKey(list[0].color),
      label: (list[0].color ?? "").trim(),
      variants: list,
      thumbnailVariant,
    });
  }
  groups.sort((a, b) => a.label.localeCompare(b.label, "pt"));
  return groups;
}

/** Várias variantes só por tamanho (sem matriz por cor). */
function buildSizeOnlyOrder(variants: Variant[]): Variant[] | null {
  if (variants.length < 2) return null;
  if (!variants.every((v) => normSelKey(v.size).length > 0)) return null;
  const keys = new Set(variants.map((v) => normSelKey(v.size)));
  if (keys.size < 2) return null;
  return [...variants].sort((a, b) => normSelKey(a.size).localeCompare(normSelKey(b.size), "pt"));
}

export default function ProductPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const { content } = useSiteContent();
  const codNote = content["public.product_cod_note"] ?? "";
  const [showReport, setShowReport] = useState(false);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [deliveryId, setDeliveryId] = useState("");
  const [mainImg, setMainImg] = useState("");
  const [adding, setAdding] = useState(false);
  const [cartFeedback, setCartFeedback] = useState<null | { ok: boolean; message: string }>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [zoomOn, setZoomOn] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [heroImgBroken, setHeroImgBroken] = useState(false);
  const seoTitle = product ? `${product.name} — BAZAR DO BIÉ` : "Produto — BAZAR DO BIÉ";
  const seoDescription = product
    ? `${product.name} com preço em Kz, envio local e compra segura no BAZAR DO BIÉ`
    : "Detalhes do produto no marketplace BAZAR DO BIÉ.";
  const seoImage = product?.images[0]?.url ? resolveMediaUrl(product.images[0].url) : undefined;

  useEffect(() => {
    if (!id) return;
    void apiFetch<ProductDetail>(`/products/${id}`)
      .then((p) => {
        setProduct(p);
        setMainImg(p.images[0]?.url ?? "");
        if (p.deliveryOptions.length) setDeliveryId(p.deliveryOptions[0].id);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Referência indisponível."));
  }, [id]);

  const viewTrackedKey = useRef<string | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductCardData[] | null>(null);

  useEffect(() => {
    if (!id) return;
    setRelatedProducts(null);
    void apiFetch<{ items: ProductCardData[] }>(`/products/${encodeURIComponent(id)}/related?take=16`)
      .then((r) => setRelatedProducts(Array.isArray(r.items) ? r.items : []))
      .catch(() => setRelatedProducts([]));
  }, [id]);

  useEffect(() => {
    if (!product?.id) return;
    const key = `${product.id}|${token ?? ""}`;
    if (viewTrackedKey.current === key) return;
    viewTrackedKey.current = key;
    void apiFetch<void>("/personalization/views", {
      ...withCartSession({
        method: "POST",
        body: JSON.stringify({ productId: product.id }),
      }),
      token: token ?? undefined,
    }).catch(() => {});
  }, [product?.id, token]);

  /** Selecção inicial de variante + `?variant=` válido (matriz Cor×Tamanho ou lista plana). */
  useEffect(() => {
    if (!product?.variants?.length) {
      setVariantId(null);
      return;
    }
    const vars = product.variants;
    if (vars.length === 1) {
      setVariantId(vars[0].stock > 0 ? vars[0].id : null);
      return;
    }
    const vq = searchParams.get("variant");
    if (vq && vars.some((v) => v.id === vq)) {
      setVariantId(vq);
      return;
    }
    const pick = vars.find((v) => v.stock > 0) ?? vars[0];
    setVariantId(pick.id);
  }, [product, searchParams]);

  const needVariant = (product?.variants.length ?? 0) > 0;
  const selectedVariant = useMemo(
    () => (needVariant ? product?.variants.find((v) => v.id === variantId) ?? null : null),
    [needVariant, product, variantId]
  );
  const seoVariant = selectedVariant ?? undefined;
  const unitPriceNum = useMemo(() => {
    if (!product) return null;
    if (needVariant && selectedVariant) {
      return variantEffectiveUnitKz(product, selectedVariant);
    }
    return Number(product.displayPrice);
  }, [needVariant, product, selectedVariant]);
  const seoJsonLd = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: product.images.map((im) => resolveMediaUrl(im.url)).slice(0, 6),
        sku: seoVariant?.sku ?? undefined,
        brand: {
          "@type": "Brand",
          name: "BAZAR DO BIÉ",
        },
        offers: {
          "@type": "Offer",
          priceCurrency: "AOA",
          price: unitPriceNum ?? Number(product.displayPrice),
          availability:
            (seoVariant?.stock ?? product.stock) > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          url: typeof window !== "undefined" ? window.location.href : "",
        },
        aggregateRating:
          product.reviewCount > 0 && product.averageRating
            ? {
                "@type": "AggregateRating",
                ratingValue: Number(product.averageRating),
                reviewCount: product.reviewCount,
              }
            : undefined,
      }
    : null;
  useSeo({
    title: seoTitle,
    description: seoDescription,
    canonicalPath: id ? `/product/${id}` : "/product",
    image: seoImage,
    jsonLd: seoJsonLd,
  });

  useEffect(() => {
    if (!product || !needVariant || !variantId) return;
    const v = product.variants.find((x) => x.id === variantId);
    if (!v) return;
    const raw = v.imageUrl?.trim() || product.images[0]?.url || "";
    if (raw) setMainImg(raw);
  }, [needVariant, product, variantId]);

  useEffect(() => {
    if (!product?.id || !needVariant) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!variantId) next.delete("variant");
        else next.set("variant", variantId);
        return next;
      },
      { replace: true }
    );
  }, [needVariant, product?.id, setSearchParams, variantId]);

  useEffect(() => {
    setHeroImgBroken(false);
  }, [id, mainImg, variantId]);

  const stockAvailable = needVariant ? selectedVariant?.stock ?? 0 : product?.stock ?? 0;
  const outOfStock = stockAvailable <= 0;
  const canAdd = product && deliveryId && (!needVariant || variantId) && !outOfStock;
  const meta = useMemo(() => product?.deliveryOptions.find((d) => d.id === deliveryId), [deliveryId, product]);

  const ratingDistribution = useMemo((): [number, number, number, number, number] => {
    if (!product) return [0, 0, 0, 0, 0];
    const raw = product.ratingDistribution;
    if (Array.isArray(raw) && raw.length === 5 && raw.every((x) => typeof x === "number")) {
      return raw as [number, number, number, number, number];
    }
    const fb: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const r of product.reviews) {
      if (r.rating >= 1 && r.rating <= 5) fb[5 - r.rating]++;
    }
    return fb;
  }, [product]);

  const mainResolved = useMemo(() => {
    if (!product) return "";
    const rawVariantFallback =
      (selectedVariant?.imageUrl ?? "").trim() ||
      product.variants.find((v) => v.imageUrl?.trim())?.imageUrl?.trim() ||
      "";
    const raw = (mainImg || "").trim() || (product.images[0]?.url ?? "").trim() || rawVariantFallback;
    return resolveMediaUrl(raw);
  }, [mainImg, product, selectedVariant]);

  const displayMainResolved = useMemo(() => {
    if (!mainResolved.trim()) return resolveMediaUrl("/demo/placeholder-product.svg");
    if (heroImgBroken) return resolveMediaUrl("/demo/placeholder-product.svg");
    return mainResolved;
  }, [heroImgBroken, mainResolved]);
  const variantGallery = useMemo(() => {
    if (!product) return [];
    return product.variants
      .map((v) => ({
        ...v,
        label: variantLabel(v),
      }))
      .filter((v, ix, arr) => arr.findIndex((x) => x.id === v.id) === ix);
  }, [product]);

  const colorUiGroups = useMemo(() => buildColorUiGroups(product?.variants ?? []), [product]);
  const colorSizeMatrix = Boolean(colorUiGroups && colorUiGroups.length >= 2);
  const sizesForSelectedColor = useMemo(() => {
    if (!colorSizeMatrix || !colorUiGroups || !selectedVariant) return [];
    const g = colorUiGroups.find((c) => c.colorKey === normSelKey(selectedVariant.color));
    return g?.variants ?? [];
  }, [colorSizeMatrix, colorUiGroups, selectedVariant]);
  const sizeOnlyOrder = useMemo(() => {
    if (colorSizeMatrix) return null;
    return buildSizeOnlyOrder(product?.variants ?? []);
  }, [product, colorSizeMatrix]);

  function pickColorGroup(colorKey: string) {
    const g = colorUiGroups?.find((c) => c.colorKey === colorKey);
    if (!g) return;
    const curInGroup = variantId && g.variants.some((v) => v.id === variantId);
    if (curInGroup) {
      const cur = g.variants.find((v) => v.id === variantId);
      if (cur && cur.stock > 0) return;
    }
    const next = g.variants.find((v) => v.stock > 0) ?? g.variants[0];
    setVariantId(next.id);
  }

  function onMainImageMove(ev: ReactMouseEvent<HTMLDivElement>) {
    const rect = ev.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((ev.clientX - rect.left) / rect.width) * 100;
    const y = ((ev.clientY - rect.top) / rect.height) * 100;
    setZoomPos({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }

  async function addToCart() {
    if (!product || !deliveryId || (needVariant && !variantId)) return;
    setAdding(true);
    setCartFeedback(null);
    try {
      await apiFetch("/cart/items", {
        method: "POST",
        headers: cartSessionHeaders(),
        token,
        body: JSON.stringify({
          productId: product.id,
          variantId: needVariant ? variantId : undefined,
          productDeliveryOptionId: deliveryId,
          quantity: qty,
        }),
      });
      window.dispatchEvent(new Event("cart-updated"));
      setCartFeedback({
        ok: true,
        message:
          qty > 1
            ? `${qty} unidades foram adicionadas ao seu carrinho. Pode rever quantidades e portes antes de pagar.`
            : "Artigo adicionado ao carrinho. O total final inclui portes por linha e será confirmado no fecho da compra.",
      });
    } catch (e: unknown) {
      setCartFeedback({
        ok: false,
        message: e instanceof Error ? e.message : "Não foi possível actualizar o carrinho. Verifique a ligação e tente novamente.",
      });
    } finally {
      setAdding(false);
    }
  }

  useEffect(() => {
    if (!cartFeedback) return;
    const ms = cartFeedback.ok ? 8000 : 12000;
    const t = window.setTimeout(() => setCartFeedback(null), ms);
    return () => window.clearTimeout(t);
  }, [cartFeedback]);

  useEffect(() => {
    if (stockAvailable <= 0) {
      setQty(1);
      return;
    }
    setQty((n) => Math.max(1, Math.min(stockAvailable, n)));
  }, [stockAvailable]);

  if (err) return <div className="page-panel" style={{ color: "#c00" }}>{err}</div>;
  if (!product) return <p className="ae-muted">A carregar ficha de produto…</p>;

  const trust = product.shop?.credibilidade;
  const guarantees = trust?.garantiasAoComprador;

  return (
    <>
      {showReport && product ? (
        <ProductReportModal
          productId={product.id}
          shopId={product.shop?.id}
          onClose={() => setShowReport(false)}
        />
      ) : null}
      <div className="ae-breadcrumb">
        <Link to="/">Início</Link>
        <span>/</span>
        <Link to="/search">Catálogo</Link>
        <span>/</span>
        <span>{product.name.slice(0, 48)}</span>
      </div>

      <div className="ae-pdp">
        <div className="ae-pdp-grid">
          <div className="ae-pdp-thumbs">
            {product.images.map((im) => (
              <button
                key={im.url}
                type="button"
                className={mainImg === im.url ? "ae-on" : ""}
                onClick={() => setMainImg(im.url)}
                onMouseEnter={() => setMainImg(im.url)}
              >
                <img src={resolveMediaUrl(im.url)} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
          <div
            className={`ae-pdp-main ${!product.demoVideoUrl ? "ae-pdp-main--zoomable" : ""} ${zoomOn ? "ae-pdp-main--zooming" : ""}`}
            onMouseMove={!product.demoVideoUrl ? onMainImageMove : undefined}
            onMouseEnter={!product.demoVideoUrl ? () => setZoomOn(true) : undefined}
            onMouseLeave={!product.demoVideoUrl ? () => setZoomOn(false) : undefined}
          >
            {product.demoVideoUrl ? (
              <video
                src={product.demoVideoUrl}
                controls
                preload="metadata"
                playsInline
                poster={displayMainResolved}
                style={{ width: "100%", borderRadius: 8, border: "1px solid var(--ae-line)", background: "#000" }}
              />
            ) : (
              <>
                <img
                  src={displayMainResolved}
                  alt=""
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  onError={() => setHeroImgBroken(true)}
                />
                <div
                  className="ae-pdp-loupe"
                  style={{ left: `${zoomPos.x}%`, top: `${zoomPos.y}%` }}
                  aria-hidden
                />
                <div
                  className="ae-pdp-zoom"
                  style={{
                    backgroundImage: `url(${JSON.stringify(displayMainResolved)})`,
                    backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                  }}
                  aria-hidden
                />
              </>
            )}
          </div>

          <div className="ae-buybox">
            <h1 className="ae-buybox__title">{product.name}</h1>
            <p className="ae-muted" style={{ fontSize: 12, margin: "0 0 6px" }}>
              Condição: <strong>{productConditionLabel(product.condition)}</strong>
            </p>
            {product.condition === "USED" && product.conditionDetail?.trim() ? (
              <p className="ae-muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
                Estado informado pelo vendedor: {product.conditionDetail.trim()}
              </p>
            ) : null}
            <div className="ae-buybox__reviews">
              {product.reviewCount > 0 && product.averageRating != null ? (
                <div className="ae-buybox__reviews-line">
                  <StarRating value={Number(product.averageRating)} tone="gold" size="lg" showValue />
                  <span>
                    {product.reviewCount.toLocaleString("pt-PT")} avaliações · {product.soldCount.toLocaleString("pt-PT")}+
                    unidades vendidas
                  </span>
                </div>
              ) : (
                <span>{product.soldCount}+ unidades vendidas · ainda sem avaliações publicadas</span>
              )}
            </div>
            <div className="ae-buybox__price">
              <span className="ae-buybox__now">
                {formatKz(unitPriceNum ?? product.displayPrice)}
              </span>
              {product.promoPrice ? (
                <span className="ae-buybox__was">{formatKz(product.price)}</span>
              ) : null}
            </div>

            <div className="ae-buybox__trust">
              <span className="ae-buybox__chip">Transacção segura</span>
              <span className="ae-buybox__chip">Pagamento à entrega (COD)</span>
              {trust?.seloPremium ? (
                <span className="ae-buybox__chip ae-buybox__chip--premium">Parceiro premium</span>
              ) : null}
              {trust?.seloVerificado && !trust?.seloPremium ? (
                <span className="ae-buybox__chip ae-buybox__chip--verified">Parceiro verificado</span>
              ) : null}
            </div>

            {product.shop ? (
              <p className="ae-muted" style={{ fontSize: 12 }}>
                Loja parceira: <strong>{product.shop.name}</strong>
                {product.shop.id ? (
                  <>
                    {" · "}
                    <Link to={`/loja/${product.shop.id}/sobre`} className="ae-linkbtn" style={{ fontSize: "inherit" }}>
                      Sobre a loja
                    </Link>
                  </>
                ) : null}
                {guarantees?.textoChips?.length ? (
                  <span className="ae-pdp-trust-inline" title={guarantees.textoChips.join(" ")}>
                    {" "}
                    · {guarantees.textoChips[0]}
                    {guarantees.textoChips.length > 1 ? " (+info na visão geral)" : ""}
                  </span>
                ) : null}
                {" · "}
                {product.shop.city}, {product.shop.province}
              </p>
            ) : null}

            {needVariant ? (
              <div className="ae-field ae-pdp-variant-field">
                <div className="ae-pdp-variant-head">
                  Variante seleccionada:{" "}
                  <strong>{selectedVariant ? variantLabel(selectedVariant) : "— escolha abaixo —"}</strong>
                </div>
                {colorSizeMatrix && colorUiGroups ? (
                  <>
                    <div className="ae-pdp-variant-head">
                      cor: <strong>{(selectedVariant?.color ?? "").trim() || "—"}</strong>
                    </div>
                    <div className="ae-variant-swatches" role="radiogroup" aria-label="Escolha a cor">
                      {colorUiGroups.map((g) => (
                        <button
                          key={g.colorKey}
                          type="button"
                          role="radio"
                          aria-checked={normSelKey(selectedVariant?.color) === g.colorKey}
                          title={`${g.label} · ${g.variants.reduce((acc, x) => acc + Math.max(0, x.stock), 0)} u. em stock (todas variantes)`}
                          className={`ae-variant-swatch ${normSelKey(selectedVariant?.color) === g.colorKey ? "ae-on" : ""}`}
                          disabled={g.variants.every((v) => v.stock <= 0)}
                          onClick={() => pickColorGroup(g.colorKey)}
                        >
                          {g.thumbnailVariant.imageUrl?.trim() ? (
                            <img
                              src={resolveMediaUrl(g.thumbnailVariant.imageUrl)}
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="ae-variant-swatch__txt">{g.label.slice(0, 3).toUpperCase()}</span>
                          )}
                        </button>
                      ))}
                    </div>
                    {sizesForSelectedColor.length > 1 ? (
                      <>
                        <div className="ae-pdp-variant-head">Tamanho · {selectedVariant?.size?.trim() ?? "—"}</div>
                        <div className="ae-variant-sizes" role="radiogroup" aria-label="Escolha o tamanho">
                          {sizesForSelectedColor.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              role="radio"
                              aria-checked={variantId === v.id}
                              title={`${variantLabel(v)} · stock ${v.stock}`}
                              className={`ae-variant-size-chip ${variantId === v.id ? "ae-on" : ""}`}
                              disabled={v.stock <= 0}
                              onClick={() => setVariantId(v.id)}
                            >
                              {(v.size ?? "").trim()}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : sizeOnlyOrder ? (
                  <>
                    <div className="ae-pdp-variant-head">Tamanho · {selectedVariant?.size?.trim() ?? "—"}</div>
                    <div className="ae-variant-sizes" role="radiogroup" aria-label="Escolha o tamanho">
                      {sizeOnlyOrder.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          role="radio"
                          aria-checked={variantId === v.id}
                          title={`${variantLabel(v)} · stock ${v.stock}`}
                          className={`ae-variant-size-chip ${variantId === v.id ? "ae-on" : ""}`}
                          disabled={v.stock <= 0}
                          onClick={() => setVariantId(v.id)}
                        >
                          {(v.size ?? "").trim()}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="ae-variant-swatches" role="radiogroup" aria-label="Escolha a variante por imagem">
                    {variantGallery.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={variantId === v.id}
                        title={`${v.label} · stock ${v.stock}`}
                        className={`ae-variant-swatch ${variantId === v.id ? "ae-on" : ""}`}
                        disabled={v.stock <= 0}
                        onClick={() => setVariantId(v.id)}
                      >
                        {v.imageUrl?.trim() ? (
                          <img src={resolveMediaUrl(v.imageUrl)} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="ae-variant-swatch__txt">{v.label.slice(0, 3).toUpperCase()}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            <p className="ae-muted" style={{ fontSize: 12, marginTop: 0 }}>
              {outOfStock ? "Sem stock disponível no momento." : `Stock disponível: ${stockAvailable} unidade(s).`}
            </p>

            <div className="ae-field">
              <label>
                Expedição — {meta?.tipoEntrega === "PLATAFORMA" ? "Operada pela plataforma" : "Operada pela loja parceira"}
                {meta?.tipoEntrega === "PLATAFORMA" && meta.logisticsPartner ? ` · ${meta.logisticsPartner.name}` : ""}
              </label>
              <select value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
                {product.deliveryOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.areaCidade}, {d.areaProvincia} · {formatFreteKz(d.custoEntrega)} · {d.prazoEstimado} dias
                    {d.tipoEntrega === "PLATAFORMA" && d.logisticsPartner
                      ? ` · ${d.logisticsPartner.name}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span className="ae-muted" style={{ fontSize: 12 }}>
                Quantidade
              </span>
              <div className="ae-buybox__qty">
                <button type="button" disabled={outOfStock} onClick={() => setQty((n) => Math.max(1, n - 1))}>
                  −
                </button>
                <input
                  disabled={outOfStock}
                  value={qty}
                  onChange={(e) => {
                    const raw = Number(e.target.value) || 1;
                    if (stockAvailable <= 0) return setQty(1);
                    setQty(Math.max(1, Math.min(stockAvailable, raw)));
                  }}
                />
                <button
                  type="button"
                  disabled={outOfStock || qty >= stockAvailable}
                  onClick={() => setQty((n) => Math.min(stockAvailable, n + 1))}
                >
                  +
                </button>
              </div>
            </div>

            {cartFeedback ? (
              <div
                className={`ae-pdp-cart-feedback ${cartFeedback.ok ? "ae-pdp-cart-feedback--ok" : "ae-pdp-cart-feedback--err"}`}
                role="status"
              >
                {cartFeedback.message}
                {cartFeedback.ok ? (
                  <>
                    {" "}
                    <Link to="/cart" className="ae-pdp-cart-feedback__link">
                      Abrir carrinho
                    </Link>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="ae-buy-actions">
              <button type="button" className="ae-btn-lg ae-btn-buy" disabled={!canAdd || adding} onClick={() => void addToCart()}>
                {adding ? "A adicionar…" : "Adicionar ao carrinho"}
              </button>
              <Link className="ae-btn-lg ae-btn-cart" to="/cart" style={{ textAlign: "center", textDecoration: "none" }}>
                Ver carrinho
              </Link>
            </div>
            <FavoriteToggle productId={product.id} variantId={variantId} needVariant={needVariant} />
            <p style={{ marginTop: 12, fontSize: 12 }}>
              <button type="button" className="ae-linkbtn" onClick={() => setShowReport(true)}>
                Reportar conteúdo
              </button>
              {user ? null : (
                <span className="ae-muted"> — requer início de sessão</span>
              )}
            </p>
            <p className="ae-muted" style={{ fontSize: 12, marginTop: 12, whiteSpace: "pre-wrap" }}>
              {codNote}
            </p>
          </div>
        </div>
      </div>

      <div className="page-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="ae-tabs">
          <button type="button" className={tab === "overview" ? "ae-on" : ""} onClick={() => setTab("overview")}>
            Visão geral
          </button>
          <button type="button" className={tab === "ship" ? "ae-on" : ""} onClick={() => setTab("ship")}>
            Envio, prazos e devoluções
          </button>
          <button type="button" className={tab === "reviews" ? "ae-on" : ""} onClick={() => setTab("reviews")}>
            Avaliações ({product.reviewCount})
          </button>
        </div>
        {tab === "overview" ? (
          <div className="ae-tab-panel">
            <div className="ae-pdp-overview">
              <div style={{ whiteSpace: "pre-wrap" }}>{product.description}</div>
              {guarantees && (guarantees.textoChips.length > 0 || guarantees.fachadaParceiraUrl) ? (
                <aside className="ae-pdp-trust-box" aria-label="Confiança no parceiro">
                  <h3 className="ae-pdp-trust-box__title">Este parceiro na BAZAR DO BIÉ</h3>
                  {guarantees.fachadaParceiraUrl ? (
                    <figure className="ae-pdp-trust-box__photo">
                      <img
                        src={resolveMediaUrl(guarantees.fachadaParceiraUrl)}
                        alt="Fachada ou actividade do parceiro, revista pela plataforma"
                        loading="lazy"
                        decoding="async"
                      />
                      <figcaption className="ae-muted">Imagem facultada pelo parceiro e aceite após revisão da equipa.</figcaption>
                    </figure>
                  ) : null}
                  {guarantees.textoChips.length > 0 ? (
                    <ul className="ae-pdp-trust-chips">
                      {guarantees.textoChips.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  ) : null}
                </aside>
              ) : null}
            </div>
          </div>
        ) : null}
        {tab === "ship" ? (
          <div className="ae-tab-panel">
            <strong>Zona abrangida pela modalidade seleccionada</strong>
            <p>
              {meta?.areaProvincia}, {meta?.areaCidade}
            </p>
            <p className="ae-muted">
              Prazo indicado: <strong>{meta?.prazoEstimado}</strong> dias úteis após confirmação da encomenda. Os prazos
              efectivos dependem da rota logística e podem variar.
            </p>
            <p className="ae-muted">
              Portes desta opção: <strong>{meta ? formatFreteKz(meta.custoEntrega) : "—"}</strong>
            </p>
            <p className="ae-muted">
              Tipo: {meta?.tipoEntrega === "PLATAFORMA" ? "Logística da plataforma BAZAR DO BIÉ" : "Logística da loja parceira"}
              {meta?.tipoEntrega === "PLATAFORMA" && meta.logisticsPartner
                ? ` · Transportadora indicada: ${meta.logisticsPartner.name}`
                : ""}
              .
            </p>
          </div>
        ) : null}
        {tab === "reviews" ? (
          <div className="ae-tab-panel">
            {product.reviewCount === 0 ? (
              <p className="ae-muted">Ainda não existem avaliações para este artigo.</p>
            ) : (
              <>
                <div className="ae-pdp-reviews-hero">
                  <div className="ae-pdp-reviews-hero__left">
                    <span className="ae-pdp-reviews-hero__avg">
                      {formatRating(Number(product.averageRating ?? 0))}
                    </span>
                    <StarRating
                      value={Number(product.averageRating ?? 0)}
                      tone="dark"
                      size="lg"
                      className="ae-pdp-reviews-hero__stars"
                    />
                    <p className="ae-pdp-reviews-hero__verified">Todas de compras verificadas na plataforma.</p>
                  </div>
                  <div className="ae-pdp-reviews-bars" aria-label="Distribuição das avaliações por estrelas">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const idx = 5 - star;
                      const count = ratingDistribution[idx] ?? 0;
                      const total = product.reviewCount;
                      const pct = total > 0 ? Math.min(100, Math.round((count / total) * 1000) / 10) : 0;
                      return (
                        <div key={star} className="ae-pdp-review-dist-row">
                          <span className="ae-pdp-review-dist-label">{star} estrelas</span>
                          <div className="ae-pdp-review-dist-track">
                            <div className="ae-pdp-review-dist-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="ae-pdp-review-dist-count">{count.toLocaleString("pt-PT")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <ul className="ae-pdp-reviews-list">
                  {product.reviews.map((r, i) => (
                    <li key={i}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 10px" }}>
                        <StarRating value={r.rating} size="sm" tone="gold" />
                        <span className="ae-muted" style={{ fontSize: 13 }}>
                          {(r.user && r.user.name) || "Comprador"}
                        </span>
                      </div>
                      <div className="ae-muted" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                        {r.comment}
                      </div>
                      {r.photoUrls && r.photoUrls.length > 0 ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                          {r.photoUrls.map((u) => (
                            <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                              <img
                                src={resolveMediaUrl(u)}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                style={{
                                  width: 72,
                                  height: 72,
                                  objectFit: "cover",
                                  borderRadius: 6,
                                  border: "1px solid var(--ae-line)",
                                }}
                              />
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : null}
      </div>

      {relatedProducts !== null && relatedProducts.length > 0 ? (
        <section className="ae-shell ae-section ae-section--catalog" style={{ marginTop: 8 }} aria-label="Artigos relacionados">
          <header className="ae-section__masthead">
            <div className="ae-section__masthead-copy">
              <h2>Semelhantes e frequência em encomendas</h2>
              <p className="ae-section__dek">
                Sugestões por categoria, loja e por artigos que costumam aparecer juntos nas mesmas encomendas confirmadas.
              </p>
            </div>
          </header>
          <div className="ae-grid">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
