import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { apiFetch, cartSessionHeaders, ensureCartSession } from "../api.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import { buildSearchPath } from "../buildSearchPath.js";
import { NotificationsBell } from "./NotificationsBell.js";

type Category = { id: string; name: string; slug: string; parentId: string | null };
type SearchSuggestProduct = { id: string; name: string };

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

  useEffect(() => {
    ensureCartSession();
  }, []);

  useEffect(() => {
    void apiFetch<Category[]>("/categories")
      .then(setCats)
      .catch(() => setCats([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    if (loc.pathname === "/search") setQ(params.get("q") ?? "");
  }, [loc.pathname, loc.search]);

  useEffect(() => {
    setMobileCatsOpen(false);
  }, [loc.pathname, loc.search]);

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
    nav(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  }

  const { content } = useSiteContent();
  const promo = (content["public.header_promo_text"] ?? "").trim();
  const promoKeywordsRaw = (content["public.header_promo_keywords"] ?? "").trim();
  const promoMarqueeRaw = (content["public.header_promo_marquee"] ?? "true").trim().toLowerCase();
  const promoMarqueeOn =
    promoMarqueeRaw === "true" || promoMarqueeRaw === "1" || promoMarqueeRaw === "sim" || promoMarqueeRaw === "yes";
  const promoKeywords = promoKeywordsRaw
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12);
  const roots = cats.filter((c) => !c.parentId).slice(0, 12);
  const smartCategorySuggestions =
    q.trim().length >= 2
      ? roots
          .filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
          .slice(0, 4)
      : [];

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setSuggestProducts([]);
      setSuggestLoading(false);
      setSuggestActiveIdx(-1);
      return;
    }
    setSuggestLoading(true);
    const t = window.setTimeout(() => {
      void apiFetch<{ items: { id: string; name: string }[] }>(
        `/products/suggest?q=${encodeURIComponent(term)}&take=6`
      )
        .then((r) => {
          setSuggestProducts((r.items ?? []).map((p) => ({ id: p.id, name: p.name })));
          setSuggestActiveIdx(-1);
        })
        .catch(() => {
          setSuggestProducts([]);
          setSuggestActiveIdx(-1);
        })
        .finally(() => setSuggestLoading(false));
    }, 220);
    return () => window.clearTimeout(t);
  }, [q]);

  const suggestTotal = suggestProducts.length + smartCategorySuggestions.length;

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
            {user?.role === "ADMIN" && (
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
                  Sessão · <strong>{user.name.split(" ")[0]}</strong>
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
          <Link to="/" className="ae-logo">
            <span className="ae-logo__main">BAZAR</span>
            <span className="ae-logo__sub">DO BIÉ</span>
          </Link>

          <div className="ae-search-wrap">
            <form className="ae-search" onSubmit={onSearch}>
              <input
                type="search"
                className="ae-search__input"
                placeholder="Pesquisar no catálogo…"
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
                    if (suggestActiveIdx < suggestProducts.length) {
                      nav(`/product/${suggestProducts[suggestActiveIdx].id}`);
                    } else {
                      const ci = suggestActiveIdx - suggestProducts.length;
                      const cat = smartCategorySuggestions[ci];
                      if (cat) nav(`/search?categoryId=${encodeURIComponent(cat.id)}`);
                    }
                    setSuggestOpen(false);
                  } else if (e.key === "Escape") {
                    setSuggestOpen(false);
                  }
                }}
                autoComplete="off"
              />
              <button type="submit" className="ae-search__btn" aria-label="Pesquisar no catálogo">
                Pesquisar
              </button>
            </form>
            {suggestOpen && q.trim().length >= 2 ? (
              <div className="ae-search-suggest">
                {suggestLoading ? <div className="ae-search-suggest__state">A sugerir produtos…</div> : null}
                {!suggestLoading && suggestTotal === 0 ? (
                  <div className="ae-search-suggest__state">Sem sugestões para este termo.</div>
                ) : null}
                {!suggestLoading && suggestProducts.length > 0 ? (
                  <div className="ae-search-suggest__group">
                    <div className="ae-search-suggest__title">Produtos</div>
                    {suggestProducts.map((p, i) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`ae-search-suggest__item ${suggestActiveIdx === i ? "ae-search-suggest__item--on" : ""}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          nav(`/product/${p.id}`);
                          setSuggestOpen(false);
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                {!suggestLoading && smartCategorySuggestions.length > 0 ? (
                  <div className="ae-search-suggest__group">
                    <div className="ae-search-suggest__title">Categorias</div>
                    {smartCategorySuggestions.map((c, j) => {
                      const idx = suggestProducts.length + j;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`ae-search-suggest__item ${suggestActiveIdx === idx ? "ae-search-suggest__item--on" : ""}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            nav(`/search?categoryId=${encodeURIComponent(c.id)}`);
                            setSuggestOpen(false);
                          }}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="ae-mainhead__actions">
            <NotificationsBell />
            {user?.role === "CLIENTE" && (
              <>
                <Link to="/favorites" className="ae-ico-link ae-ico-link--fav">
                  <span className="ae-ico ae-ico--heart" aria-hidden>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </span>
                  <span>Lista de interesse</span>
                  {favCount > 0 ? (
                    <span className="ae-cart-badge">{favCount > 99 ? "99+" : favCount}</span>
                  ) : null}
                </Link>
                <Link to="/orders" className="ae-ico-link">
                  <span className="ae-ico ae-ico--glyph" aria-hidden>
                    P
                  </span>
                  <span>Encomendas</span>
                </Link>
              </>
            )}
            <Link to="/cart" className="ae-ico-link ae-ico-link--cart">
              <span className="ae-ico ae-ico--glyph" aria-hidden>
                C
              </span>
              <span>Carrinho</span>
              {cartCount > 0 ? <span className="ae-cart-badge">{cartCount > 99 ? "99+" : cartCount}</span> : null}
            </Link>
          </div>
        </div>
      </div>

      {promo ? (
        <div className="ae-promo-bar">
          <div className="ae-shell ae-promo-bar__inner">
            {promo}
            {promoKeywords.length > 0 ? (
              <div className={`ae-promo-keywords ${promoMarqueeOn ? "ae-promo-keywords--marquee" : ""}`}>
                <div className="ae-promo-keywords__track">
                  {promoKeywords.map((k) => (
                    <span key={k} className="ae-promo-keywords__chip">
                      {k}
                    </span>
                  ))}
                  {promoMarqueeOn
                    ? promoKeywords.map((k) => (
                        <span key={`dup-${k}`} className="ae-promo-keywords__chip" aria-hidden>
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
    </header>
  );
}
