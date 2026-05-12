import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { apiFetch, apiUrl, cartSessionHeaders, ensureCartSession } from "../api.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import { buildSearchPath } from "../buildSearchPath.js";
import { getPublicCategories, type PublicCategory } from "../data/publicCategoriesCache.js";
import { MediaPlaceholder } from "./MediaPlaceholder.js";
import { NotificationsBell } from "./NotificationsBell.js";
import type { ProductCardData } from "./ProductCard.js";
import { resolveMediaUrl } from "../utils/media.js";
import { getCompareIds } from "../utils/compareSelection.js";

function triStatePromoFlag(raw: string | undefined): boolean | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "sim" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "nao" || v === "não" || v === "no") return false;
  return null;
}

/** Remove duplicados (case-insensitivo) na lista de chips da barra promocional. */
function uniquePromoKeywords(raw: string, max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw.split("|")) {
    const t = x.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function promoIntervalActive(now: number, startPrimary: string, endPrimary: string, startFall: string, endFall: string): boolean {
  const hasOwn = startPrimary.trim().length > 0 || endPrimary.trim().length > 0;
  const startRaw = hasOwn ? startPrimary : startFall;
  const endRaw = hasOwn ? endPrimary : endFall;
  if (startRaw.trim()) {
    const s = Date.parse(startRaw);
    if (Number.isFinite(s) && now < s) return false;
  }
  if (endRaw.trim()) {
    const e = Date.parse(endRaw);
    if (Number.isFinite(e) && now > e) return false;
  }
  return true;
}

type Category = PublicCategory;
type SearchSuggestProduct = { id: string; name: string; imageUrl?: string | null };
type SearchDiscoveryCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  productCount: number;
  parentName: string | null;
};

export function Header() {
  const { user, logout, token } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [cats, setCats] = useState<Category[]>([]);
  const [mobileCatsOpen, setMobileCatsOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestProducts, setSuggestProducts] = useState<SearchSuggestProduct[]>([]);
  const [suggestActiveIdx, setSuggestActiveIdx] = useState(-1);
  const [discoveryItems, setDiscoveryItems] = useState<SearchDiscoveryCategory[]>([]);
  const [discoveryScope, setDiscoveryScope] = useState<"related" | "popular">("popular");
  const [catSuggestLoading, setCatSuggestLoading] = useState(false);
  const [searchCatId, setSearchCatId] = useState<string>("");
  const [catOpen, setCatOpen] = useState(false);
  const [compareN, setCompareN] = useState(0);
  const [imgSearchBusy, setImgSearchBusy] = useState(false);
  const [promoPopupOpen, setPromoPopupOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const catMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ensureCartSession();
  }, []);

  useEffect(() => {
    void getPublicCategories().then(setCats);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    if (loc.pathname === "/search") {
      setQ(params.get("q") ?? "");
      setSearchCatId(params.get("categoryId") ?? "");
    }
  }, [loc.pathname, loc.search]);

  useEffect(() => {
    setMobileCatsOpen(false);
    setCatOpen(false);
  }, [loc.pathname, loc.search]);
  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      if (!catMenuRef.current) return;
      if (ev.target instanceof Node && !catMenuRef.current.contains(ev.target)) setCatOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);


  useEffect(() => {
    const sync = () => setCompareN(getCompareIds().length);
    sync();
    window.addEventListener("compare-updated", sync);
    return () => window.removeEventListener("compare-updated", sync);
  }, []);

  async function refreshCart() {
    try {
      ensureCartSession();
      const cart = await apiFetch<{ items: unknown[] }>("/cart", { headers: cartSessionHeaders(), token });
      setCartCount(cart.items?.length ?? 0);
    } catch {
      setCartCount(0);
    }
  }

  async function refreshFavorites() {
    if (!token || user?.role !== "CLIENTE") {
      setFavCount(0);
      return;
    }
    try {
      const list = await apiFetch<{ length?: number } | unknown[]>("/favorites", { token });
      setFavCount(Array.isArray(list) ? list.length : 0);
    } catch {
      setFavCount(0);
    }
  }

  useEffect(() => {
    void refreshCart();
  }, [token, loc.pathname]);

  useEffect(() => {
    void refreshFavorites();
  }, [token, loc.pathname, user?.role]);

  useEffect(() => {
    const fn = () => void refreshCart();
    window.addEventListener("cart-updated", fn);
    return () => window.removeEventListener("cart-updated", fn);
  }, [token]);

  useEffect(() => {
    const fn = () => void refreshFavorites();
    window.addEventListener("favorites-updated", fn);
    return () => window.removeEventListener("favorites-updated", fn);
  }, [token, user?.role]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    setSuggestOpen(false);
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (searchCatId) params.set("categoryId", searchCatId);
    nav(params.toString() ? `/search?${params.toString()}` : "/search");
  }

  const { content } = useSiteContent();
  const headerLogoRaw = (content["public.header_logo_url"] ?? "").trim();
  const headerLogoSrc = headerLogoRaw ? resolveMediaUrl(headerLogoRaw) ?? "" : "";
  const promoBarText = (content["public.header_promo_text"] ?? "").trim();
  const promoKeywordsRaw = (content["public.header_promo_keywords"] ?? "").trim();
  const barFlag = triStatePromoFlag(content["public.header_promo_bar_enabled"]);
  const popupFlag = triStatePromoFlag(content["public.header_promo_popup_enabled"]);
  const legacyPromoOn = (content["public.header_promo_enabled"] ?? "false").trim().toLowerCase();
  const legacyEnabled =
    legacyPromoOn === "true" || legacyPromoOn === "1" || legacyPromoOn === "sim" || legacyPromoOn === "yes";
  const legacyMode = (content["public.header_promo_mode"] ?? "bar").trim().toLowerCase();
  const barEnabled = barFlag !== null ? barFlag : legacyEnabled && legacyMode !== "popup";
  const popupEnabled = popupFlag !== null ? popupFlag : legacyEnabled && legacyMode === "popup";

  const legacyStartRaw = (content["public.header_promo_start_at"] ?? "").trim();
  const legacyEndRaw = (content["public.header_promo_end_at"] ?? "").trim();
  const barStartRaw = (content["public.header_promo_bar_start_at"] ?? "").trim();
  const barEndRaw = (content["public.header_promo_bar_end_at"] ?? "").trim();
  const popupStartRaw = (content["public.header_promo_popup_start_at"] ?? "").trim();
  const popupEndRaw = (content["public.header_promo_popup_end_at"] ?? "").trim();

  const promoPriorityRaw = (content["public.header_promo_priority"] ?? "50").trim();
  const promoPosition = (content["public.header_promo_position"] ?? "center").trim().toLowerCase();
  const promoDelayRaw = (content["public.header_promo_delay_seconds"] ?? "2").trim();
  const promoCtaText = (content["public.header_promo_cta_text"] ?? "Comprar agora").trim() || "Comprar agora";
  const promoPriceText = (content["public.header_promo_price"] ?? "").trim();
  const promoLinkRaw = (content["public.header_promo_link_url"] ?? "").trim();
  const promoImage = resolveMediaUrl((content["public.header_promo_image_url"] ?? "").trim()) ?? "";
  const categoryBarEnabledRaw = (content["public.header_category_bar_enabled"] ?? "true").trim().toLowerCase();
  const categoryBarEnabled =
    categoryBarEnabledRaw === "true" ||
    categoryBarEnabledRaw === "1" ||
    categoryBarEnabledRaw === "sim" ||
    categoryBarEnabledRaw === "yes";
  const promoMarqueeRaw = (content["public.header_promo_marquee"] ?? "true").trim().toLowerCase();
  const promoMarqueeOn =
    promoMarqueeRaw === "true" || promoMarqueeRaw === "1" || promoMarqueeRaw === "sim" || promoMarqueeRaw === "yes";
  const promoKeywords = uniquePromoKeywords(promoKeywordsRaw, 4);
  const promoPopupTextRaw = (content["public.header_promo_popup_text"] ?? "").trim();
  const promoPopupBody = promoPopupTextRaw || promoBarText;
  const promoPopupKeywordsRaw = (content["public.header_promo_popup_keywords"] ?? "").trim();
  const popupKeywordsForCard = useMemo(() => {
    const barKw = uniquePromoKeywords(promoKeywordsRaw, 4);
    return (promoPopupKeywordsRaw ? uniquePromoKeywords(promoPopupKeywordsRaw, 6) : barKw).slice(0, 6);
  }, [promoPopupKeywordsRaw, promoKeywordsRaw]);
  const roots = cats.filter((c) => !c.parentId);
  const discoveryColumnTitle =
    discoveryScope === "related" ? "Categorias relacionadas" : "Categorias em destaque";

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setSuggestProducts([]);
      setDiscoveryItems([]);
      setDiscoveryScope("popular");
      setSuggestLoading(false);
      setCatSuggestLoading(false);
      setSuggestActiveIdx(-1);
      return;
    }
    setSuggestLoading(true);
    setCatSuggestLoading(true);
    const t = window.setTimeout(() => {
      void Promise.allSettled([
        apiFetch<{ items: { id: string; name: string; imageUrl?: string | null }[] }>(
          `/products/suggest?q=${encodeURIComponent(term)}&take=8`
        ),
        apiFetch<{ items: SearchDiscoveryCategory[]; scope?: string }>(
          `/categories/suggest?q=${encodeURIComponent(term)}&take=6`
        ),
      ]).then((results) => {
        const pr = results[0];
        if (pr.status === "fulfilled") {
          setSuggestProducts(
            (pr.value.items ?? []).map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl ?? null }))
          );
        } else {
          setSuggestProducts([]);
        }
        const cr = results[1];
        if (cr.status === "fulfilled") {
          const rawItems = cr.value.items ?? [];
          setDiscoveryItems(
            rawItems.map((c) => ({
              id: String(c.id ?? ""),
              name: String(c.name ?? ""),
              slug: String(c.slug ?? ""),
              imageUrl: c.imageUrl ?? null,
              productCount: Number(c.productCount) || 0,
              parentName: c.parentName ?? null,
            })).filter((c) => c.id && c.name)
          );
          setDiscoveryScope(cr.value.scope === "related" ? "related" : "popular");
        } else {
          setDiscoveryItems([]);
          setDiscoveryScope("popular");
        }
        setSuggestActiveIdx(-1);
      }).finally(() => {
        setSuggestLoading(false);
        setCatSuggestLoading(false);
      });
    }, 220);
    return () => window.clearTimeout(t);
  }, [q]);

  const suggestPanelReady = !suggestLoading && !catSuggestLoading;
  const showSuggestViewAll =
    q.trim().length >= 2 &&
    suggestPanelReady &&
    suggestProducts.length + discoveryItems.length > 0;
  const viewAllSuggestIdx = showSuggestViewAll ? suggestProducts.length + discoveryItems.length : -1;
  const suggestTotal =
    suggestProducts.length + discoveryItems.length + (showSuggestViewAll ? 1 : 0);
  const promoPriority = Number.isFinite(Number(promoPriorityRaw)) ? Math.round(Number(promoPriorityRaw)) : 50;
  const promoDelaySeconds = Number.isFinite(Number(promoDelayRaw))
    ? Math.min(Math.max(Number(promoDelayRaw), 0), 180)
    : 2;
  const promoPositionClass =
    promoPosition === "top-right"
      ? "ae-promo-card-wrap--top-right"
      : promoPosition === "bottom-right"
        ? "ae-promo-card-wrap--bottom-right"
        : "ae-promo-card-wrap--center";
  const promoLink = useMemo(() => {
    if (!promoLinkRaw) return "";
    if (promoLinkRaw.startsWith("/")) return promoLinkRaw;
    if (/^https?:\/\//i.test(promoLinkRaw)) return promoLinkRaw;
    return "";
  }, [promoLinkRaw]);
  const barScheduleActive = useMemo(
    () => promoIntervalActive(Date.now(), barStartRaw, barEndRaw, legacyStartRaw, legacyEndRaw),
    [barStartRaw, barEndRaw, legacyStartRaw, legacyEndRaw]
  );
  const popupScheduleActive = useMemo(
    () => promoIntervalActive(Date.now(), popupStartRaw, popupEndRaw, legacyStartRaw, legacyEndRaw),
    [popupStartRaw, popupEndRaw, legacyStartRaw, legacyEndRaw]
  );

  useEffect(() => {
    if (!popupEnabled || !popupScheduleActive) return;
    if (!promoPopupBody) return;

    const kw = popupKeywordsForCard.join(",");
    const rawKey = `promo_popup_seen_v3:${promoPopupBody}|${kw}|${promoPriceText}|${popupStartRaw || legacyStartRaw}|${popupEndRaw || legacyEndRaw}`;
    const safeKey = rawKey.replace(/[^a-z0-9]+/gi, "_").slice(0, 120);
    const seen = localStorage.getItem(safeKey) === "1";
    if (seen) return;
    const timer = window.setTimeout(() => setPromoPopupOpen(true), promoDelaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [
    popupEnabled,
    promoPopupBody,
    popupKeywordsForCard,
    promoDelaySeconds,
    popupScheduleActive,
    promoPriceText,
    popupStartRaw,
    popupEndRaw,
    legacyStartRaw,
    legacyEndRaw,
  ]);

  function closePromoPopup() {
    const kw = popupKeywordsForCard.join(",");
    const rawKey = `promo_popup_seen_v3:${promoPopupBody}|${kw}|${promoPriceText}|${popupStartRaw || legacyStartRaw}|${popupEndRaw || legacyEndRaw}`;
    const safeKey = rawKey.replace(/[^a-z0-9]+/gi, "_").slice(0, 120);
    localStorage.setItem(safeKey, "1");
    setPromoPopupOpen(false);
  }

  async function onPickSearchImage(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setImgSearchBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(apiUrl("/products/visual-search"), {
        method: "POST",
        body: fd,
      });
      const raw = await res.text();
      const data = raw ? (JSON.parse(raw) as { items?: ProductCardData[]; total?: number; error?: string }) : {};
      if (!res.ok) throw new Error(data.error || "Falha na pesquisa por imagem");
      sessionStorage.setItem(
        "ae_visual_search_v1",
        JSON.stringify({
          at: Date.now(),
          total: Number(data.total || 0),
          items: Array.isArray(data.items) ? data.items : [],
          fileName: file.name,
        })
      );
      nav("/search?visual=1");
    } catch {
      sessionStorage.removeItem("ae_visual_search_v1");
      nav("/search?visual=1");
    } finally {
      setImgSearchBusy(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function applyCategoryFromSearchBar(id: string) {
    setSearchCatId(id);
    setCatOpen(false);
    const term = q.trim();
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (id) params.set("categoryId", id);
    nav(params.toString() ? `/search?${params.toString()}` : "/search");
  }

  function goFullCatalogSearch() {
    const term = q.trim();
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (searchCatId) params.set("categoryId", searchCatId);
    nav(params.toString() ? `/search?${params.toString()}` : "/search");
    setSuggestOpen(false);
  }

  return (
    <header className="ae-header-wrap">
      <div className="ae-topbar">
        <div className="ae-shell ae-topbar__inner">
          <div className="ae-topbar__left">
            <span className="ae-topbar__tag" aria-label="Angola">
              AO
            </span>
            <span className="ae-topbar__strap">
              Comércio electrónico nacional · transacções em kwanzas angolanos (Kz)
            </span>
          </div>
          <div className="ae-topbar__links">
            {(!user || user.role === "CLIENTE") && (
              <Link to="/quero-vender" className="ae-topbar__link">
                Programa de parceiros
              </Link>
            )}
            {user?.role === "VENDEDOR" && (
              <Link to="/vendor" className="ae-topbar__link">
                Área comercial
              </Link>
            )}
            {user?.role === "LOGISTICA" && (
              <Link to="/logistica" className="ae-topbar__link">
                Logística
              </Link>
            )}
            {(user?.role === "ADMIN" || user?.role === "SUPORTE") && (
              <Link to="/admin/dashboard" className="ae-topbar__link">
                Back-office
              </Link>
            )}
            {!user ? (
              <>
                <Link to="/login">Iniciar sessão</Link>
                <Link to="/login?register=1">Criar conta</Link>
              </>
            ) : (
              <>
                <span className="ae-topbar__hi">
                  Sessão ·{" "}
                  <strong>
                    {(user.name ?? "").trim().split(/\s+/).filter(Boolean)[0] ||
                      (user.email ?? "").split("@")[0] ||
                      "Conta"}
                  </strong>
                </span>
                <button type="button" className="ae-linkbtn" onClick={() => logout()}>
                  Terminar sessão
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="ae-mainhead">
        <div className="ae-shell ae-mainhead__row">
          <Link to="/" className="ae-logo" aria-label="BAZAR DO BIÉ — página inicial">
            {headerLogoSrc ? (
              <span className="ae-logo__mark">
                <img src={headerLogoSrc} alt="" width={42} height={42} decoding="async" className="ae-logo__img" />
              </span>
            ) : null}
            <span className="ae-logo__wordmark">
              <span className="ae-logo__main">BAZAR</span>
              <span className="ae-logo__sub">DO BIÉ</span>
            </span>
          </Link>

          <div className="ae-search-wrap">
            <form className="ae-search" onSubmit={onSearch}>
              <div className="ae-search-cat" ref={catMenuRef}>
                <button
                  type="button"
                  className="ae-search__catbtn"
                  aria-label="Filtrar por categoria"
                  aria-expanded={catOpen}
                  onClick={() => setCatOpen((v) => !v)}
                >
                  <span className="ae-search__catbtn-label">
                    {roots.find((c) => c.id === searchCatId)?.name ?? "Todas as categorias"}
                  </span>
                  <span aria-hidden className="ae-search__catbtn-caret">▾</span>
                </button>
                {catOpen ? (
                  <div className="ae-search-cat__menu" role="listbox" aria-label="Lista de categorias">
                    <button type="button" className="ae-search-cat__item" onClick={() => applyCategoryFromSearchBar("")}>
                      <span className="ae-search-cat__icon">☰</span>
                      <span>Todas as categorias</span>
                    </button>
                    {roots.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`ae-search-cat__item ${searchCatId === c.id ? "ae-search-cat__item--on" : ""}`}
                        onClick={() => applyCategoryFromSearchBar(c.id)}
                      >
                        <span className="ae-search-cat__icon">•</span>
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <input
                type="search"
                className="ae-search__input"
                placeholder="Pesquisar produtos, marcas e categorias"
                value={q}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => window.setTimeout(() => setSuggestOpen(false), 120)}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSuggestOpen(true);
                }}
                onKeyDown={(e) => {
                  if (!suggestOpen || suggestTotal === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSuggestActiveIdx((n) => (n + 1) % suggestTotal);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSuggestActiveIdx((n) => (n <= 0 ? suggestTotal - 1 : n - 1));
                  } else if (e.key === "Enter" && suggestActiveIdx >= 0) {
                    e.preventDefault();
                    if (showSuggestViewAll && suggestActiveIdx === viewAllSuggestIdx) {
                      goFullCatalogSearch();
                    } else if (suggestActiveIdx < suggestProducts.length) {
                      nav(`/product/${suggestProducts[suggestActiveIdx].id}`);
                      setSuggestOpen(false);
                    } else if (suggestActiveIdx < suggestProducts.length + discoveryItems.length) {
                      const ci = suggestActiveIdx - suggestProducts.length;
                      const cat = discoveryItems[ci];
                      if (cat) {
                        const params = new URLSearchParams();
                        const term = q.trim();
                        if (term) params.set("q", term);
                        params.set("categoryId", cat.id);
                        nav(`/search?${params.toString()}`);
                      }
                      setSuggestOpen(false);
                    }
                  } else if (e.key === "Escape") {
                    setSuggestOpen(false);
                  }
                }}
                autoComplete="off"
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => void onPickSearchImage(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="ae-search__imgbtn"
                aria-label="Pesquisar por imagem"
                title="Pesquisar por imagem"
                onClick={() => imageInputRef.current?.click()}
                disabled={imgSearchBusy}
              >
                {imgSearchBusy ? (
                  <span className="ae-search__imgbtn-spin" aria-hidden>
                    …
                  </span>
                ) : (
                  <span className="ae-search__imgbtn-ico" aria-hidden>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path
                        strokeLinejoin="round"
                        d="M4 7a2 2 0 0 1 2-2h2l1-2h6l1 2h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
                      />
                      <circle cx="12" cy="13" r="3.25" />
                    </svg>
                  </span>
                )}
              </button>
              <button type="submit" className="ae-search__btn" aria-label="Pesquisar no catálogo">
                <span className="ae-search__btn-ico" aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.1">
                    <circle cx="10.5" cy="10.5" r="6.5" strokeLinecap="round" />
                    <path strokeLinecap="round" d="M20 20 15.5 15.5" />
                  </svg>
                </span>
              </button>
            </form>
            {suggestOpen && q.trim().length >= 2 ? (
              <div className="ae-search-suggest ae-search-suggest--pro" role="listbox" aria-label="Sugestões de pesquisa">
                <div className="ae-search-suggest__cols">
                  <div className="ae-search-suggest__col ae-search-suggest__col--list">
                    <div className="ae-search-suggest__head">
                      <span className="ae-search-suggest__head-title">Sugestões</span>
                      {searchCatId ? (
                        <span className="ae-search-suggest__head-filter">âmbito: categoria seleccionada</span>
                      ) : null}
                    </div>
                    {suggestLoading ? (
                      <div className="ae-search-suggest__loading" aria-live="polite">
                        <div className="ae-search-suggest__skel-row">
                          <div className="ae-skel ae-search-suggest__skel-thumb" />
                          <div className="ae-search-suggest__skel-lines">
                            <div className="ae-skel ae-search-suggest__skel-line" />
                            <div className="ae-skel ae-search-suggest__skel-line ae-search-suggest__skel-line--short" />
                          </div>
                        </div>
                        <div className="ae-search-suggest__skel-row">
                          <div className="ae-skel ae-search-suggest__skel-thumb" />
                          <div className="ae-search-suggest__skel-lines">
                            <div className="ae-skel ae-search-suggest__skel-line" />
                            <div className="ae-skel ae-search-suggest__skel-line ae-search-suggest__skel-line--mid" />
                          </div>
                        </div>
                      </div>
                    ) : suggestProducts.length === 0 ? (
                      <p className="ae-search-suggest__empty-col">
                        Nenhum artigo com este termo nas primeiras sugestões. Utilize a pesquisa completa ou explore as
                        categorias ao lado.
                      </p>
                    ) : (
                      <div className="ae-search-suggest__prows">
                        {suggestProducts.map((p, i) => (
                          <button
                            key={p.id}
                            type="button"
                            className={`ae-search-suggest__prow ${suggestActiveIdx === i ? "ae-search-suggest__prow--on" : ""}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              nav(`/product/${p.id}`);
                              setSuggestOpen(false);
                            }}
                          >
                            <span className="ae-search-suggest__pthumb-wrap">
                              {p.imageUrl ? (
                                <img
                                  className="ae-search-suggest__pthumb"
                                  src={resolveMediaUrl(p.imageUrl)}
                                  alt=""
                                  decoding="async"
                                />
                              ) : (
                                <MediaPlaceholder variant="tile" className="ae-search-suggest__pthumb-ph" />
                              )}
                            </span>
                            <span className="ae-search-suggest__pname">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showSuggestViewAll ? (
                      <button
                        type="button"
                        className={`ae-search-suggest__viewall ${suggestActiveIdx === viewAllSuggestIdx ? "ae-search-suggest__viewall--on" : ""}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          goFullCatalogSearch();
                        }}
                      >
                        Ver todos os resultados para «{q.trim()}»
                      </button>
                    ) : null}
                  </div>
                  <div className="ae-search-suggest__col ae-search-suggest__col--discover">
                    <div className="ae-search-suggest__discover-head">
                      <span className="ae-search-suggest__discover-title">{discoveryColumnTitle}</span>
                      <button
                        type="button"
                        className="ae-search-suggest__discover-link"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSuggestOpen(false);
                          nav("/search");
                        }}
                      >
                        Catálogo completo
                      </button>
                    </div>
                    {catSuggestLoading && discoveryItems.length === 0 ? (
                      <div className="ae-search-suggest__cgrid ae-search-suggest__cgrid--skel" aria-hidden>
                        {Array.from({ length: 6 }).map((_, sk) => (
                          <div key={sk} className="ae-search-suggest__ctile-skel">
                            <div className="ae-skel ae-search-suggest__cimg-skel" />
                            <div className="ae-skel ae-search-suggest__clab-skel" />
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {!catSuggestLoading && discoveryItems.length === 0 ? (
                      <p className="ae-search-suggest__empty-col ae-search-suggest__empty-col--muted">
                        Sem categorias com stock para mostrar.
                      </p>
                    ) : null}
                    {discoveryItems.length > 0 ? (
                      <div className="ae-search-suggest__cgrid">
                        {discoveryItems.map((c, j) => {
                          const idx = suggestProducts.length + j;
                          const countLabel =
                            c.productCount >= 1000
                              ? `${(c.productCount / 1000).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}k+`
                              : c.productCount.toLocaleString("pt-PT");
                          return (
                            <button
                              key={c.id}
                              type="button"
                              aria-label={`${c.name}${c.parentName ? ` em ${c.parentName}` : ""}, ${c.productCount.toLocaleString("pt-PT")} artigos`}
                              className={`ae-search-suggest__ctile ${suggestActiveIdx === idx ? "ae-search-suggest__ctile--on" : ""}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const params = new URLSearchParams();
                                const term = q.trim();
                                if (term) params.set("q", term);
                                params.set("categoryId", c.id);
                                nav(`/search?${params.toString()}`);
                                setSuggestOpen(false);
                              }}
                            >
                              <span className="ae-search-suggest__cimg">
                                {c.imageUrl ? (
                                  <img src={resolveMediaUrl(c.imageUrl)} alt="" decoding="async" />
                                ) : (
                                  <MediaPlaceholder variant="category" className="ae-search-suggest__cph" />
                                )}
                                <span className="ae-search-suggest__ccount" aria-hidden>
                                  {countLabel}
                                </span>
                              </span>
                              <span className="ae-search-suggest__clab">{c.name}</span>
                              {c.parentName ? (
                                <span className="ae-search-suggest__cparent">em {c.parentName}</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="ae-mainhead__actions">
            <Link
              to="/compare"
              className="ae-ico-link ae-ico-link--compare"
              aria-label={
                compareN > 0
                  ? `Comparador de produtos, ${compareN} artigo${compareN === 1 ? "" : "s"}`
                  : "Comparador de produtos"
              }
            >
              <span className="ae-ico ae-ico--inline-svg" aria-hidden>
                <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" d="M7 4v16M7 4l3 3M7 4L4 7M17 20V4M17 20l-3-3M17 20l3-3" />
                </svg>
              </span>
              <span className="ae-ico-link__lbl">Comparar</span>
              {compareN > 0 ? <span className="ae-cart-badge">{compareN}</span> : null}
            </Link>
            <NotificationsBell />
            {user?.role === "CLIENTE" && (
              <>
                <Link to="/favorites" className="ae-ico-link ae-ico-link--fav" aria-label="Lista de interesse">
                  <span className="ae-ico ae-ico--heart" aria-hidden>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </span>
                  <span className="ae-ico-link__lbl">Lista de interesse</span>
                  {favCount > 0 ? (
                    <span className="ae-cart-badge">{favCount > 99 ? "99+" : favCount}</span>
                  ) : null}
                </Link>
                <Link to="/orders" className="ae-ico-link" aria-label="As minhas encomendas">
                  <span className="ae-ico ae-ico--inline-svg" aria-hidden>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.85">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 18.75a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm7.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm.696-10.5H5.25l1.5 9h10.5l1.32-7.92a.75.75 0 0 0-.74-.87H7.696"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25V6a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v2.25" />
                    </svg>
                  </span>
                  <span className="ae-ico-link__lbl">Encomendas</span>
                </Link>
              </>
            )}
            <Link to="/cart" className="ae-ico-link ae-ico-link--cart" aria-label="Carrinho">
              <span className="ae-ico ae-ico--inline-svg" aria-hidden>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.85">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 3h1.386c.51 0 .955.343 1.087.835l3.936 14.25a1.125 1.125 0 0 0 1.086.865h8.508a1.125 1.125 0 0 0 1.086-.865l1.284-4.835M7.5 18a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm9.75 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V6.75A3.75 3.75 0 0 0 12 3h0a3.75 3.75 0 0 0-3.75 3.75V9" />
                </svg>
              </span>
              <span className="ae-ico-link__lbl">Carrinho</span>
              {cartCount > 0 ? <span className="ae-cart-badge">{cartCount > 99 ? "99+" : cartCount}</span> : null}
            </Link>
          </div>
        </div>
      </div>

      {barEnabled && barScheduleActive && promoBarText ? (
        <div className="ae-promo-bar">
          <div className="ae-shell ae-promo-bar__inner">
            {promoBarText}
            {promoKeywords.length > 0 ? (
              <div className={`ae-promo-keywords ${promoMarqueeOn ? "ae-promo-keywords--marquee" : ""}`}>
                <div className="ae-promo-keywords__track">
                  {promoKeywords.map((k, i) => (
                    <span key={`kw-${i}-${k.slice(0, 24)}`} className="ae-promo-keywords__chip">
                      {k}
                    </span>
                  ))}
                  {promoMarqueeOn
                    ? promoKeywords.map((k, i) => (
                        <span key={`kw-loop-${i}-${k.slice(0, 24)}`} className="ae-promo-keywords__chip" aria-hidden>
                          {k}
                        </span>
                      ))
                    : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {popupEnabled && popupScheduleActive && promoPopupBody && promoPopupOpen ? (
        <div className="ae-modal-backdrop ae-modal-backdrop--promo-popup" role="dialog" aria-modal="true">
          <div className={`ae-promo-card-wrap ${promoPositionClass}`} style={{ zIndex: Math.max(1000, 1000 + promoPriority) }}>
            <div className="ae-promo-card">
              <button type="button" className="ae-modal__close" aria-label="Fechar" onClick={closePromoPopup}>
                ×
              </button>
              {promoImage ? (
                <div className="ae-promo-card__image-wrap">
                  <img src={promoImage} alt="Campanha promocional" className="ae-promo-card__image" loading="lazy" />
                </div>
              ) : null}
              <div className="ae-promo-card__body">
                <div className="ae-promo-card__eyebrow">Oferta especial</div>
                {promoPriceText ? <div className="ae-promo-card__price">{promoPriceText}</div> : null}
                <p className="ae-promo-card__text">{promoPopupBody}</p>
                {popupKeywordsForCard.length > 0 ? (
                  <div className="ae-promo-card__chips">
                    {popupKeywordsForCard.map((k) => (
                      <span key={k} className="ae-promo-card__chip">
                        {k}
                      </span>
                    ))}
                  </div>
                ) : null}
                {promoLink ? (
                  <a
                    className="ae-promo-card__cta"
                    href={promoLink}
                    target={promoLink.startsWith("/") ? undefined : "_blank"}
                    rel={promoLink.startsWith("/") ? undefined : "noreferrer noopener"}
                    onClick={closePromoPopup}
                  >
                    {promoCtaText}
                  </a>
                ) : (
                  <button type="button" className="ae-promo-card__cta" onClick={closePromoPopup}>
                    {promoCtaText}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {categoryBarEnabled ? (
        <nav className="ae-catnav" aria-label="Categorias">
          <div className="ae-shell ae-catnav__inner">
            <Link to={buildSearchPath(loc.pathname, searchParams, { categoryId: null })} className="ae-catnav__all">
              Catálogo completo
            </Link>
            <button
              type="button"
              className="ae-catnav__toggle"
              aria-expanded={mobileCatsOpen}
              onClick={() => setMobileCatsOpen((v) => !v)}
            >
              Categorias
            </button>
            <div className={`ae-catnav__strip ${mobileCatsOpen ? "ae-catnav__strip--open" : ""}`}>
              {roots.map((c) => (
                <Link key={c.id} to={buildSearchPath(loc.pathname, searchParams, { categoryId: c.id })}>
                  {c.name}
                </Link>
              ))}
              <Link to={buildSearchPath(loc.pathname, searchParams, { sort: "mais_vendidos" })}>Mais vendidos</Link>
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
