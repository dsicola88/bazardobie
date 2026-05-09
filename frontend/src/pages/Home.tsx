import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { ProductCard, type ProductCardData } from "../components/ProductCard.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import { parseTrustCell, parseSiteTruthy, splitPipeTags } from "../site/siteContent.js";
import { resolveMediaUrl } from "../utils/media.js";
import { useSeo } from "../seo/useSeo.js";
import { useFlashDealCountdown } from "../home/useFlashDealCountdown.js";

type Banner = { id: string; title?: string | null; imageUrl: string; linkUrl?: string | null };
type Category = { id: string; name: string; imageUrl?: string | null; parentId: string | null };
type MegaProduct = { id: string; name: string; images?: { url: string }[] };
type HomeGroupBlock = {
  slug: string;
  title: string;
  subtitle?: string | null;
  items: ProductCardData[];
};

function resolveFlashExplore(hrefRaw: string): { path: string; external: boolean } {
  const h = hrefRaw.trim();
  if (!h) return { path: "/search?onSale=true&sort=preco_asc", external: false };
  if (/^https?:\/\//i.test(h)) return { path: h, external: true };
  if (h.startsWith("/")) return { path: h, external: false };
  return { path: `/${h}`, external: false };
}

function padUnit(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export default function Home() {
  const { content } = useSiteContent();
  const heroFallback = content["public.home_hero_fallback"] ?? "";
  const featuredTitle = (content["public.home_featured_title"] ?? "").trim();
  const bestsellersTitle = (content["public.home_bestsellers_title"] ?? "").trim();
  const bestsellersHeading = bestsellersTitle || "Mais vendidos";
  const featuredHeading = featuredTitle || "Em destaque na plataforma";
  const catRailTitle = (content["public.home_category_rail_title"] ?? "").trim() || "Explore por categoria";
  const t1 = parseTrustCell(content["public.trust_strip_1"] ?? "");
  const t2 = parseTrustCell(content["public.trust_strip_2"] ?? "");
  const t3 = parseTrustCell(content["public.trust_strip_3"] ?? "");
  const t4 = parseTrustCell(content["public.trust_strip_4"] ?? "");
  const flashEnabled = parseSiteTruthy(content["public.home_flash_deals_enabled"], "true");
  const flashTitle =
    (content["public.home_flash_deals_title"] ?? "").trim() || "Ofertas do dia · preços rebaixados";
  const flashSubtitle =
    (content["public.home_flash_deals_subtitle"] ?? "").trim() ||
    "Artigos em promoção com preço clarificado em kwanzas. Oferta sujeita a stock.";
  const flashEndAtRaw = (content["public.home_flash_deals_end_at"] ?? "").trim();
  const flashCtaRaw = (content["public.home_flash_deals_cta"] ?? "").trim() || "Ver todas as promoções";
  const flashExplore = resolveFlashExplore(content["public.home_flash_deals_link"] ?? "");
  const pulseTags = splitPipeTags(content["public.home_pulse_tags"]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bi, setBi] = useState(0);
  const [cats, setCats] = useState<Category[]>([]);
  const [megaOpen, setMegaOpen] = useState(false);
  const [activeRootId, setActiveRootId] = useState<string>("");
  const [megaProducts, setMegaProducts] = useState<Record<string, MegaProduct[]>>({});
  const [megaLoading, setMegaLoading] = useState(false);
  const [featured, setFeatured] = useState<ProductCardData[]>([]);
  const [top, setTop] = useState<ProductCardData[]>([]);
  const [recent, setRecent] = useState<ProductCardData[]>([]);
  const [homeGroups, setHomeGroups] = useState<HomeGroupBlock[]>([]);
  const [homeGroupsLoaded, setHomeGroupsLoaded] = useState(false);
  const [flashDeals, setFlashDeals] = useState<ProductCardData[]>([]);
  const flashCountdown = useFlashDealCountdown(flashEnabled ? flashEndAtRaw : undefined);

  useSeo({
    title: "BAZAR DO BIÉ — Marketplace em Angola",
    description:
      "Compre online em kwanzas angolanos com lojas parceiras verificadas, envio nacional e acompanhamento de encomendas.",
    canonicalPath: "/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "BAZAR DO BIÉ",
      url: window.location.origin,
      potentialAction: {
        "@type": "SearchAction",
        target: `${window.location.origin}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  });

  useEffect(() => {
    void apiFetch<Banner[]>("/banners").then(setBanners).catch(() => setBanners([]));
  }, []);
  useEffect(() => {
    void apiFetch<Category[]>("/categories").then(setCats).catch(() => setCats([]));
  }, []);
  useEffect(() => {
    void apiFetch<{ groups: HomeGroupBlock[] }>("/homepage/product-groups")
      .then((r) => setHomeGroups(Array.isArray(r.groups) ? r.groups : []))
      .catch(() => setHomeGroups([]))
      .finally(() => setHomeGroupsLoaded(true));
  }, []);
  useEffect(() => {
    void apiFetch<{ items: ProductCardData[] }>("/products?featured=true&take=10")
      .then((r) => setFeatured(r.items))
      .catch(() => setFeatured([]));
  }, []);
  useEffect(() => {
    void apiFetch<{ items: ProductCardData[] }>("/products?sort=mais_vendidos&take=10")
      .then((r) => setTop(r.items))
      .catch(() => setTop([]));
  }, []);
  useEffect(() => {
    void apiFetch<{ items: ProductCardData[] }>("/products?sort=recentes&take=12")
      .then((r) => setRecent(r.items))
      .catch(() => setRecent([]));
  }, []);

  useEffect(() => {
    if (!flashEnabled) return;
    void apiFetch<{ items: ProductCardData[] }>("/products?onSale=true&sort=preco_asc&take=14")
      .then((r) => setFlashDeals(Array.isArray(r.items) ? r.items : []))
      .catch(() => setFlashDeals([]));
  }, [flashEnabled]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setBi((i) => (i + 1) % banners.length), 5500);
    return () => clearInterval(t);
  }, [banners.length]);

  const roots = useMemo(() => cats.filter((c) => !c.parentId).slice(0, 24), [cats]);
  const byParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of cats) {
      if (!c.parentId) continue;
      const list = map.get(c.parentId) ?? [];
      list.push(c);
      map.set(c.parentId, list);
    }
    return map;
  }, [cats]);
  const activeRoot = roots.find((r) => r.id === activeRootId) ?? roots[0];
  const activeChildren = activeRoot ? byParent.get(activeRoot.id) ?? [] : [];

  useEffect(() => {
    if (!roots.length) return;
    setActiveRootId((prev) => prev || roots[0].id);
  }, [roots]);

  useEffect(() => {
    if (!activeRootId || megaProducts[activeRootId]) return;
    setMegaLoading(true);
    void apiFetch<{ items: MegaProduct[] }>(
      `/products?categoryId=${encodeURIComponent(activeRootId)}&sort=mais_vendidos&take=8`,
    )
      .then((r) => setMegaProducts((prev) => ({ ...prev, [activeRootId]: r.items ?? [] })))
      .catch(() => setMegaProducts((prev) => ({ ...prev, [activeRootId]: [] })))
      .finally(() => setMegaLoading(false));
  }, [activeRootId, megaProducts]);

  const hero = banners[bi];

  function groupExploreHref(slug: string): string {
    if (slug === "SUPER_OFERTAS") return "/search?featured=true&sort=mais_vendidos";
    if (slug === "PRODUTOS_DESCONTO") return "/search?onSale=true&sort=preco_asc";
    return "/search";
  }

  function groupExploreLabel(slug: string): string {
    if (slug === "SUPER_OFERTAS") return "Explorar selecção em destaque";
    if (slug === "PRODUTOS_DESCONTO") return "Ver todas as promoções";
    return "Abrir catálogo";
  }

  return (
    <>
      <div className="ae-home-stage">
        <div className="ae-hero ae-hero--home-top ae-hero--premium">
          <div className="ae-hero-main">
            {hero ? (
              hero.linkUrl ? (
                <a href={hero.linkUrl} className="ae-hero-media">
                  <img
                    src={resolveMediaUrl(hero.imageUrl)}
                    alt={hero.title ?? "Campanha em destaque no BAZAR DO BIÉ"}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                </a>
              ) : (
                <div className="ae-hero-media">
                  <img
                    src={resolveMediaUrl(hero.imageUrl)}
                    alt={hero.title ?? "Campanha em destaque no BAZAR DO BIÉ"}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                </div>
              )
            ) : (
              <div className="ae-hero-placeholder" role="status">
                {heroFallback}
              </div>
            )}
            {banners.length > 1 ? (
              <div className="ae-hero-dots" role="tablist" aria-label="Seleccionar banner">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === bi}
                    aria-label={`Banner ${i + 1} de ${banners.length}`}
                    className={i === bi ? "ae-hero-dot ae-hero-dot--on" : "ae-hero-dot"}
                    onClick={() => setBi(i)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <section className="ae-shell ae-home-quick" aria-label="Atalhos de navegação do catálogo">
        <nav className="ae-home-quick__track">
          <Link className="ae-home-quick__pill ae-home-quick__pill--accent" to="/search?sort=recentes">
            Últimos lançamentos
          </Link>
          <Link className="ae-home-quick__pill" to="/search?onSale=true&sort=preco_asc">
            Ofertas e promoções
          </Link>
          <Link className="ae-home-quick__pill" to="/search?featured=true">
            Selecção editorial
          </Link>
          <Link className="ae-home-quick__pill" to="/search?sort=mais_vendidos">
            Mais populares
          </Link>
        </nav>
      </section>

      {pulseTags.length > 0 ? (
        <section className="ae-shell ae-home-pulse" aria-label="Vantagens do marketplace">
          <ul className="ae-home-pulse__list">
            {pulseTags.map((tag, i) => (
              <li key={`${i}-${tag}`}>{tag}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {flashEnabled ? (
        <section
          className="ae-shell ae-home-flash"
          aria-labelledby="ae-home-flash-title"
          aria-describedby="ae-home-flash-dek"
        >
          <div className="ae-home-flash__surface">
            <div className="ae-home-flash__hero">
              <div className="ae-home-flash__lead">
                <p className="ae-home-flash__eyebrow">Ofertas do dia · marketplace nacional</p>
                <h2 id="ae-home-flash-title" className="ae-home-flash__title">
                  {flashTitle}
                </h2>
                <p id="ae-home-flash-dek" className="ae-home-flash__dek">
                  {flashSubtitle}
                </p>
              </div>
              <div className="ae-home-flash__aside">
                {flashCountdown !== null ? (
                  flashCountdown.totalMs > 0 ? (
                    <div className="ae-home-flash__timer" aria-live="polite" aria-atomic="true">
                      {flashCountdown.days > 0 ? (
                        <div className="ae-home-flash__unit">
                          <span className="ae-home-flash__unit-val">{flashCountdown.days}</span>
                          <span className="ae-home-flash__unit-lbl">dias</span>
                        </div>
                      ) : null}
                      <div className="ae-home-flash__unit">
                        <span className="ae-home-flash__unit-val">{padUnit(flashCountdown.hours)}</span>
                        <span className="ae-home-flash__unit-lbl">horas</span>
                      </div>
                      <div className="ae-home-flash__unit">
                        <span className="ae-home-flash__unit-val">{padUnit(flashCountdown.minutes)}</span>
                        <span className="ae-home-flash__unit-lbl">min</span>
                      </div>
                      <div className="ae-home-flash__unit">
                        <span className="ae-home-flash__unit-val">{padUnit(flashCountdown.seconds)}</span>
                        <span className="ae-home-flash__unit-lbl">seg</span>
                      </div>
                    </div>
                  ) : (
                    <p className="ae-home-flash__timer-note">
                      Esta janela de contagem terminou — as promoções do catálogo continuam activas para consulta e
                      encomenda.
                    </p>
                  )
                ) : null}
                {flashExplore.external ? (
                  <a className="ae-home-flash__btn" href={flashExplore.path} rel="noopener noreferrer">
                    {flashCtaRaw}
                  </a>
                ) : (
                  <Link className="ae-home-flash__btn" to={flashExplore.path}>
                    {flashCtaRaw}
                  </Link>
                )}
              </div>
            </div>
            <div className="ae-home-flash__rail-panel">
              {flashDeals.length > 0 ? (
                <div className="ae-home-flash__scroller" role="list">
                  {flashDeals.map((p) => (
                    <div key={`flash-${p.id}`} className="ae-home-flash__cell" role="listitem">
                      <ProductCard p={p} className="ae-pcard--spotlight ae-pcard--flash-rail" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ae-home-flash__rail-empty">
                  Não há artigos públicos marcados como promoção neste momento — explore o{" "}
                  <Link className="ae-home-flash__inline-link" to="/search?onSale=true">
                    catálogo filtrado
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {roots.length > 0 ? (
        <section
          className="ae-shell ae-home-cats"
          onMouseLeave={() => setMegaOpen(false)}
          aria-label={catRailTitle}
        >
          <header className="ae-home-cats__masthead">
            <h2 className="ae-home-cat-rail__title">{catRailTitle}</h2>
            <span className="ae-home-cat-rail__kicker">Seleccione uma categoria</span>
          </header>
          <div className="ae-home-cat-rail__viewport">
            <div className="ae-home-cat-rail__track" role="list">
              {roots.map((c) => (
                <div
                  key={c.id}
                  role="listitem"
                  className={`ae-home-cat-rail__cell ${activeRootId === c.id ? "ae-home-cat-rail__cell--on" : ""}`}
                  onMouseEnter={() => {
                    setActiveRootId(c.id);
                    setMegaOpen(true);
                  }}
                  onFocus={() => {
                    setActiveRootId(c.id);
                    setMegaOpen(true);
                  }}
                >
                  <Link
                    to={`/search?categoryId=${c.id}`}
                    className="ae-home-cat-rail__card"
                    aria-label={`Explorar categoria «${c.name}»`}
                    onFocus={() => {
                      setActiveRootId(c.id);
                      setMegaOpen(true);
                    }}
                  >
                    <span className="ae-home-cat-rail__img-shell">
                      {c.imageUrl ? (
                        <img
                          src={resolveMediaUrl(c.imageUrl)}
                          alt=""
                          className="ae-home-cat-rail__img"
                          loading="lazy"
                          decoding="async"
                          aria-hidden
                        />
                      ) : (
                        <span className="ae-home-cat-rail__ph" aria-hidden />
                      )}
                    </span>
                    <span className="ae-home-cat-rail__label">{c.name}</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div
            role="region"
            aria-live="polite"
            aria-label="Subcategorias e exemplos da categoria sob o cursor"
            className={`ae-home-mega ${megaOpen ? "ae-home-mega--open" : ""}`}
          >
            <div className="ae-home-mega__left">
              <h3>{activeRoot?.name ?? "Categorias"}</h3>
              {activeRoot?.imageUrl ? (
                <div className="ae-home-mega__hero">
                  <img
                    src={resolveMediaUrl(activeRoot.imageUrl)}
                    alt=""
                    decoding="async"
                    loading="lazy"
                    aria-hidden
                  />
                </div>
              ) : null}
              <nav className="ae-home-mega__children" aria-label="Subcategorias">
                {activeChildren.slice(0, 12).map((child) => (
                  <Link key={child.id} to={`/search?categoryId=${child.id}`}>
                    {child.name}
                  </Link>
                ))}
                <Link className="ae-home-mega__children-all" to={activeRoot ? `/search?categoryId=${activeRoot.id}` : "/search"}>
                  Ver tudo nesta categoria
                </Link>
              </nav>
            </div>
            <div className="ae-home-mega__right">
              <h3>Produtos populares nesta área</h3>
              {megaLoading && !megaProducts[activeRootId] ? (
                <div className="ae-home-mega__products ae-home-mega__products--skeleton">
                  {Array.from({ length: 8 }).map((_, sx) => (
                    <div key={sx} className="ae-skel ae-skel-mega-product" aria-hidden />
                  ))}
                </div>
              ) : null}
              {!megaLoading && (megaProducts[activeRootId]?.length ?? 0) === 0 ? (
                <p className="ae-home-mega__state ae-home-mega__state--empty">Sem exemplos públicos nesta categoria neste momento.</p>
              ) : null}
              {!megaLoading && (megaProducts[activeRootId]?.length ?? 0) > 0 ? (
                <div className="ae-home-mega__products">
                  {(megaProducts[activeRootId] ?? []).slice(0, 8).map((p) => (
                    <Link key={p.id} className="ae-home-mega__product" to={`/product/${p.id}`}>
                      <span className="ae-home-mega__product-thumb">
                        <img src={resolveMediaUrl(p.images?.[0]?.url)} alt="" loading="lazy" decoding="async" />
                      </span>
                      <span className="ae-home-mega__product-copy">{p.name}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="ae-shell ae-trust-shell ae-trust-shell--premium">
        <div className="ae-trust-strip ae-trust-strip--premium">
          <div className="ae-trust-strip__item">
            <strong>{t1.title}</strong>
            {t1.body}
          </div>
          <div className="ae-trust-strip__item">
            <strong>{t2.title}</strong>
            {t2.body}
          </div>
          <div className="ae-trust-strip__item">
            <strong>{t3.title}</strong>
            {t3.body}
          </div>
          <div className="ae-trust-strip__item">
            <strong>{t4.title}</strong>
            {t4.body}
          </div>
        </div>
      </section>

      {!homeGroupsLoaded ? (
        <section className="ae-section ae-home-group-strip ae-home-group-strip--skeleton-shell" aria-busy="true">
          <div className="ae-home-group-strip__head-skel ae-skel" />
          <div className="ae-grid ae-home-group-strip__grid-skel">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ae-skel ae-skel-pcard" />
            ))}
          </div>
        </section>
      ) : null}
      {homeGroupsLoaded &&
        homeGroups
          .filter((g) => g.items?.length > 0)
          .map((g) => (
            <section key={g.slug} className="ae-section ae-home-group-strip">
              <div className="ae-home-group-strip__header">
                <div className="ae-home-group-strip__titles">
                  <p className="ae-home-group-strip__slug" aria-hidden>
                    Curadoria
                  </p>
                  <div className="ae-section__head ae-section__head--stack ae-section__head--group">
                    <h2>{g.title}</h2>
                    {g.subtitle ? (
                      <p className="ae-home-group-strip__subtitle">{g.subtitle}</p>
                    ) : null}
                  </div>
                </div>
                <Link className="ae-home-group-strip__cta" to={groupExploreHref(g.slug)}>
                  {groupExploreLabel(g.slug)}
                </Link>
              </div>
              <div className="ae-grid ae-home-group-strip__grid">
                {g.items.map((p) => (
                  <ProductCard key={`${g.slug}-${p.id}`} p={p} className="ae-pcard--spotlight" />
                ))}
              </div>
            </section>
          ))}

      <section className="ae-section ae-section--catalog">
        <header className="ae-section__masthead">
          <div className="ae-section__masthead-copy">
            <h2>Novidades no catálogo</h2>
            <p className="ae-section__dek">Últimas referências disponíveis na plataforma.</p>
          </div>
          <div className="ae-section__masthead-actions">
            <Link className="ae-section__cta ae-section__cta--ghost" to="/search?sort=recentes">
              Ver catálogo completo
            </Link>
            <Link className="ae-section__link" to="/search?onSale=true&sort=preco_asc">
              Ver apenas promoções
            </Link>
          </div>
        </header>
        <div className="ae-grid">
          {recent.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      <section className="ae-section ae-section--catalog">
        <header className="ae-section__masthead">
          <div className="ae-section__masthead-copy">
            <h2>{featuredHeading}</h2>
            <p className="ae-section__dek">Recomendações destacadas pela equipa e parceiros.</p>
          </div>
          <div className="ae-section__masthead-actions">
            <Link className="ae-section__cta ae-section__cta--ghost" to="/search?featured=true">
              Ver selecção completa
            </Link>
            <Link className="ae-section__link" to="/search?onSale=true">
              Poupar em promoções
            </Link>
          </div>
        </header>
        <div className="ae-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      <section className="ae-section ae-section--catalog">
        <header className="ae-section__masthead">
          <div className="ae-section__masthead-copy">
            <h2>{bestsellersHeading}</h2>
            <p className="ae-section__dek">
              Produtos com maior número de vendas registadas na plataforma — referências comprovadas por compradores.
            </p>
          </div>
          <div className="ae-section__masthead-actions">
            <Link className="ae-section__cta ae-section__cta--ghost" to="/search?sort=mais_vendidos">
              Ver ranking global
            </Link>
            <Link className="ae-section__link" to="/search?sort=recentes">
              Ver novidades
            </Link>
          </div>
        </header>
        <div className="ae-grid">
          {top.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>
    </>
  );
}
