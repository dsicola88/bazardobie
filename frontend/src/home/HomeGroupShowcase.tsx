import { useCallback, useMemo, useRef, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useSiteContent } from "../site/SiteContentContext.js";
import { useFlashDealCountdown } from "./useFlashDealCountdown.js";
import { OfferShowcaseTile } from "./OfferShowcaseTile.js";

export type HomeGroupPublicBlock = {
  slug: string;
  title: string;
  subtitle?: string | null;
  layoutStyle: string;
  badgeType: string;
  badgeText?: string | null;
  badgeEndAt?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  productCardEmphasis: string;
  items: ProductCardData[];
};

function padUnit(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function defaultCtaLabel(slug: string): string {
  if (slug === "SUPER_OFERTAS") return "Ver coleção";
  if (slug === "PRODUTOS_DESCONTO") return "Ver promoções";
  return "Ver mais";
}

function defaultCtaHref(slug: string): { path: string; external: boolean } {
  if (slug === "SUPER_OFERTAS") return { path: "/search?featured=true&sort=mais_vendidos", external: false };
  if (slug === "PRODUTOS_DESCONTO") return { path: "/search?onSale=true&sort=preco_asc", external: false };
  return { path: "/search", external: false };
}

function resolveGroupCta(g: HomeGroupPublicBlock): { label: string; path: string; external: boolean } {
  const label = (g.ctaLabel ?? "").trim() || defaultCtaLabel(g.slug);
  const raw = (g.ctaHref ?? "").trim();
  if (!raw) {
    const d = defaultCtaHref(g.slug);
    return { label, path: d.path, external: d.external };
  }
  if (/^https?:\/\//i.test(raw)) return { label, path: raw, external: true };
  if (raw.startsWith("/")) return { label, path: raw, external: false };
  return { label, path: `/${raw}`, external: false };
}

/** CTAs da vitrine (reutilizado pelo modo grelha). */
export function resolveHomeGroupCta(g: HomeGroupPublicBlock): { label: string; path: string; external: boolean } {
  return resolveGroupCta(g);
}

export function HomeGroupShowcase({ group }: { group: HomeGroupPublicBlock }) {
  const railRef = useRef<HTMLDivElement>(null);
  const { content } = useSiteContent();
  const showcaseCardStyle = useMemo((): CSSProperties => {
    const next: Record<string, string> = {};
    const card = (content["public.home_showcase_card_bg"] ?? "").trim();
    const head = (content["public.home_showcase_head_bg"] ?? "").trim();
    if (card) next["--ae-home-showcase-card-bg"] = card;
    if (head) next["--ae-home-showcase-head-bg"] = head;
    return next as CSSProperties;
  }, [content["public.home_showcase_card_bg"], content["public.home_showcase_head_bg"]]);
  const emphasis = (group.productCardEmphasis ?? "BALANCED") as "BALANCED" | "DISCOUNT" | "RATING";
  const cd = useFlashDealCountdown(group.badgeType === "TIMER" ? group.badgeEndAt ?? undefined : undefined);
  const cta = resolveGroupCta(group);

  const scrollBy = useCallback((dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    const w = Math.min(420, el.clientWidth * 0.85);
    el.scrollBy({ left: dir * w, behavior: "smooth" });
  }, []);

  return (
    <section className="ae-home-showcase" aria-labelledby={`ae-showcase-${group.slug}`}>
      <div className="ae-home-showcase__card" style={showcaseCardStyle}>
        <header className="ae-home-showcase__head">
          <div className="ae-home-showcase__lead">
            <h2 id={`ae-showcase-${group.slug}`} className="ae-home-showcase__title">
              {group.title}
            </h2>
            {group.subtitle ? <p className="ae-home-showcase__subtitle">{group.subtitle}</p> : null}
            {group.badgeType === "TEXT" && (group.badgeText ?? "").trim() ? (
              <span className="ae-home-showcase__badge ae-home-showcase__badge--text">
                <span aria-hidden>🛍</span> {group.badgeText!.trim()}
              </span>
            ) : null}
            {group.badgeType === "TIMER" && cd ? (
              <span className="ae-home-showcase__badge ae-home-showcase__badge--timer">
                <span aria-hidden>⏱</span>
                {cd.totalMs <= 0 ? (
                  <span>Promoção encerrada</span>
                ) : (
                  <span>
                    Termina em:{" "}
                    {cd.days > 0
                      ? `${cd.days}d ${padUnit(cd.hours)}:${padUnit(cd.minutes)}:${padUnit(cd.seconds)}`
                      : `${padUnit(cd.hours)}:${padUnit(cd.minutes)}:${padUnit(cd.seconds)}`}
                  </span>
                )}
              </span>
            ) : null}
          </div>
          {cta.external ? (
            <a className="ae-home-showcase__cta" href={cta.path} rel="noopener noreferrer">
              {cta.label}
              <span aria-hidden> ›</span>
            </a>
          ) : (
            <Link className="ae-home-showcase__cta" to={cta.path}>
              {cta.label}
              <span aria-hidden> ›</span>
            </Link>
          )}
        </header>

        <div className="ae-home-showcase__viewport">
          <button
            type="button"
            className="ae-home-showcase__nav ae-home-showcase__nav--prev"
            aria-label="Deslocar para a esquerda"
            onClick={() => scrollBy(-1)}
          >
            ‹
          </button>
          <div className="ae-home-showcase__rail" ref={railRef} role="list">
            {group.items.map((p) => (
              <div key={`${group.slug}-${p.id}`} className="ae-home-showcase__cell" role="listitem">
                <OfferShowcaseTile p={p} emphasis={emphasis} />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="ae-home-showcase__nav ae-home-showcase__nav--next"
            aria-label="Deslocar para a direita"
            onClick={() => scrollBy(1)}
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
