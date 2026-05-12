import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { apiFetch, cartSessionHeaders, withCartSession } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { FavoriteToggle } from "../components/FavoriteToggle.js";
import { ProductReportModal } from "../components/ProductReportModal.js";
import { ProductCard, type ProductCardData } from "../components/ProductCard.js";
import { StarRating } from "../components/StarRating.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import { formatKz, formatFreteKz, formatRating, formatBusinessDaysPt } from "../utils/format.js";
import { resolveMediaUrl } from "../utils/media.js";
import { productConditionLabel } from "../utils/productCondition.js";
import { useSeo } from "../seo/useSeo.js";
import { variantCompareAtUnitKz, variantEffectiveUnitKz } from "../utils/variantPrice.js";
import {
  variantDisplayBuyerLine,
  variantPdpSpecRows,
  variantSecondaryAxisHeading,
  variantSecondaryChipLabel,
} from "../utils/variantDisplay.js";
import { ListingBadge } from "../components/ListingBadge.js";
import {
  formatReviewerDisplayName,
  formatReviewDatePt,
  helpfulReviewSentence,
  reviewerAvatarInitials,
} from "../utils/reviewDisplay.js";
import {
  addCompareId,
  COMPARE_MAX,
  getCompareIds,
  removeCompareId,
} from "../utils/compareSelection.js";
import { CATALOG_TERMS } from "../catalog/catalogTerminology.js";

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
  properties?: { label: string; value: string }[];
  variantStructuredValues?: {
    value: string;
    attribute: {
      label: string;
      sortOrder: number;
      primaryRank?: number;
      inputType?: string;
      unitCode?: string | null;
    };
  }[];
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

/** Resposta de `/shops/:id/sobre` — apenas campos usados no cartão inline da PDP. */
type ShopSobreForPdp = {
  loja: {
    id: string;
    name: string;
    province: string;
    city: string;
    logoUrl?: string | null;
    membroDesde?: string;
  };
  metricas: {
    avaliacaoAspectos: {
      produto: number | null;
      comunicacao: number | null;
      entrega: number | null;
    } | null;
    totalAvaliacoes: number;
    avaliacaoMedia: number | null;
  };
};

type ProductDetail = {
  id: string;
  name: string;
  sku?: string;
  condition?: string | null;
  conditionDetail?: string | null;
  description: string;
  demoVideoUrl?: string | null;
  price: string;
  promoPrice?: string | null;
  displayPrice: string;
  soldCount: number;
  stock: number;
  averageRating?: string | number | null;
  reviewCount: number;
  ratingTrustHintPt?: string | null;
  ratingTrustShortPt?: string | null;
  images: Img[];
  /** Selos de qualidade do anúncio (backend). */
  listingBadges?: { id: string; label: string }[];
  variants: Variant[];
  deliveryOptions: Delivery[];
  category?: { id: string; name: string } | null;
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
  reviews: {
    id?: string;
    createdAt?: string;
    rating: number;
    ratingQuality?: number | null;
    ratingSellerCommunication?: number | null;
    ratingDelivery?: number | null;
    comment?: string | null;
    photoUrls?: string[];
    helpfulCount?: number;
    viewerMarkedHelpful?: boolean;
    user?: { id?: string; name: string };
  }[];
  /** Contagens por estrela: [5★, 4★, 3★, 2★, 1★]; vindo da API para gráfico de barras */
  ratingDistribution?: number[];
};

type ReviewSortKey = "recent" | "helpful" | "rating_desc" | "rating_asc";

/** Opinião na PDP (lista pode vir do bundle do produto ou de `GET /products/:id/reviews`). */
type PdpReviewItem = ProductDetail["reviews"][number];

type Tab = "overview" | "reviews" | "ship";

const PDP_REVIEWS_PAGE_SIZE = 20;

function formatShopMemberSincePt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-AO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** Barras compactas por dimensão da opinião (produto, comunicação, entrega). */
function PdpReviewAspectBars(props: {
  quality?: number | null;
  communication?: number | null;
  delivery?: number | null;
  overall: number;
}) {
  const rows: { label: string; value: number }[] = [];
  if (props.quality != null) rows.push({ label: "Descrição e qualidade do produto", value: props.quality });
  if (props.communication != null)
    rows.push({ label: "Comunicação do vendedor", value: props.communication });
  if (props.delivery != null) rows.push({ label: "Velocidade / experiência de entrega", value: props.delivery });
  if (rows.length === 0) return null;
  return (
    <div className="ae-pdp-review-aspects" aria-label="Pontuações por dimensão">
      {rows.map((row) => (
        <div key={row.label} className="ae-pdp-review-aspect">
          <span className="ae-pdp-review-aspect__label">{row.label}</span>
          <div className="ae-pdp-review-aspect__track">
            <div className="ae-pdp-review-aspect__fill" style={{ width: `${Math.min(100, Math.max(0, row.value * 20))}%` }} />
          </div>
          <span className="ae-pdp-review-aspect__val">{row.value}<span className="ae-pdp-review-aspect__max">/5</span></span>
        </div>
      ))}
      <p className="ae-pdp-review-aspects__overall ae-muted">
        Experiência global nesta compra: <strong>{props.overall}</strong>/5
      </p>
    </div>
  );
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

function pdpMainAlt(productName: string, variant: Variant | null): string {
  const n = productName.trim();
  if (!variant) return n || "Artigo à venda";
  const vl = variantDisplayBuyerLine(variant, n);
  if (!vl || vl === n || vl === "Variante") return n;
  return `${n} — ${vl}`;
}

function PdpReviewsListSkeleton() {
  return (
    <ul className="ae-pdp-reviews-list ae-pdp-reviews-list--loading" aria-busy="true" aria-label="A carregar opiniões">
      {[0, 1, 2].map((i) => (
        <li key={i} className="ae-pdp-review-card ae-pdp-review-card--skeleton">
          <div className="ae-pdp-review-card__top">
            <div className="ae-skel ae-pdp-review-sk-avatar" aria-hidden />
            <div className="ae-pdp-review-sk-col">
              <div className="ae-skel ae-pdp-review-sk-line ae-pdp-review-sk-line--title" aria-hidden />
              <div className="ae-skel ae-pdp-review-sk-line ae-pdp-review-sk-line--short" aria-hidden />
            </div>
          </div>
          <div className="ae-skel ae-pdp-review-sk-block" aria-hidden />
          <div className="ae-skel ae-pdp-review-sk-line" aria-hidden />
          <div className="ae-skel ae-pdp-review-sk-line ae-pdp-review-sk-line--short" aria-hidden />
        </li>
      ))}
    </ul>
  );
}

function ProductPageSkeleton() {
  return (
    <div className="ae-pdp-wrap-skel" aria-busy="true" aria-label="A carregar ficha do artigo">
      <div className="ae-pdp ae-pdp--skeleton">
        <div className="ae-pdp-grid ae-pdp-grid--skeleton">
          <div className="ae-pdp-sk-side">
            <div className="ae-skel ae-pdp-sk-thumb" aria-hidden />
            <div className="ae-skel ae-pdp-sk-thumb" aria-hidden />
            <div className="ae-skel ae-pdp-sk-thumb" aria-hidden />
          </div>
          <div className="ae-skel ae-pdp-sk-hero" aria-hidden />
          <div className="ae-pdp-sk-buy">
            <div className="ae-pdp-sk-buy-col">
              <div className="ae-skel ae-pdp-sk-line ae-pdp-sk-line--title" aria-hidden />
              <div className="ae-skel ae-pdp-sk-line" aria-hidden />
              <div className="ae-skel ae-pdp-sk-line ae-pdp-sk-line--short" aria-hidden />
              <div className="ae-skel ae-pdp-sk-price" aria-hidden />
              <div className="ae-skel ae-pdp-sk-line" aria-hidden />
            </div>
            <div className="ae-pdp-sk-rail" aria-hidden>
              <div className="ae-skel ae-pdp-sk-line ae-pdp-sk-line--short" aria-hidden />
              <div className="ae-skel ae-pdp-sk-btn" aria-hidden />
            </div>
          </div>
        </div>
      </div>
      <div className="page-panel ae-pdp-sk-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="ae-pdp-sk-tabs" role="presentation">
          <span className="ae-skel ae-pdp-sk-tabpill" aria-hidden />
          <span className="ae-skel ae-pdp-sk-tabpill" aria-hidden />
          <span className="ae-skel ae-pdp-sk-tabpill" aria-hidden />
        </div>
        <div className="ae-pdp-sk-tabbody">
          <div className="ae-skel ae-pdp-sk-line ae-pdp-sk-line--title" aria-hidden />
          <div className="ae-skel ae-pdp-sk-line" aria-hidden />
          <div className="ae-skel ae-pdp-sk-line" aria-hidden />
          <div className="ae-skel ae-pdp-sk-line ae-pdp-sk-line--short" aria-hidden />
        </div>
      </div>
    </div>
  );
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [reviewSort, setReviewSort] = useState<ReviewSortKey>("recent");
  const [reviewsPhotosOnly, setReviewsPhotosOnly] = useState(false);
  const [pdpReviews, setPdpReviews] = useState<{
    loading: boolean;
    loadingMore: boolean;
    items: PdpReviewItem[];
    total: number;
    error: string | null;
  }>({ loading: false, loadingMore: false, items: [], total: 0, error: null });
  const [helpfulBusyId, setHelpfulBusyId] = useState<string | null>(null);
  const [reviewPhotoLb, setReviewPhotoLb] = useState<null | { urls: string[]; index: number }>(null);
  const [shopSobre, setShopSobre] = useState<ShopSobreForPdp | null>(null);
  const [shopSobreLoading, setShopSobreLoading] = useState(false);
  const [shopSobreFailed, setShopSobreFailed] = useState(false);
  const pdpReviewsRef = useRef(pdpReviews);
  pdpReviewsRef.current = pdpReviews;
  const mainSwipeRef = useRef<{ x: number; y: number } | null>(null);
  const lbTouchRef = useRef<{ x: number; y: number } | null>(null);
  const [compareTick, setCompareTick] = useState(0);
  const [compareNote, setCompareNote] = useState<string | null>(null);
  const seoImage = product?.images[0]?.url ? resolveMediaUrl(product.images[0].url) : undefined;

  useEffect(() => {
    const fn = () => setCompareTick((t) => t + 1);
    window.addEventListener("compare-updated", fn);
    return () => window.removeEventListener("compare-updated", fn);
  }, []);

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

  useEffect(() => {
    const shopId = product?.shop?.id;
    if (!shopId) {
      setShopSobre(null);
      setShopSobreLoading(false);
      setShopSobreFailed(false);
      return;
    }
    let cancelled = false;
    setShopSobre(null);
    setShopSobreFailed(false);
    setShopSobreLoading(true);
    void apiFetch<ShopSobreForPdp>(`/shops/${encodeURIComponent(shopId)}/sobre`)
      .then((r) => {
        if (!cancelled) {
          setShopSobre(r);
          setShopSobreFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShopSobre(null);
          setShopSobreFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setShopSobreLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product?.shop?.id]);

  useEffect(() => {
    setReviewSort("recent");
    setReviewsPhotosOnly(false);
    setPdpReviews({ loading: false, loadingMore: false, items: [], total: 0, error: null });
  }, [id]);

  const tabQs = searchParams.get("tab");
  useEffect(() => {
    if (tabQs === "reviews") setTab("reviews");
  }, [id, tabQs]);

  useEffect(() => {
    if (!id) return;
    if (!product || product.id !== id) {
      setPdpReviews({ loading: false, loadingMore: false, items: [], total: 0, error: null });
      return;
    }
    if (product.reviewCount === 0) {
      setPdpReviews({ loading: false, loadingMore: false, items: [], total: 0, error: null });
      return;
    }
    let cancelled = false;
    setPdpReviews((s) => ({ ...s, loading: true, loadingMore: false, error: null }));
    const qs = new URLSearchParams();
    qs.set("sort", reviewSort);
    if (reviewsPhotosOnly) qs.set("photosOnly", "1");
    qs.set("take", String(PDP_REVIEWS_PAGE_SIZE));
    qs.set("skip", "0");
    void apiFetch<{ items: PdpReviewItem[]; total: number }>(
      `/products/${encodeURIComponent(id)}/reviews?${qs.toString()}`,
      { token: token ?? undefined },
    )
      .then((r) => {
        if (cancelled) return;
        setPdpReviews({
          loading: false,
          loadingMore: false,
          items: Array.isArray(r.items) ? r.items : [],
          total: typeof r.total === "number" ? r.total : 0,
          error: null,
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setPdpReviews({
          loading: false,
          loadingMore: false,
          items: product.reviews as PdpReviewItem[],
          total: product.reviewCount,
          error: e instanceof Error ? e.message : "Não foi possível actualizar a lista de opiniões.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id, product?.id, product?.reviewCount, reviewSort, reviewsPhotosOnly, token]);

  const markReviewHelpful = useCallback(
    async (reviewId: string) => {
      if (!token || !reviewId) return;
      setHelpfulBusyId(reviewId);
      try {
        const data = await apiFetch<{ helpfulCount: number; marked: boolean }>(
          `/reviews/${encodeURIComponent(reviewId)}/helpful`,
          { method: "POST", token },
        );
        setPdpReviews((s) => ({
          ...s,
          items: s.items.map((it) =>
            it.id === reviewId
              ? { ...it, helpfulCount: data.helpfulCount, viewerMarkedHelpful: data.marked }
              : it,
          ),
        }));
      } finally {
        setHelpfulBusyId(null);
      }
    },
    [token],
  );

  const loadMoreReviews = useCallback(async () => {
    if (!id || !product || product.id !== id) return;
    const s = pdpReviewsRef.current;
    if (s.loading || s.loadingMore || s.items.length >= s.total) return;
    const skip = s.items.length;
    setPdpReviews((prev) => ({ ...prev, loadingMore: true }));
    try {
      const qs = new URLSearchParams();
      qs.set("sort", reviewSort);
      if (reviewsPhotosOnly) qs.set("photosOnly", "1");
      qs.set("take", String(PDP_REVIEWS_PAGE_SIZE));
      qs.set("skip", String(skip));
      const r = await apiFetch<{ items: PdpReviewItem[] }>(
        `/products/${encodeURIComponent(id)}/reviews?${qs.toString()}`,
        { token: token ?? undefined },
      );
      const chunk = Array.isArray(r.items) ? r.items : [];
      setPdpReviews((prev) => {
        const seen = new Set(prev.items.map((x) => x.id).filter(Boolean));
        const merged = [...prev.items];
        for (const it of chunk) {
          if (it.id) {
            if (seen.has(it.id)) continue;
            seen.add(it.id);
          }
          merged.push(it);
        }
        return { ...prev, loadingMore: false, items: merged };
      });
    } catch {
      setPdpReviews((prev) => ({ ...prev, loadingMore: false }));
    }
  }, [id, product?.id, reviewSort, reviewsPhotosOnly, token]);

  const handlePdpTab = useCallback(
    (next: Tab) => {
      setTab(next);
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (next === "reviews") n.set("tab", "reviews");
          else n.delete("tab");
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const scrollToReviewsPanel = useCallback(() => {
    window.requestAnimationFrame(() => {
      document.getElementById("ae-pdp-panel-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const openAllReviews = useCallback(() => {
    handlePdpTab("reviews");
    scrollToReviewsPanel();
  }, [handlePdpTab, scrollToReviewsPanel]);

  useEffect(() => {
    if (!reviewPhotoLb) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setReviewPhotoLb(null);
      if (e.key === "ArrowLeft") {
        setReviewPhotoLb((cur) =>
          cur && cur.urls.length > 1
            ? { ...cur, index: (cur.index - 1 + cur.urls.length) % cur.urls.length }
            : cur,
        );
      }
      if (e.key === "ArrowRight") {
        setReviewPhotoLb((cur) =>
          cur && cur.urls.length > 1
            ? { ...cur, index: (cur.index + 1) % cur.urls.length }
            : cur,
        );
      }
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [reviewPhotoLb]);

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
  const unitPriceNum = useMemo(() => {
    if (!product) return null;
    if (needVariant && selectedVariant) {
      return variantEffectiveUnitKz(product, selectedVariant);
    }
    return Number(product.displayPrice);
  }, [needVariant, product, selectedVariant]);

  const compareAtUnit = useMemo(() => {
    if (!product) return null;
    return variantCompareAtUnitKz(product, needVariant ? selectedVariant ?? undefined : undefined);
  }, [product, needVariant, selectedVariant]);

  const inCompare = useMemo(
    () => !!(product && getCompareIds().includes(product.id)),
    [product, compareTick],
  );

  const toggleCompare = useCallback(() => {
    if (!product) return;
    if (getCompareIds().includes(product.id)) {
      removeCompareId(product.id);
      setCompareNote("Removido da comparação.");
    } else {
      const r = addCompareId(product.id);
      if (r === "full") {
        setCompareNote(`O comparador aceita no máximo ${COMPARE_MAX} artigos.`);
      } else {
        setCompareNote("Adicionado ao comparador. Abra-o pelo ícone na barra superior.");
      }
    }
    window.setTimeout(() => setCompareNote(null), 3400);
  }, [product]);

  const mainImageAlt = useMemo(
    () => (product ? pdpMainAlt(product.name, selectedVariant) : "Artigo"),
    [product, selectedVariant],
  );

  const goLightbox = useCallback((dir: -1 | 1) => {
    if (!product?.images?.length) return;
    const n = product.images.length;
    if (n < 2) return;
    setLightboxIndex((prev) => {
      const next = (prev + dir + n) % n;
      setMainImg(product.images[next].url);
      return next;
    });
  }, [product]);

  const openLightbox = useCallback(() => {
    if (!product?.images?.length) return;
    const idx = product.images.findIndex((im) => im.url === mainImg);
    if (idx >= 0) {
      setLightboxIndex(idx);
    } else {
      setLightboxIndex(0);
      setMainImg(product.images[0].url);
    }
    setLightboxOpen(true);
  }, [product, mainImg]);

  const lightboxResolved = useMemo(() => {
    if (!product?.images?.length) return "";
    const raw = product.images[lightboxIndex]?.url ?? "";
    return raw ? resolveMediaUrl(raw) : "";
  }, [product, lightboxIndex]);

  const lightboxAlt = useMemo(() => {
    if (!product?.images?.length) return mainImageAlt;
    return `${mainImageAlt} — fotografia ${lightboxIndex + 1} de ${product.images.length}`;
  }, [product, lightboxIndex, mainImageAlt]);

  const { seoTitle, seoDescription, seoJsonLd } = useMemo(() => {
    if (!product) {
      return {
        seoTitle: "Produto — BAZAR DO BIÉ",
        seoDescription: "Detalhes do produto no marketplace BAZAR DO BIÉ.",
        seoJsonLd: null as Record<string, unknown> | null,
      };
    }
    const cat = product.category?.name?.trim();
    const seoTitleResolved =
      cat && cat.length > 0
        ? `${product.name} · ${cat} | BAZAR DO BIÉ`
        : `${product.name} | BAZAR DO BIÉ`;
    const vForMeta = selectedVariant ?? product.variants[0];
    const specBits =
      vForMeta != null
        ? variantPdpSpecRows(vForMeta, product.name)
            .slice(0, 4)
            .map((r) => `${r.label}: ${r.value}`)
        : [];
    const priceStr = formatKz(unitPriceNum ?? Number(product.displayPrice));
    const parts: string[] = [
      `${product.name}. ${priceStr} em Kz.`,
      ...(cat ? [`Categoria: ${cat}.`] : []),
      ...(specBits.length ? [specBits.join(" ")] : []),
      "Compra segura no BAZAR DO BIÉ.",
    ];
    let seoDescriptionResolved = parts.join(" ");
    const MAX = 158;
    if (seoDescriptionResolved.length > MAX) {
      seoDescriptionResolved = seoDescriptionResolved.slice(0, MAX - 1).trimEnd() + "…";
    }
    const specRowsFull = vForMeta != null ? variantPdpSpecRows(vForMeta, product.name) : [];
    const additionalProperty =
      specRowsFull.length > 0
        ? specRowsFull.slice(0, 24).map((r) => ({
            "@type": "PropertyValue",
            name: r.label,
            value: r.value,
          }))
        : undefined;
    const plainDesc = (product.description ?? "").trim().slice(0, 800) || seoDescriptionResolved;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: plainDesc,
      image: product.images.map((im) => resolveMediaUrl(im.url)).slice(0, 6),
        sku: (selectedVariant ?? undefined)?.sku || product.sku || undefined,
      category: cat || undefined,
      brand: {
        "@type": "Brand",
        name: "BAZAR DO BIÉ",
      },
      ...(additionalProperty ? { additionalProperty } : {}),
      offers: {
        "@type": "Offer",
        priceCurrency: "AOA",
        price: unitPriceNum ?? Number(product.displayPrice),
        availability:
          ((selectedVariant ?? undefined)?.stock ?? product.stock) > 0
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
    };
    return { seoTitle: seoTitleResolved, seoDescription: seoDescriptionResolved, seoJsonLd: jsonLd };
  }, [product, selectedVariant, unitPriceNum]);

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
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLightboxOpen(false);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goLightbox(-1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goLightbox(1);
      }
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen, goLightbox]);

  useEffect(() => {
    setLightboxOpen(false);
    setLightboxIndex(0);
  }, [id]);

  useEffect(() => {
    if (!lightboxOpen || !product?.images?.length) return;
    const idx = product.images.findIndex((im) => im.url === mainImg);
    if (idx >= 0) setLightboxIndex(idx);
  }, [lightboxOpen, mainImg, product]);

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

  const reviewRows = useMemo(() => {
    if (!product || product.reviewCount === 0) return [];
    if (
      pdpReviews.loading &&
      reviewSort === "recent" &&
      !reviewsPhotosOnly &&
      product.reviews.length > 0
    ) {
      return product.reviews as PdpReviewItem[];
    }
    return pdpReviews.items;
  }, [product, pdpReviews.loading, pdpReviews.items, reviewSort, reviewsPhotosOnly]);

  const reviewsFilterEmpty =
    Boolean(product && product.reviewCount > 0) &&
    !pdpReviews.loading &&
    reviewsPhotosOnly &&
    pdpReviews.total === 0;

  const reviewsListTotalShown =
    pdpReviews.loading && reviewSort === "recent" && !reviewsPhotosOnly
      ? (product?.reviewCount ?? 0)
      : pdpReviews.total;

  const reviewsHasMore =
    !reviewsFilterEmpty &&
    !pdpReviews.loading &&
    !pdpReviews.loadingMore &&
    pdpReviews.items.length < pdpReviews.total;

  const reviewsRemaining = Math.max(0, pdpReviews.total - pdpReviews.items.length);

  const showReviewsSkeleton =
    pdpReviews.loading &&
    reviewRows.length === 0 &&
    !(reviewSort === "recent" && !reviewsPhotosOnly && (product?.reviews.length ?? 0) > 0);

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
    const pname = product.name.trim();
    return product.variants
      .map((v) => ({
        ...v,
        label: variantDisplayBuyerLine(v, pname),
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

  const canMainGallerySwipe =
    Boolean(product && product.images.length >= 2 && !product.demoVideoUrl);

  function onMainTouchStart(ev: ReactTouchEvent<HTMLDivElement>) {
    if (!canMainGallerySwipe) return;
    const t = ev.touches[0];
    if (t) mainSwipeRef.current = { x: t.clientX, y: t.clientY };
  }

  function onMainTouchEnd(ev: ReactTouchEvent<HTMLDivElement>) {
    if (!canMainGallerySwipe || !product) {
      mainSwipeRef.current = null;
      return;
    }
    const start = mainSwipeRef.current;
    mainSwipeRef.current = null;
    if (!start) return;
    const t = ev.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    const urls = product.images.map((im) => im.url);
    const idx = urls.indexOf(mainImg);
    const cur = idx >= 0 ? idx : 0;
    const next = dx < 0 ? cur + 1 : cur - 1;
    const j = ((next % urls.length) + urls.length) % urls.length;
    setMainImg(urls[j]);
  }

  function onLbTouchStart(ev: ReactTouchEvent<HTMLDivElement>) {
    if (!product || product.images.length < 2) return;
    const t = ev.touches[0];
    if (t) lbTouchRef.current = { x: t.clientX, y: t.clientY };
  }

  function onLbTouchEnd(ev: ReactTouchEvent<HTMLDivElement>) {
    if (!product || product.images.length < 2) {
      lbTouchRef.current = null;
      return;
    }
    const start = lbTouchRef.current;
    lbTouchRef.current = null;
    if (!start) return;
    const t = ev.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    goLightbox(dx < 0 ? 1 : -1);
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

  if (err)
    return (
      <div className="page-panel" role="alert" style={{ color: "#c00" }}>
        {err}
      </div>
    );
  if (!product)
    return (
      <>
        <div className="ae-breadcrumb ae-breadcrumb--muted">
          <span className="ae-muted">Início</span>
          <span>/</span>
          <span className="ae-muted">Catálogo</span>
          <span>/</span>
          <span className="ae-muted">A carregar…</span>
        </div>
        <ProductPageSkeleton />
      </>
    );

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
        <span aria-hidden>/</span>
        <Link to="/search">Catálogo</Link>
        {product.category?.id ? (
          <>
            <span aria-hidden>/</span>
            <Link to={`/search?categoryId=${encodeURIComponent(product.category.id)}`}>{product.category.name}</Link>
          </>
        ) : null}
        <span aria-hidden>/</span>
        <span aria-current="page">{product.name.length > 56 ? `${product.name.slice(0, 56)}…` : product.name}</span>
      </div>

      <div className="ae-pdp">
        <div className="ae-pdp-grid">
          <div className="ae-pdp-thumbs">
            {product.images.map((im, ix) => (
              <button
                key={im.url}
                type="button"
                className={mainImg === im.url ? "ae-on" : ""}
                aria-label={`Miniatura ${ix + 1} de ${product.images.length}: ${product.name}`}
                aria-pressed={mainImg === im.url}
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
            onTouchStart={canMainGallerySwipe ? onMainTouchStart : undefined}
            onTouchEnd={canMainGallerySwipe ? onMainTouchEnd : undefined}
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
                {!product.demoVideoUrl ? (
                  <button
                    type="button"
                    className="ae-pdp-expand"
                    aria-label="Ampliar fotografia em ecrã inteiro"
                    onClick={() => openLightbox()}
                  >
                    <span className="ae-pdp-expand__ico" aria-hidden>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" d="M9 3H5a2 2 0 0 0-2 2v4m10 12h4a2 2 0 0 0 2-2v-4M3 9v6a2 2 0 0 0 2 2h2M21 9V5a2 2 0 0 0-2-2h-4" />
                      </svg>
                    </span>
                    Ampliar
                  </button>
                ) : null}
                <img
                  src={displayMainResolved}
                  alt={mainImageAlt}
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
            <div className="ae-pdp-buy-columns">
              <div className="ae-pdp-detail-col">
                <div className="ae-pdp-title-row">
                  {trust?.seloPremium ? (
                    <span className="ae-pdp-title-badge">Parceiro premium</span>
                  ) : trust?.seloVerificado ? (
                    <span className="ae-pdp-title-badge ae-pdp-title-badge--muted">Parceiro verificado</span>
                  ) : null}
                  <h1 className="ae-buybox__title">{product.name}</h1>
                </div>
                {product.listingBadges?.length ? (
                  <div className="ae-pdp-listing-badges" aria-label="Selos de qualidade do anúncio">
                    {product.listingBadges.map((b) => (
                      <ListingBadge key={b.id} badge={b} />
                    ))}
                  </div>
                ) : null}
            <p className="ae-buybox__sku" aria-label="Referência do artigo">
              Referência:{" "}
              <strong>{needVariant && selectedVariant ? selectedVariant.sku : product.sku ?? "—"}</strong>
              {needVariant && selectedVariant && product.sku && selectedVariant.sku !== product.sku ? (
                <span className="ae-muted"> · modelo {product.sku}</span>
              ) : null}
            </p>
            <p className="ae-muted" style={{ fontSize: 12, margin: "0 0 6px" }}>
              Condição: <strong>{productConditionLabel(product.condition)}</strong>
            </p>
            {product.condition === "USED" && product.conditionDetail?.trim() ? (
              <p className="ae-muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
                Estado informado pelo vendedor: {product.conditionDetail.trim()}
              </p>
            ) : null}
            <div className="ae-pdp-buy-rail">
              <div className="ae-pdp-buy-rail__main" role="group" aria-label="Classificação e vendas do artigo">
                {product.averageRating != null && product.reviewCount > 0 ? (
                  <>
                    <StarRating
                      value={Number(product.averageRating)}
                      tone="gold"
                      size="md"
                      showValue
                      className="ae-pdp-buy-rail__rating"
                    />
                    <span className="ae-pdp-buy-rail__reviews">
                      {product.reviewCount.toLocaleString("pt-PT")}{" "}
                      {product.reviewCount === 1 ? "Avaliação" : "Avaliações"}
                    </span>
                    <span className="ae-pdp-buy-rail__sep" aria-hidden="true">
                      |
                    </span>
                    <span className="ae-pdp-buy-rail__sold">
                      {product.soldCount.toLocaleString("pt-PT")} vendido
                      {product.soldCount === 1 ? "" : "(s)"}
                    </span>
                  </>
                ) : product.reviewCount > 0 ? (
                  <>
                    <span className="ae-pdp-buy-rail__pending-mark" aria-hidden>
                      ★
                    </span>
                    <span className="ae-pdp-buy-rail__pending-text">
                      <strong>{product.reviewCount.toLocaleString("pt-PT")}</strong>{" "}
                      {product.reviewCount === 1 ? "avaliação verificada" : "avaliações verificadas"} ·{" "}
                      <span className="ae-muted">
                        {product.ratingTrustShortPt ?? "Ainda sem avaliações suficientes"}
                      </span>
                    </span>
                    <span className="ae-pdp-buy-rail__sep" aria-hidden="true">
                      |
                    </span>
                    <span className="ae-pdp-buy-rail__sold">
                      {product.soldCount > 0 ? (
                        <>
                          {product.soldCount.toLocaleString("pt-PT")} vendido
                          {product.soldCount === 1 ? "" : "(s)"}
                        </>
                      ) : (
                        <span className="ae-muted">0 vendido(s)</span>
                      )}
                    </span>
                  </>
                ) : product.soldCount > 0 ? (
                  <>
                    <span className="ae-muted">Sem avaliações públicas</span>
                    <span className="ae-pdp-buy-rail__sep" aria-hidden="true">
                      |
                    </span>
                    <span className="ae-pdp-buy-rail__sold">
                      {product.soldCount.toLocaleString("pt-PT")} vendido
                      {product.soldCount === 1 ? "" : "(s)"}
                    </span>
                  </>
                ) : (
                  <span className="ae-muted ae-pdp-buy-rail__empty">Sem avaliações · sem vendas registadas</span>
                )}
              </div>
              {product.reviewCount > 0 ? (
                <div className="ae-pdp-buy-rail__cta">
                  <button type="button" className="ae-linkbtn" onClick={openAllReviews}>
                    Ver todas as opiniões e filtros ↓
                  </button>
                </div>
              ) : null}
              {product.reviewCount > 0 && product.averageRating == null && product.ratingTrustHintPt ? (
                <p className="ae-pdp-buy-rail__micro ae-muted">{product.ratingTrustHintPt}</p>
              ) : null}
            </div>
            <div className="ae-pdp-price-deal">
              <p className="ae-pdp-price-deal__head">Preço em destaque</p>
              <div className="ae-pdp-price-deal__body">
                <span className="ae-buybox__now">{formatKz(unitPriceNum ?? product.displayPrice)}</span>
                {compareAtUnit != null && compareAtUnit > Number(unitPriceNum ?? product.displayPrice) ? (
                  <>
                    <span className="ae-pdp-price-deal__promo">Preço promocional</span>
                    <span className="ae-buybox__was">{formatKz(compareAtUnit)}</span>
                  </>
                ) : null}
              </div>
              <p className="ae-pdp-price-deal__fine">
                Valores em Kwanzas angolanos (Kz). Impostos aplicáveis segundo a legislação em vigor.
              </p>
            </div>

            <div className="ae-buybox__trust">
              <span className="ae-buybox__chip">Transação segura na plataforma</span>
              <span className="ae-buybox__chip">Pagamento na entrega (COD)</span>
              {trust?.seloPremium ? null : trust?.seloVerificado ? (
                <span className="ae-buybox__chip ae-buybox__chip--verified">Parceiro verificado</span>
              ) : null}
            </div>

            {product.shop ? (
              <div className="ae-buybox__marketplace">
                <Link className="ae-buybox__marketplace-store" to={`/loja/${encodeURIComponent(product.shop.id)}`}>
                  Loja <span className="ae-buybox__marketplace-name">{product.shop.name.trim()}</span>
                </Link>
                <p className="ae-buybox__marketplace-note">
                  Encomenda com seguimento no Bazar do Bié — mesmo vendedor, processo único na plataforma.
                </p>
              </div>
            ) : null}

            {needVariant ? (
              <div className="ae-field ae-pdp-variant-field">
                <div className="ae-pdp-variant-head">
                  Variante seleccionada:{" "}
                  <strong>
                    {selectedVariant ? variantDisplayBuyerLine(selectedVariant, product.name) : "— escolha abaixo —"}
                  </strong>
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
                              alt={`Cor ${g.label}`}
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
                        <div className="ae-pdp-variant-head">
                          <strong>{variantSecondaryAxisHeading(sizesForSelectedColor)}</strong>
                          {": "}
                          <strong>
                            {selectedVariant
                              ? variantSecondaryChipLabel(selectedVariant, product.name)
                              : "—"}
                          </strong>
                        </div>
                        <div
                          className="ae-variant-sizes"
                          role="radiogroup"
                          aria-label={`Escolha ${variantSecondaryAxisHeading(sizesForSelectedColor).toLowerCase()}`}
                        >
                          {sizesForSelectedColor.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              role="radio"
                              aria-checked={variantId === v.id}
                              title={`${variantDisplayBuyerLine(v, product.name)} · stock ${v.stock}`}
                              className={`ae-variant-size-chip ${variantId === v.id ? "ae-on" : ""}`}
                              disabled={v.stock <= 0}
                              onClick={() => setVariantId(v.id)}
                            >
                              {variantSecondaryChipLabel(v, product.name)}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : sizeOnlyOrder ? (
                  <>
                    <div className="ae-pdp-variant-head">
                      <strong>{variantSecondaryAxisHeading(sizeOnlyOrder)}</strong>
                      {": "}
                      <strong>
                        {selectedVariant ? variantSecondaryChipLabel(selectedVariant, product.name) : "—"}
                      </strong>
                    </div>
                    <div
                      className="ae-variant-sizes"
                      role="radiogroup"
                      aria-label={`Escolha ${variantSecondaryAxisHeading(sizeOnlyOrder).toLowerCase()}`}
                    >
                      {sizeOnlyOrder.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          role="radio"
                          aria-checked={variantId === v.id}
                          title={`${variantDisplayBuyerLine(v, product.name)} · stock ${v.stock}`}
                          className={`ae-variant-size-chip ${variantId === v.id ? "ae-on" : ""}`}
                          disabled={v.stock <= 0}
                          onClick={() => setVariantId(v.id)}
                        >
                          {variantSecondaryChipLabel(v, product.name)}
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
                          <img src={resolveMediaUrl(v.imageUrl)} alt={`Variante ${v.label}`} loading="lazy" decoding="async" />
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
              {outOfStock
                ? "Sem stock disponível no momento."
                : `Stock disponível: ${stockAvailable} ${stockAvailable === 1 ? "unidade" : "unidades"}.`}
            </p>
            {needVariant && selectedVariant ? (() => {
              const rows = variantPdpSpecRows(selectedVariant, product.name);
              if (rows.length === 0) return null;
              return (
                <section className="ae-pdp-specs" aria-label={CATALOG_TERMS.techSpecsAriaVariant}>
                  <h3 className="ae-pdp-specs__h">{CATALOG_TERMS.techSpecsHeading}</h3>
                  <div className="ae-pdp-specs__grid">
                    {rows.map((row) => (
                      <div key={`${row.label}-${row.value}`} className="ae-pdp-specs__row">
                        <span className="ae-pdp-specs__dt">{row.label}</span>
                        <span className="ae-pdp-specs__dd">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })() : null}
              </div>

              <aside className="ae-pdp-purchase-rail ae-pdp-rail" aria-label="Compra e envio">
                {product.shop ? (
                  <>
                    <section className="ae-pdp-rail-vendor" aria-labelledby="ae-pdp-rail-vendor-heading">
                      <p id="ae-pdp-rail-vendor-heading" className="ae-pdp-rail-kicker">
                        Vendido por
                      </p>
                      <div className="ae-pdp-rail-vendor__row">
                        {(() => {
                          const rawLogo = (shopSobre?.loja.logoUrl ?? product.shop.logoUrl) ?? "";
                          const logoSrc = rawLogo.trim() ? resolveMediaUrl(rawLogo) : "";
                          return logoSrc.trim() ? (
                            <img
                              className="ae-pdp-rail-vendor__logo"
                              src={logoSrc}
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="ae-pdp-rail-vendor__logo ae-pdp-rail-vendor__logo--placeholder" aria-hidden>
                              {product.shop.name.trim().slice(0, 1).toUpperCase() || "?"}
                            </div>
                          );
                        })()}
                        <div>
                          <p className="ae-pdp-rail-vendor__name">{product.shop.name}</p>
                          <p className="ae-muted ae-pdp-rail-vendor__loc">
                            {product.shop.city}, {product.shop.province}
                            {shopSobre?.loja.membroDesde ? (
                              <> · Na plataforma desde {formatShopMemberSincePt(shopSobre.loja.membroDesde)}</>
                            ) : shopSobreLoading ? (
                              <> · <span className="ae-muted">a carregar histórico…</span></>
                            ) : null}
                          </p>
                          {shopSobreLoading ? (
                            <p className="ae-muted ae-pdp-rail-vendor__rating">A carregar avaliações da loja…</p>
                          ) : shopSobreFailed ? null : shopSobre &&
                            shopSobre.metricas.totalAvaliacoes > 0 &&
                            shopSobre.metricas.avaliacaoMedia != null ? (
                            <div className="ae-pdp-rail-vendor__rating">
                              <StarRating
                                value={Number(shopSobre.metricas.avaliacaoMedia)}
                                tone="gold"
                                size="sm"
                                showValue
                                reviewCount={shopSobre.metricas.totalAvaliacoes}
                              />
                            </div>
                          ) : null}
                          <Link
                            className="ae-linkbtn ae-pdp-rail-vendor__link"
                            to={`/loja/${encodeURIComponent(product.shop.id)}`}
                          >
                            Ver página da loja
                          </Link>
                          {guarantees?.textoChips?.length ? (
                            <p className="ae-pdp-rail-trust-line">{guarantees.textoChips.join(" · ")}</p>
                          ) : null}
                        </div>
                      </div>
                    </section>
                    <hr className="ae-pdp-rail-divider" />
                  </>
                ) : null}

                <div className="ae-pdp-rail-ship">
                  <span className="ae-pdp-rail-ship__ico" aria-hidden>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" strokeLinejoin="round" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  </span>
                  <span>
                    {meta ? (
                      <>
                        <span className="ae-pdp-rail-ship__meta">{formatFreteKz(meta.custoEntrega)}</span>
                        {" · "}
                        <span className="ae-muted">Prazo: {formatBusinessDaysPt(meta.prazoEstimado)}</span>
                        {meta.tipoEntrega === "PLATAFORMA" && meta.logisticsPartner ? (
                          <span className="ae-muted"> · {meta.logisticsPartner.name}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="ae-muted">Seleccione uma opção de envio abaixo.</span>
                    )}
                  </span>
                </div>

                <div className="ae-pdp-rail-policies">
                  <button
                    type="button"
                    className="ae-linkbtn"
                    onClick={() => {
                      handlePdpTab("ship");
                      scrollToReviewsPanel();
                    }}
                  >
                    Envio, devoluções e reembolsos
                  </button>
                  <button
                    type="button"
                    className="ae-linkbtn"
                    onClick={() => {
                      handlePdpTab("overview");
                      scrollToReviewsPanel();
                    }}
                  >
                    Confiança na loja e na plataforma
                  </button>
                </div>

            <div className="ae-field">
              <label>
                Expedição — {meta?.tipoEntrega === "PLATAFORMA" ? "Operada pela plataforma" : "Operada pela loja parceira"}
                {meta?.tipoEntrega === "PLATAFORMA" && meta.logisticsPartner ? ` · ${meta.logisticsPartner.name}` : ""}
              </label>
              <select value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
                {product.deliveryOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.areaCidade}, {d.areaProvincia} · {formatFreteKz(d.custoEntrega)} ·{" "}
                    {formatBusinessDaysPt(d.prazoEstimado)}
                    {d.tipoEntrega === "PLATAFORMA" && d.logisticsPartner
                      ? ` · ${d.logisticsPartner.name}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="ae-buybox__qty-row">
              <span className="ae-buybox__qty-label ae-muted">Quantidade</span>
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
            {!outOfStock && stockAvailable > 0 ? (
              <p className="ae-buybox__qty-note ae-muted">
                Limite de {stockAvailable} {stockAvailable === 1 ? "unidade" : "unidades"} por encomenda (stock disponível).
              </p>
            ) : null}

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
                {adding ? "A adicionar à sua seleção…" : "Adicionar à minha seleção"}
              </button>
              <Link className="ae-btn-lg ae-btn-cart" to="/cart">
                Ver carrinho
              </Link>
            </div>
            <div className="ae-pdp-rail__extras">
              <div className="ae-pdp-compare-row">
                <button type="button" className="ae-btn-subtle" onClick={() => toggleCompare()}>
                  {inCompare ? "Retirar da comparação" : "Adicionar à comparação"}
                </button>
                <Link to="/compare" className="ae-linkbtn">
                  Abrir comparador
                </Link>
              </div>
              {compareNote ? (
                <p className="ae-muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
                  {compareNote}
                </p>
              ) : null}
              <FavoriteToggle productId={product.id} variantId={variantId} needVariant={needVariant} />
              <p style={{ margin: 0, fontSize: 12 }}>
                <button type="button" className="ae-linkbtn" onClick={() => setShowReport(true)}>
                  Reportar conteúdo
                </button>
                {user ? null : (
                  <span className="ae-muted"> — requer início de sessão</span>
                )}
              </p>
            </div>
            <p className="ae-muted" style={{ fontSize: 12, marginTop: 12, whiteSpace: "pre-wrap" }}>
              {codNote}
            </p>
              </aside>
            </div>
          </div>
        </div>
      </div>

      <div className="page-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="ae-tabs" id="ae-pdp-panel-tabs">
          <button type="button" className={tab === "overview" ? "ae-on" : ""} onClick={() => handlePdpTab("overview")}>
            Visão geral
          </button>
          <button type="button" className={tab === "ship" ? "ae-on" : ""} onClick={() => handlePdpTab("ship")}>
            Envio, prazos e devoluções
          </button>
          <button type="button" className={tab === "reviews" ? "ae-on" : ""} onClick={() => handlePdpTab("reviews")}>
            Opiniões de clientes ({product.reviewCount})
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
              Prazo indicado: <strong>{meta ? formatBusinessDaysPt(meta.prazoEstimado) : "—"}</strong> após confirmação da
              encomenda. Os prazos efectivos dependem da rota logística e podem variar.
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
          <div className="ae-tab-panel ae-tab-panel--reviews">
            {product.reviewCount === 0 ? (
              <div className="ae-pdp-reviews-empty">
                <h3 className="ae-pdp-reviews-empty__title">Sem opiniões de clientes</h3>
                <p className="ae-pdp-reviews-empty__lead">
                  Este artigo ainda não recebeu classificações públicas após entregas concluídas.
                </p>
                <p className="ae-pdp-reviews-empty__hint ae-muted">
                  No BAZAR DO BIÉ só quem comprou e recebeu a encomenda no estado «Entregue» pode opinar — isto mantém o
                  sistema mais fiável e menos suscetível a manipulação.
                </p>
              </div>
            ) : (
              <>
                <header className="ae-pdp-reviews-page-head">
                  <h2 className="ae-pdp-reviews-page-head__title">Opiniões de clientes</h2>
                  <p className="ae-pdp-reviews-page-head__sub ae-muted">
                    Só clientes com encomenda deste artigo no estado «Entregue» podem publicar opinião verificada.
                  </p>
                </header>
                <div className="ae-pdp-reviews-hero">
                  <div className="ae-pdp-reviews-hero__left">
                    {product.averageRating != null ? (
                      <>
                        <span className="ae-pdp-reviews-hero__avg ae-pdp-reviews-hero__avg--neutral">
                          {formatRating(Number(product.averageRating))}
                        </span>
                        <StarRating
                          value={Number(product.averageRating)}
                          tone="dark"
                          size="lg"
                          className="ae-pdp-reviews-hero__stars"
                          showValue={false}
                        />
                        <p className="ae-pdp-reviews-hero__meta ae-muted">
                          de 5 estrelas ·{" "}
                          <strong>{product.reviewCount.toLocaleString("pt-PT")}</strong>{" "}
                          {product.reviewCount === 1 ? "opinião global" : "opiniões globais"}
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="ae-pdp-reviews-hero__pending">—</span>
                        <p className="ae-pdp-reviews-hero__pending-copy ae-muted">
                          {product.ratingTrustHintPt ??
                            "A média em estrelas só aparece com volume mínimo de opiniões — para leituras mais fiáveis."}
                        </p>
                        <p className="ae-pdp-reviews-hero__meta ae-muted">
                          <strong>{product.reviewCount.toLocaleString("pt-PT")}</strong>{" "}
                          {product.reviewCount === 1 ? "opinião verificada" : "opiniões verificadas"}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="ae-pdp-reviews-bars-wrap">
                    <p className="ae-pdp-reviews-bars-caption">Distribuição por estrelas</p>
                    <div className="ae-pdp-reviews-bars" role="list" aria-label="Distribuição das opiniões por estrelas">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const idx = 5 - star;
                        const count = ratingDistribution[idx] ?? 0;
                        const total = product.reviewCount;
                        const pct = total > 0 ? Math.min(100, Math.round((count / total) * 1000) / 10) : 0;
                        return (
                          <div
                            key={star}
                            className="ae-pdp-review-dist-row"
                            role="listitem"
                            aria-label={`${star} estrelas: ${count.toLocaleString("pt-PT")} opiniões`}
                          >
                            <span className="ae-pdp-review-dist-stars" aria-hidden="true">
                              {"★".repeat(star)}
                            </span>
                            <div className="ae-pdp-review-dist-track">
                              <div className="ae-pdp-review-dist-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="ae-pdp-review-dist-count">{count.toLocaleString("pt-PT")}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="ae-pdp-reviews-toolbar">
                  <div className="ae-pdp-reviews-toolbar__grid">
                    <div className="ae-pdp-reviews-toolbar__field">
                      <label htmlFor="ae-pdp-review-sort">Ordenar por</label>
                      <select
                        id="ae-pdp-review-sort"
                        className="ae-pdp-reviews-toolbar__select"
                        value={reviewSort}
                        onChange={(e) => setReviewSort(e.target.value as ReviewSortKey)}
                      >
                        <option value="recent">Mais recentes</option>
                        <option value="helpful">Mais úteis</option>
                        <option value="rating_desc">Classificação · maior primeiro</option>
                        <option value="rating_asc">Classificação · menor primeiro</option>
                      </select>
                    </div>
                    <label className="ae-pdp-reviews-toolbar__toggle">
                      <input
                        type="checkbox"
                        checked={reviewsPhotosOnly}
                        onChange={(e) => setReviewsPhotosOnly(e.target.checked)}
                      />
                      <span>Só opiniões com fotos do cliente</span>
                    </label>
                  </div>
                  <p className="ae-pdp-reviews-toolbar__meta ae-muted">
                    {pdpReviews.error ? (
                      <>
                        <span className="ae-pdp-reviews-toolbar__warn">{pdpReviews.error}</span>
                        {" · "}
                      </>
                    ) : null}
                    {pdpReviews.loading ? (
                      <>A sincronizar opiniões com o servidor…</>
                    ) : reviewsFilterEmpty ? null : (
                      <>
                        Exibindo <strong>{reviewRows.length}</strong> de{" "}
                        <strong>{reviewsListTotalShown.toLocaleString("pt-PT")}</strong>
                        {reviewsPhotosOnly ? " opiniões com fotografias de cliente." : " opiniões verificadas."}
                        {reviewsHasMore ? (
                          <>
                            {" "}
                            Utilize «Carregar mais» para ver entradas adicionais ({PDP_REVIEWS_PAGE_SIZE} por passo).
                          </>
                        ) : null}
                      </>
                    )}
                  </p>
                  {!reviewsFilterEmpty && !pdpReviews.loading ? (
                    <p className="ae-pdp-reviews-toolbar__fine ae-muted">
                      O feedback «útil» é público apenas como contagem agregada — cada conta pode votar uma vez por
                      opinião.
                    </p>
                  ) : null}
                </div>
                {reviewsFilterEmpty ? (
                  <div className="ae-pdp-reviews-filter-empty" role="status">
                    <p className="ae-pdp-reviews-filter-empty__title">Nenhuma opinião com fotos</p>
                    <p className="ae-muted">
                      Este artigo ainda não tem avaliações verificadas com imagens de cliente. Desactive o filtro para ver
                      todas as classificações e comentários publicados.
                    </p>
                  </div>
                ) : showReviewsSkeleton ? (
                  <PdpReviewsListSkeleton />
                ) : (
                  <>
                    <ul className="ae-pdp-reviews-list">
                      {reviewRows.map((r) => {
                        const displayName = formatReviewerDisplayName(r.user?.name);
                        const initials = reviewerAvatarInitials(displayName);
                        const dateStr = formatReviewDatePt(r.createdAt);
                        const key = r.id ?? `${r.createdAt ?? "x"}-${displayName}-${r.rating}`;
                        const ownReview = Boolean(user?.id && r.user?.id && user.id === r.user.id);
                        const hc = r.helpfulCount ?? 0;
                        const photoUrlsResolved =
                          r.photoUrls && r.photoUrls.length > 0 ? r.photoUrls.map((u) => resolveMediaUrl(u)) : [];
                        return (
                          <li key={key} className="ae-pdp-review-card">
                            <div className="ae-pdp-review-card__top">
                              <div className="ae-pdp-review-card__avatar" aria-hidden="true">
                                {initials}
                              </div>
                              <div className="ae-pdp-review-card__identity">
                                <span className="ae-pdp-review-card__name">{displayName}</span>
                                <div className="ae-pdp-review-card__badges">
                                  <span className="ae-pdp-review-verified">Compra verificada</span>
                                  {dateStr ? (
                                    <time className="ae-pdp-review-card__date" dateTime={r.createdAt}>
                                      {dateStr}
                                    </time>
                                  ) : null}
                                </div>
                              </div>
                              <StarRating
                                value={r.rating}
                                size="sm"
                                tone="gold"
                                showValue
                                className="ae-pdp-review-card__stars"
                              />
                            </div>
                            <PdpReviewAspectBars
                              quality={r.ratingQuality}
                              communication={r.ratingSellerCommunication}
                              delivery={r.ratingDelivery}
                              overall={r.rating}
                            />
                            {r.comment?.trim() ? (
                              <div className="ae-pdp-review-card__body">{r.comment.trim()}</div>
                            ) : null}
                            {photoUrlsResolved.length > 0 ? (
                              <div className="ae-pdp-review-card__photos">
                                {photoUrlsResolved.map((resolved, pi) => (
                                  <button
                                    key={`${key}-${pi}`}
                                    type="button"
                                    className="ae-pdp-review-card__photo-hit"
                                    aria-label={`Ampliar fotografia ${pi + 1} de ${photoUrlsResolved.length} enviada pelo cliente`}
                                    onClick={() => setReviewPhotoLb({ urls: photoUrlsResolved, index: pi })}
                                  >
                                    <img src={resolved} alt="" loading="lazy" decoding="async" />
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            <footer className="ae-pdp-review-card__footer">
                              <div className="ae-pdp-review-helpful" aria-label="Utilidade desta opinião para outros compradores">
                                <p className="ae-pdp-review-helpful__stat">{helpfulReviewSentence(hc)}</p>
                                <div className="ae-pdp-review-helpful__actions">
                                  {ownReview ? (
                                    <span className="ae-muted ae-pdp-review-helpful__self">A sua opinião verificada</span>
                                  ) : token ? (
                                    <button
                                      type="button"
                                      className={`ae-pdp-review-helpful__btn${r.viewerMarkedHelpful ? " ae-pdp-review-helpful__btn--on" : ""}`}
                                      disabled={!r.id || helpfulBusyId === r.id}
                                      aria-pressed={Boolean(r.viewerMarkedHelpful)}
                                      onClick={() => r.id && void markReviewHelpful(r.id)}
                                    >
                                      {helpfulBusyId === r.id
                                        ? "A registar…"
                                        : r.viewerMarkedHelpful
                                          ? "Marcado como útil"
                                          : "Útil"}
                                    </button>
                                  ) : (
                                    <Link className="ae-linkbtn ae-pdp-review-helpful__login" to="/login">
                                      Inicie sessão para votar
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </footer>
                          </li>
                        );
                      })}
                    </ul>
                    {reviewsHasMore ? (
                      <div className="ae-pdp-reviews-more-wrap">
                        <button
                          type="button"
                          className="btn ae-pdp-reviews-more"
                          disabled={pdpReviews.loadingMore}
                          onClick={() => void loadMoreReviews()}
                        >
                          {pdpReviews.loadingMore
                            ? "A carregar…"
                            : `Carregar mais opiniões (${reviewsRemaining.toLocaleString("pt-PT")} restantes)`}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>

      {reviewPhotoLb ? (
        <div
          className="ae-modal-backdrop ae-pdp-review-photo-lb"
          role="dialog"
          aria-modal="true"
          aria-label="Fotografia da opinião do cliente"
          onClick={() => setReviewPhotoLb(null)}
        >
          <div className="ae-pdp-review-photo-lb__dialog" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ae-pdp-review-photo-lb__close"
              aria-label="Fechar"
              onClick={() => setReviewPhotoLb(null)}
            >
              ×
            </button>
            {reviewPhotoLb.urls.length >= 2 ? (
              <>
                <button
                  type="button"
                  className="ae-pdp-review-photo-lb__nav ae-pdp-review-photo-lb__nav--prev"
                  aria-label="Fotografia anterior"
                  onClick={() =>
                    setReviewPhotoLb((c) =>
                      c && c.urls.length > 1
                        ? { ...c, index: (c.index - 1 + c.urls.length) % c.urls.length }
                        : c,
                    )
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="ae-pdp-review-photo-lb__nav ae-pdp-review-photo-lb__nav--next"
                  aria-label="Fotografia seguinte"
                  onClick={() =>
                    setReviewPhotoLb((c) =>
                      c && c.urls.length > 1 ? { ...c, index: (c.index + 1) % c.urls.length } : c,
                    )
                  }
                >
                  ›
                </button>
              </>
            ) : null}
            <img
              src={reviewPhotoLb.urls[reviewPhotoLb.index]}
              alt="Fotografia enviada pelo cliente na opinião verificada"
              className="ae-pdp-review-photo-lb__img"
              decoding="async"
            />
            {reviewPhotoLb.urls.length >= 2 ? (
              <p className="ae-pdp-review-photo-lb__counter" aria-live="polite">
                {reviewPhotoLb.index + 1} / {reviewPhotoLb.urls.length}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

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
      {lightboxOpen && product && product.images.length ? (
        <div
          className="ae-pdp-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Galeria de fotografias ampliada"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="ae-pdp-lightbox__close"
            aria-label="Fechar ampliação"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
          >
            ×
          </button>
          {product.images.length >= 2 ? (
            <>
              <button
                type="button"
                className="ae-pdp-lightbox__nav ae-pdp-lightbox__nav--prev"
                aria-label="Fotografia anterior"
                onClick={(e) => {
                  e.stopPropagation();
                  goLightbox(-1);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="ae-pdp-lightbox__nav ae-pdp-lightbox__nav--next"
                aria-label="Fotografia seguinte"
                onClick={(e) => {
                  e.stopPropagation();
                  goLightbox(1);
                }}
              >
                ›
              </button>
            </>
          ) : null}
          <div
            className="ae-pdp-lightbox__stage"
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={product.images.length >= 2 ? onLbTouchStart : undefined}
            onTouchEnd={product.images.length >= 2 ? onLbTouchEnd : undefined}
          >
            <img
              src={lightboxResolved || displayMainResolved}
              alt={lightboxAlt}
              className="ae-pdp-lightbox__img"
              decoding="async"
            />
            {product.images.length >= 2 ? (
              <p className="ae-pdp-lightbox__counter" aria-live="polite">
                {lightboxIndex + 1} / {product.images.length}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
