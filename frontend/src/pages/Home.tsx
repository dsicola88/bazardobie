import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { ProductCard, type ProductCardData } from "../components/ProductCard.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import { parseTrustCell } from "../site/siteContent.js";
import { resolveMediaUrl } from "../utils/media.js";
import { useSeo } from "../seo/useSeo.js";

type Banner = { id: string; title?: string | null; imageUrl: string; linkUrl?: string | null };
type Category = { id: string; name: string; imageUrl?: string | null; parentId: string | null };
type MegaProduct = { id: string; name: string; images?: { url: string }[] };

export default function Home() {
  const { content } = useSiteContent();
  const heroFallback = content["public.home_hero_fallback"] ?? "";
  const featuredTitle = content["public.home_featured_title"] ?? "";
  const bestsellersTitle = content["public.home_bestsellers_title"] ?? "";
  const t1 = parseTrustCell(content["public.trust_strip_1"] ?? "");
  const t2 = parseTrustCell(content["public.trust_strip_2"] ?? "");
  const t3 = parseTrustCell(content["public.trust_strip_3"] ?? "");
  const t4 = parseTrustCell(content["public.trust_strip_4"] ?? "");
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
    if (banners.length <= 1) return;
    const t = setInterval(() => setBi((i) => (i + 1) % banners.length), 5500);
    return () => clearInterval(t);
  }, [banners.length]);

  const roots = useMemo(() => cats.filter((c) => !c.parentId).slice(0, 12), [cats]);
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
    void apiFetch<{ items: MegaProduct[] }>(`/products?categoryId=${encodeURIComponent(activeRootId)}&sort=mais_vendidos&take=8`)
      .then((r) => setMegaProducts((prev) => ({ ...prev, [activeRootId]: r.items ?? [] })))
      .catch(() => setMegaProducts((prev) => ({ ...prev, [activeRootId]: [] })))
      .finally(() => setMegaLoading(false));
  }, [activeRootId, megaProducts]);

  const hero = banners[bi];

  return (
    <>
      <section className="ae-shell ae-home-cats" onMouseLeave={() => setMegaOpen(false)}>
        <div className="ae-home-cats__row">
          {roots.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`ae-home-cats__item ${activeRootId === c.id ? "ae-home-cats__item--on" : ""}`}
              onMouseEnter={() => {
                setActiveRootId(c.id);
                setMegaOpen(true);
              }}
              onFocus={() => {
                setActiveRootId(c.id);
                setMegaOpen(true);
              }}
            >
              <span className="ae-home-cats__item-in">
                {c.imageUrl ? (
                  <img
                    className="ae-home-cats__item-img"
                    src={resolveMediaUrl(c.imageUrl)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    aria-hidden
                  />
                ) : (
                  <span className="ae-home-cats__item-dot" aria-hidden />
                )}
                <span>{c.name}</span>
              </span>
            </button>
          ))}
        </div>
        <div className={`ae-home-mega ${megaOpen ? "ae-home-mega--open" : ""}`}>
          <div className="ae-home-mega__left">
            <h3>{activeRoot?.name ?? "Categorias"}</h3>
            {activeRoot?.imageUrl ? (
              <div className="ae-home-mega__hero">
                <img src={resolveMediaUrl(activeRoot.imageUrl)} alt={activeRoot.name} loading="lazy" decoding="async" />
              </div>
            ) : null}
            <div className="ae-home-mega__children">
              {activeChildren.slice(0, 12).map((child) => (
                <Link key={child.id} to={`/search?categoryId=${child.id}`}>
                  {child.name}
                </Link>
              ))}
              <Link to={activeRoot ? `/search?categoryId=${activeRoot.id}` : "/search"}>Ver tudo nesta categoria</Link>
            </div>
          </div>
          <div className="ae-home-mega__right">
            <h3>Produtos em destaque</h3>
            {megaLoading && !megaProducts[activeRootId] ? <div className="ae-home-mega__state">A carregar produtos…</div> : null}
            {!megaLoading && (megaProducts[activeRootId]?.length ?? 0) === 0 ? (
              <div className="ae-home-mega__state">Sem produtos nesta categoria por agora.</div>
            ) : null}
            <div className="ae-home-mega__products">
              {(megaProducts[activeRootId] ?? []).slice(0, 8).map((p) => (
                <Link key={p.id} className="ae-home-mega__product" to={`/product/${p.id}`}>
                  <img src={resolveMediaUrl(p.images?.[0]?.url)} alt={p.name} loading="lazy" decoding="async" />
                  <span>{p.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="ae-hero">
        <div className="ae-hero-main">
          {hero ? (
            hero.linkUrl ? (
              <a href={hero.linkUrl}>
                <img
                  src={resolveMediaUrl(hero.imageUrl)}
                  alt={hero.title ?? ""}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </a>
            ) : (
              <img
                src={resolveMediaUrl(hero.imageUrl)}
                alt={hero.title ?? ""}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            )
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {heroFallback}
            </div>
          )}
          {banners.length > 1 ? (
            <div className="ae-hero-dots">
              {banners.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={i === bi ? "ae-hero-dot ae-hero-dot--on" : "ae-hero-dot"}
                  onClick={() => setBi(i)}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <section className="ae-shell" style={{ marginTop: 14 }}>
        <div className="ae-trust-strip">
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

      <section className="ae-section">
        <div className="ae-section__head">
          <h2>Novidades no catálogo</h2>
          <Link className="ae-section__more" to="/search?sort=recentes">
            Ver todas as referências
          </Link>
        </div>
        <div className="ae-grid">
          {recent.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      <section className="ae-section">
        <div className="ae-section__head">
          <h2>{featuredTitle}</h2>
          <Link className="ae-section__more" to="/search?featured=true">
            Ver selecção completa
          </Link>
        </div>
        <div className="ae-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      <section className="ae-section">
        <div className="ae-section__head">
          <h2>{bestsellersTitle}</h2>
          <Link className="ae-section__more" to="/search?sort=mais_vendidos">
            Ver classificação
          </Link>
        </div>
        <div className="ae-grid">
          {top.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>
    </>
  );
}
