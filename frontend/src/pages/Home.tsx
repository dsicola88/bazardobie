import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { ProductCard, type ProductCardData } from "../components/ProductCard.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import { parseTrustCell } from "../site/siteContent.js";
import { resolveMediaUrl } from "../utils/media.js";

type Banner = { id: string; title?: string | null; imageUrl: string; linkUrl?: string | null };
type Category = { id: string; name: string; parentId: string | null };

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
  const [catsOpen, setCatsOpen] = useState(true);
  const [featured, setFeatured] = useState<ProductCardData[]>([]);
  const [top, setTop] = useState<ProductCardData[]>([]);
  const [recent, setRecent] = useState<ProductCardData[]>([]);

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

  const roots = cats.filter((c) => !c.parentId).slice(0, 14);

  const hero = banners[bi];

  return (
    <>
      <div className="ae-hero">
        <nav className="ae-hero-side" aria-label="Categorias">
          <button type="button" className="ae-hero-side__toggle" onClick={() => setCatsOpen((v) => !v)}>
            {catsOpen ? "Encolher categorias" : "Expandir categorias"}
          </button>
          <div className={catsOpen ? "ae-hero-side__body" : "ae-hero-side__body ae-hero-side__body--collapsed"}>
            {roots.map((c) => (
              <Link key={c.id} to={`/search?categoryId=${c.id}`}>
                {c.name}
              </Link>
            ))}
            <Link to="/search">Catálogo por categoria →</Link>
          </div>
        </nav>
        <div className="ae-hero-main">
          {hero ? (
            hero.linkUrl ? (
              <a href={hero.linkUrl}>
                <img src={resolveMediaUrl(hero.imageUrl)} alt={hero.title ?? ""} />
              </a>
            ) : (
              <img src={resolveMediaUrl(hero.imageUrl)} alt={hero.title ?? ""} />
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
