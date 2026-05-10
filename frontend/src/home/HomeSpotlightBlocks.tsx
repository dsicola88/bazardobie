import { useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../utils/media.js";

export type HomeSpotlightPublicTile = {
  id: string;
  imageUrl: string;
  label?: string | null;
  href: string;
  captionBg?: string | null;
};

export type HomeSpotlightPublicSection = {
  slug: string;
  title: string;
  subtitle?: string | null;
  layout: string;
  cardAccent?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  tiles: HomeSpotlightPublicTile[];
};

function resolveTileHref(hrefRaw: string): { path: string; external: boolean } {
  const h = hrefRaw.trim();
  if (/^https?:\/\//i.test(h)) return { path: h, external: true };
  if (h.startsWith("/")) return { path: h, external: false };
  return { path: `/${h}`, external: false };
}

function resolveSpotlightCta(s: HomeSpotlightPublicSection): { label: string; path: string; external: boolean } | null {
  const label = (s.ctaLabel ?? "").trim();
  const raw = (s.ctaHref ?? "").trim();
  if (!label && !raw) return null;
  const lbl = label || "Ver mais";
  if (!raw) return { label: lbl, path: "/search", external: false };
  const link = resolveTileHref(raw);
  return { label: lbl, path: link.path, external: link.external };
}

function SpotlightTileLink({
  tile,
  className,
  children,
}: {
  tile: HomeSpotlightPublicTile;
  className?: string;
  children: ReactNode;
}) {
  const dest = resolveTileHref(tile.href);
  if (dest.external) {
    return (
      <a className={className} href={dest.path} rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link className={className} to={dest.path}>
      {children}
    </Link>
  );
}

export function HomeSpotlightBlocks({ sections }: { sections: HomeSpotlightPublicSection[] }) {
  const visible = sections.filter((s) => s.tiles?.length > 0);
  if (!visible.length) return null;

  return (
    <>
      {visible.map((s) => (
        <HomeSpotlightSection key={s.slug} section={s} />
      ))}
    </>
  );
}

function HomeSpotlightSection({ section }: { section: HomeSpotlightPublicSection }) {
  const cta = resolveSpotlightCta(section);
  const accent = (section.cardAccent ?? "").trim();

  return (
    <section className="ae-shell ae-home-spotlight" aria-labelledby={`ae-spot-${section.slug}`}>
      <header className="ae-home-spotlight__masthead">
        <div className="ae-home-spotlight__titles">
          <p className="ae-home-spotlight__eyebrow" aria-hidden>
            Destaque
          </p>
          <h2 id={`ae-spot-${section.slug}`}>{section.title}</h2>
          {section.subtitle ? <p className="ae-home-spotlight__dek">{section.subtitle}</p> : null}
        </div>
        {cta ? (
          cta.external ? (
            <a className="ae-home-spotlight__cta" href={cta.path} rel="noopener noreferrer">
              {cta.label}
            </a>
          ) : (
            <Link className="ae-home-spotlight__cta" to={cta.path}>
              {cta.label}
            </Link>
          )
        ) : null}
      </header>

      {section.layout === "ROW_SCROLL" ? (
        <SpotlightRowScroll tiles={section.tiles} accent={accent || undefined} />
      ) : section.layout === "HERO_THREE" ? (
        <SpotlightHeroThree tiles={section.tiles} accent={accent || undefined} />
      ) : (
        <SpotlightGrid tiles={section.tiles} accent={accent || undefined} />
      )}
    </section>
  );
}

function SpotlightGrid({ tiles, accent }: { tiles: HomeSpotlightPublicTile[]; accent?: string }) {
  const shellStyle = accent ? ({ ["--ae-home-spotlight-accent" as string]: accent } as CSSProperties) : undefined;
  return (
    <div className="ae-home-spotlight__grid-wrap" style={shellStyle}>
      <div className="ae-home-spotlight__grid" role="list">
        {tiles.map((t) => (
          <article key={t.id} className="ae-home-spotlight__card" role="listitem">
            <SpotlightTileLink tile={t} className="ae-home-spotlight__card-hit">
              <span className="ae-home-spotlight__img-shell">
                <img src={resolveMediaUrl(t.imageUrl)} alt="" loading="lazy" decoding="async" />
              </span>
              {t.label ? (
                <span
                  className="ae-home-spotlight__caption"
                  style={t.captionBg ? { background: t.captionBg } : undefined}
                >
                  {t.label}
                </span>
              ) : null}
            </SpotlightTileLink>
          </article>
        ))}
      </div>
    </div>
  );
}

function SpotlightHeroThree({ tiles, accent }: { tiles: HomeSpotlightPublicTile[]; accent?: string }) {
  const [hero, ...rest] = tiles;
  const shellStyle = accent ? ({ ["--ae-home-spotlight-accent" as string]: accent } as CSSProperties) : undefined;
  if (!hero) return null;
  const side = rest.slice(0, 3);

  return (
    <div className="ae-home-spotlight__hero-wrap" style={shellStyle}>
      <div className="ae-home-spotlight__hero-grid">
        <article className="ae-home-spotlight__hero-main">
          <SpotlightTileLink tile={hero} className="ae-home-spotlight__card-hit ae-home-spotlight__card-hit--hero">
            <span className="ae-home-spotlight__img-shell">
              <img src={resolveMediaUrl(hero.imageUrl)} alt="" loading="lazy" decoding="async" />
            </span>
            {hero.label ? (
              <span
                className="ae-home-spotlight__caption"
                style={hero.captionBg ? { background: hero.captionBg } : undefined}
              >
                {hero.label}
              </span>
            ) : null}
          </SpotlightTileLink>
        </article>
        <div className="ae-home-spotlight__hero-stack" role="list">
          {side.map((t) => (
            <article key={t.id} className="ae-home-spotlight__card ae-home-spotlight__card--compact" role="listitem">
              <SpotlightTileLink tile={t} className="ae-home-spotlight__card-hit">
                <span className="ae-home-spotlight__img-shell">
                  <img src={resolveMediaUrl(t.imageUrl)} alt="" loading="lazy" decoding="async" />
                </span>
                {t.label ? (
                  <span
                    className="ae-home-spotlight__caption"
                    style={t.captionBg ? { background: t.captionBg } : undefined}
                  >
                    {t.label}
                  </span>
                ) : null}
              </SpotlightTileLink>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpotlightRowScroll({ tiles, accent }: { tiles: HomeSpotlightPublicTile[]; accent?: string }) {
  const railRef = useRef<HTMLDivElement>(null);

  const scrollBy = useCallback((dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    const w = Math.min(380, el.clientWidth * 0.82);
    el.scrollBy({ left: dir * w, behavior: "smooth" });
  }, []);

  const shellStyle = accent ? ({ ["--ae-home-spotlight-accent" as string]: accent } as CSSProperties) : undefined;

  return (
    <div className="ae-home-spotlight__row-wrap" style={shellStyle}>
      <div className="ae-home-spotlight__row-controls">
        <button type="button" className="ae-home-spotlight__row-btn" aria-label="Deslocar para a esquerda" onClick={() => scrollBy(-1)}>
          ‹
        </button>
        <button type="button" className="ae-home-spotlight__row-btn" aria-label="Deslocar para a direita" onClick={() => scrollBy(1)}>
          ›
        </button>
      </div>
      <div ref={railRef} className="ae-home-spotlight__row-rail" tabIndex={0} role="list">
        {tiles.map((t) => (
          <article key={t.id} className="ae-home-spotlight__row-cell" role="listitem">
            <SpotlightTileLink tile={t} className="ae-home-spotlight__card-hit ae-home-spotlight__card-hit--rail">
              <span className="ae-home-spotlight__img-shell">
                <img src={resolveMediaUrl(t.imageUrl)} alt="" loading="lazy" decoding="async" />
              </span>
              {t.label ? (
                <span
                  className="ae-home-spotlight__caption"
                  style={t.captionBg ? { background: t.captionBg } : undefined}
                >
                  {t.label}
                </span>
              ) : null}
            </SpotlightTileLink>
          </article>
        ))}
      </div>
    </div>
  );
}
