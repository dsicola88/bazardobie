import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { StarRating } from "../components/StarRating.js";
import { useSeo } from "../seo/useSeo.js";
import { resolveMediaUrl } from "../utils/media.js";
import {
  formatReviewerDisplayName,
  formatReviewDatePt,
  helpfulReviewSentence,
  reviewerAvatarInitials,
} from "../utils/reviewDisplay.js";
import type { ShopFrontOutletContext } from "./ShopPublicOutlet.js";

type ReviewSortKey = "recent" | "helpful" | "rating_desc" | "rating_asc";

type ShopReviewsSummary = {
  total: number;
  avgOverall: number | null;
  revisaoPositivaPercent: number | null;
  positivo: number;
  neutro: number;
  negativo: number;
  porEstrela: { stars: number; count: number }[];
  comFotos: number;
  comTexto: number;
};

type ShopReviewItem = {
  id: string;
  rating: number;
  ratingQuality?: number | null;
  ratingSellerCommunication?: number | null;
  ratingDelivery?: number | null;
  comment?: string | null;
  photoUrls?: string[];
  helpfulCount?: number;
  viewerMarkedHelpful?: boolean;
  createdAt: string;
  user?: { id: string; name: string | null; avatarUrl?: string | null } | null;
  product: { id: string; name: string };
};

const PAGE_SIZE = 20;

function buildQuery(opts: {
  sort: ReviewSortKey;
  skip: number;
  take: number;
  photosOnly: boolean;
  textOnly: boolean;
  rating: number | null;
}): string {
  const qs = new URLSearchParams({
    sort: opts.sort,
    take: String(opts.take),
    skip: String(opts.skip),
  });
  if (opts.photosOnly) qs.set("photosOnly", "1");
  if (opts.textOnly) qs.set("textOnly", "1");
  if (opts.rating != null) qs.set("rating", String(opts.rating));
  return qs.toString();
}

function ReviewAspectChips(props: {
  quality?: number | null;
  communication?: number | null;
  delivery?: number | null;
}) {
  const parts: string[] = [];
  if (props.quality != null) parts.push(`Artigo e descrição ${props.quality}/5`);
  if (props.communication != null) parts.push(`Comunicação ${props.communication}/5`);
  if (props.delivery != null) parts.push(`Entrega ${props.delivery}/5`);
  if (parts.length === 0) return null;
  return <p className="ae-shop-reviews-aspects-line">{parts.join(" · ")}</p>;
}

function SentimentBar(props: { label: string; count: number; total: number; tone: "pos" | "neu" | "neg" }) {
  const pct = props.total > 0 ? Math.min(100, Math.round((100 * props.count) / props.total)) : 0;
  return (
    <div className="ae-shop-reviews-sent">
      <span className="ae-shop-reviews-sent__lbl">{props.label}</span>
      <div className="ae-shop-reviews-sent__track" aria-hidden>
        <div
          className={`ae-shop-reviews-sent__fill ae-shop-reviews-sent__fill--${props.tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="ae-shop-reviews-sent__n">{props.count.toLocaleString("pt-PT")}</span>
    </div>
  );
}

type ReviewsApiResponse = {
  summary: ShopReviewsSummary;
  items: ShopReviewItem[];
  total: number;
  skip: number;
  take: number;
  sort: ReviewSortKey;
  photosOnly: boolean;
  textOnly: boolean;
  rating: number | undefined;
};

export default function ShopPublicReviews() {
  const { shopId } = useParams();
  const { token, user } = useAuth();
  const ctx = useOutletContext<ShopFrontOutletContext>();
  const m = ctx.sobre?.metricas;
  const loja = ctx.sobre?.loja;
  const nome = loja?.name ?? "Loja";

  const [sort, setSort] = useState<ReviewSortKey>("recent");
  const [photosOnly, setPhotosOnly] = useState(false);
  const [textOnly, setTextOnly] = useState(false);
  const [starFilter, setStarFilter] = useState<number | null>(null);

  const [summary, setSummary] = useState<ShopReviewsSummary | null>(null);
  const [items, setItems] = useState<ShopReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [photoLb, setPhotoLb] = useState<null | { urls: string[]; index: number }>(null);
  const [helpfulBusyId, setHelpfulBusyId] = useState<string | null>(null);

  useSeo({
    title: `${nome} — Avaliações — BAZAR DO BIÉ`,
    description: ctx.sobre ? `Opiniões verificadas de compradores sobre a loja ${nome}.` : "Avaliações da loja no BAZAR DO BIÉ.",
    canonicalPath: shopId ? `/loja/${shopId}/avaliacoes` : "/loja",
  });

  const fetchPage = useCallback(
    async (skip: number, append: boolean, signal?: { loadingMore: boolean }) => {
      if (!shopId) return;
      if (signal?.loadingMore) setLoadingMore(true);
      else setLoading(true);
      setErr(null);
      const q = buildQuery({
        sort,
        skip,
        take: PAGE_SIZE,
        photosOnly,
        textOnly,
        rating: starFilter,
      });
      try {
        const r = await apiFetch<ReviewsApiResponse>(
          `/shops/${encodeURIComponent(shopId)}/reviews?${q}`,
          token ? { token } : undefined,
        );
        setSummary(r.summary ?? null);
        setTotal(r.total ?? 0);
        if (append) setItems((prev) => [...prev, ...(r.items ?? [])]);
        else setItems(r.items ?? []);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Não foi possível carregar as avaliações.");
        if (!append) {
          setItems([]);
          setSummary(null);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [shopId, sort, photosOnly, textOnly, starFilter, token],
  );

  useEffect(() => {
    if (!shopId) return;
    void fetchPage(0, false);
  }, [shopId, sort, photosOnly, textOnly, starFilter, fetchPage]);

  const loadMore = () => {
    if (items.length >= total) return;
    void fetchPage(items.length, true, { loadingMore: true });
  };

  const resetFilters = () => {
    setPhotosOnly(false);
    setTextOnly(false);
    setStarFilter(null);
  };

  const todosActive = !photosOnly && !textOnly && starFilter == null;
  const mediaClass = (on: boolean) => `ae-shop-reviews-pill${on ? " ae-shop-reviews-pill--on" : ""}`;
  const ratingGeral = summary?.avgOverall ?? m?.avaliacaoMedia ?? null;
  const base = shopId ? `/loja/${encodeURIComponent(shopId)}` : "";
  const hasMore = items.length < total;

  const markReviewHelpful = async (reviewId: string) => {
    if (!token) return;
    setHelpfulBusyId(reviewId);
    try {
      const res = await apiFetch<{ helpfulCount: number; marked: boolean }>(`/reviews/${reviewId}/helpful`, {
        method: "POST",
        token,
      });
      setItems((prev) =>
        prev.map((x) =>
          x.id === reviewId ? { ...x, helpfulCount: res.helpfulCount, viewerMarkedHelpful: res.marked } : x,
        ),
      );
    } catch {
      // mínimo feedback
    } finally {
      setHelpfulBusyId(null);
    }
  };

  return (
    <div className="ae-storefront-body">
      <div className="ae-shop-reviews-layout">
        <aside className="page-panel ae-shop-reviews-sidebar" aria-label="Resumo da reputação da loja">
          <p className="ae-shop-reviews-sidebar__kicker">Loja parceira</p>
          <h2 className="ae-shop-reviews-sidebar__name">{nome}</h2>
          {loja ? (
            <p className="ae-shop-reviews-sidebar__loc ae-muted">
              {loja.city}, {loja.province}
            </p>
          ) : null}

          <section className="ae-shop-reviews-sidebar__block" aria-labelledby="sr-class-title">
            <h3 id="sr-class-title" className="ae-shop-reviews-sidebar__h">
              Classificação da loja
            </h3>
            <p className="ae-shop-reviews-sidebar__big-score" aria-live="polite">
              {ratingGeral != null ? ratingGeral.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 1 }) : "—"}
            </p>
            <ul className="ae-shop-reviews-sidebar__aspects">
              <li>
                <span>Artigo fiel à descrição</span>
                <strong>
                  {m?.avaliacaoAspectos?.produto != null ? `${m.avaliacaoAspectos.produto}/5` : "—"}
                </strong>
              </li>
              <li>
                <span>Comunicação</span>
                <strong>
                  {m?.avaliacaoAspectos?.comunicacao != null ? `${m.avaliacaoAspectos.comunicacao}/5` : "—"}
                </strong>
              </li>
              <li>
                <span>Velocidade de envio</span>
                <strong>
                  {m?.avaliacaoAspectos?.entrega != null ? `${m.avaliacaoAspectos.entrega}/5` : "—"}
                </strong>
              </li>
            </ul>
          </section>

          <section className="ae-shop-reviews-sidebar__block" aria-labelledby="sr-feed-title">
            <h3 id="sr-feed-title" className="ae-shop-reviews-sidebar__h">
              Avaliações de clientes
            </h3>
            {summary ? (
              <>
                <p className="ae-shop-reviews-sidebar__total">
                  <strong>{summary.total.toLocaleString("pt-PT")}</strong> opiniões verificadas
                </p>
                {summary.revisaoPositivaPercent != null ? (
                  <p className="ae-shop-reviews-sidebar__pct">
                    <strong>{summary.revisaoPositivaPercent}%</strong>
                    <span className="ae-muted ae-shop-reviews-sidebar__pct-note"> revisão positiva (4★ e 5★)</span>
                  </p>
                ) : null}
                <div className="ae-shop-reviews-sidebar__bars" role="list">
                  <SentimentBar label="Positivo" count={summary.positivo} total={Math.max(summary.total, 1)} tone="pos" />
                  <SentimentBar label="Neutro" count={summary.neutro} total={Math.max(summary.total, 1)} tone="neu" />
                  <SentimentBar label="Negativo" count={summary.negativo} total={Math.max(summary.total, 1)} tone="neg" />
                </div>
              </>
            ) : loading ? (
              <p className="ae-muted">A carregar resumo…</p>
            ) : (
              <p className="ae-muted">Sem dados agregados.</p>
            )}
          </section>
        </aside>

        <div className="ae-shop-reviews-main">
          <section className="page-panel ae-shop-reviews-main-panel">
            <header className="ae-shop-reviews-main-head">
              <h2 className="ae-shop-reviews-main-title">Feedback detalhado</h2>
              <p className="ae-shop-reviews-main-dek ae-muted">
                Filtros e ordenação aplicam-se à lista à direita. O resumo à esquerda reflecte sempre toda a loja.
              </p>
            </header>

            <div className="ae-shop-reviews-pills" role="toolbar" aria-label="Filtrar opiniões">
              <button
                type="button"
                className={mediaClass(todosActive)}
                onClick={() => resetFilters()}
              >
                Todos{summary ? ` (${summary.total})` : ""}
              </button>
              <button
                type="button"
                className={mediaClass(photosOnly)}
                onClick={() => setPhotosOnly((v) => !v)}
              >
                Com fotos
                {summary && summary.comFotos > 0 ? ` (${summary.comFotos})` : ""}
              </button>
              <button type="button" className={mediaClass(textOnly)} onClick={() => setTextOnly((v) => !v)}>
                Com comentário
                {summary && summary.comTexto > 0 ? ` (${summary.comTexto})` : ""}
              </button>
              {[5, 4, 3, 2, 1].map((stars) => {
                const cnt = summary?.porEstrela.find((x) => x.stars === stars)?.count ?? 0;
                const on = starFilter === stars;
                return (
                  <button
                    key={stars}
                    type="button"
                    className={mediaClass(on)}
                    onClick={() => setStarFilter((cur) => (cur === stars ? null : stars))}
                  >
                    {stars}
                    ★ ({cnt})
                  </button>
                );
              })}
            </div>

            <div className="ae-shop-reviews-toolbar-inline">
              <label className="ae-shop-reviews-sort">
                <span className="ae-muted">Ordenar por</span>
                <select
                  id="sf-review-sort"
                  className="ae-pdp-reviews-toolbar__select ae-shop-reviews-sort__sel"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ReviewSortKey)}
                >
                  <option value="recent">Ordem recomendada (recentes primeiro)</option>
                  <option value="helpful">Mais úteis</option>
                  <option value="rating_desc">Pontuação: maior primeiro</option>
                  <option value="rating_asc">Pontuação: menor primeiro</option>
                </select>
              </label>
              {!loading ? (
                <p className="ae-shop-reviews-count-note ae-muted">
                  A mostrar <strong>{items.length}</strong>
                  {total > 0 ? (
                    <>
                      {" "}
                      de <strong>{total.toLocaleString("pt-PT")}</strong> com os filtros actuais
                    </>
                  ) : null}
                  .
                </p>
              ) : (
                <p className="ae-muted">A sincronizar…</p>
              )}
            </div>

            {err ? <p className="ae-shop-reviews-err">{err}</p> : null}

            {!loading && items.length === 0 ? (
              <div className="ae-shop-reviews-empty">
                <p className="ae-shop-reviews-empty__title">
                  {!summary?.total ? "Nenhuma avaliação pública nesta loja" : "Nenhum resultado para estes filtros"}
                </p>
                {!summary?.total ? (
                  <p className="ae-muted">As primeiras avaliações surgem assim que compradores deixarem opiniões após entrega.</p>
                ) : (
                  <button type="button" className="ae-linkbtn" onClick={() => resetFilters()}>
                    Limpar filtros
                  </button>
                )}
                <Link className="ae-linkbtn" to={`${base}/produtos`} style={{ marginLeft: 8 }}>
                  Ver produtos da loja
                </Link>
              </div>
            ) : null}

            {loading ? (
              <ul className="ae-shop-reviews-list ae-shop-reviews-list--loading" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="ae-shop-reviews-row ae-shop-reviews-row--skel">
                    <div className="ae-skel" style={{ height: 80, borderRadius: 8 }} aria-hidden />
                  </li>
                ))}
              </ul>
            ) : items.length ? (
              <ul className="ae-shop-reviews-list">
                {items.map((r) => {
                  const displayName = formatReviewerDisplayName(r.user?.name);
                  const initials = reviewerAvatarInitials(displayName);
                  const dateStr = formatReviewDatePt(r.createdAt);
                  const hc = r.helpfulCount ?? 0;
                  const photoUrlsResolved = r.photoUrls?.length ? r.photoUrls.map((u) => resolveMediaUrl(u)) : [];
                  const ownReview = Boolean(user?.id && r.user?.id && user.id === r.user.id);

                  return (
                    <li key={r.id} className="ae-shop-reviews-row">
                      <div className="ae-shop-reviews-row__top">
                        <StarRating value={r.rating} size="sm" tone="gold" showValue />
                      </div>
                      <div className="ae-shop-reviews-row__identity-row">
                        <span className="ae-shop-reviews-row__avatar" aria-hidden>
                          {initials}
                        </span>
                        <div className="ae-shop-reviews-row__who">
                          <span className="ae-shop-reviews-row__uname">{displayName}</span>
                          <span className="ae-shop-reviews-row__pill">Compra verificada</span>
                          {dateStr ? (
                            <time className="ae-shop-reviews-row__date ae-muted" dateTime={r.createdAt}>
                              {dateStr}
                            </time>
                          ) : null}
                        </div>
                      </div>
                      <Link className="ae-shop-reviews-row__product ae-linkbtn" to={`/product/${encodeURIComponent(r.product.id)}`}>
                        «{r.product.name.trim().length > 120 ? `${r.product.name.trim().slice(0, 120)}…` : r.product.name.trim()}»
                      </Link>

                      <ReviewAspectChips
                        quality={r.ratingQuality}
                        communication={r.ratingSellerCommunication}
                        delivery={r.ratingDelivery}
                      />

                      {r.comment?.trim() ? <div className="ae-shop-reviews-row__comment">{r.comment.trim()}</div> : null}

                      {photoUrlsResolved.length > 0 ? (
                        <div className="ae-pdp-review-card__photos ae-shop-reviews-row__photos">
                          {photoUrlsResolved.map((resolved, pi) => (
                            <button
                              key={`${r.id}-p-${pi}`}
                              type="button"
                              className="ae-pdp-review-card__photo-hit"
                              aria-label={`Ampliar fotografia ${pi + 1}`}
                              onClick={() => setPhotoLb({ urls: photoUrlsResolved, index: pi })}
                            >
                              <img src={resolved} alt="" loading="lazy" decoding="async" />
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <footer className="ae-shop-reviews-row__foot">
                        <div className="ae-pdp-review-helpful">
                          <p className="ae-pdp-review-helpful__stat">{helpfulReviewSentence(hc)}</p>
                          <div className="ae-pdp-review-helpful__actions">
                            {ownReview ? (
                              <span className="ae-muted ae-pdp-review-helpful__self">A sua opinião</span>
                            ) : token ? (
                              <button
                                type="button"
                                className={`ae-pdp-review-helpful__btn${r.viewerMarkedHelpful ? " ae-pdp-review-helpful__btn--on" : ""}`}
                                disabled={helpfulBusyId === r.id}
                                aria-pressed={Boolean(r.viewerMarkedHelpful)}
                                onClick={() => void markReviewHelpful(r.id)}
                              >
                                {helpfulBusyId === r.id ? "A registar…" : r.viewerMarkedHelpful ? "Marcado como útil" : "Útil"}
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
            ) : null}

            {hasMore && !loading ? (
              <div className="ae-storefront-more-row">
                <button type="button" className="btn" disabled={loadingMore} onClick={() => loadMore()}>
                  {loadingMore ? "A carregar…" : "Carregar mais opiniões"}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {photoLb ? (
        <div
          className="ae-modal-backdrop ae-pdp-review-photo-lb"
          role="dialog"
          aria-modal="true"
          aria-label="Fotografia do cliente"
          onClick={() => setPhotoLb(null)}
        >
          <div className="ae-pdp-review-photo-lb__dialog" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ae-pdp-review-photo-lb__close" aria-label="Fechar" onClick={() => setPhotoLb(null)}>
              ×
            </button>
            <img src={photoLb.urls[photoLb.index]} alt="" className="ae-pdp-review-photo-lb__img" decoding="async" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
