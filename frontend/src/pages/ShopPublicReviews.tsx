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

function ReviewAspectBars(props: {
  quality?: number | null;
  communication?: number | null;
  delivery?: number | null;
  overall: number;
}) {
  const rows: { label: string; value: number }[] = [];
  if (props.quality != null) rows.push({ label: "Descrição e qualidade do produto", value: props.quality });
  if (props.communication != null) rows.push({ label: "Comunicação do vendedor", value: props.communication });
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
          <span className="ae-pdp-review-aspect__val">
            {row.value}
            <span className="ae-pdp-review-aspect__max">/5</span>
          </span>
        </div>
      ))}
      <p className="ae-pdp-review-aspects__overall ae-muted">
        Experiência global nesta compra: <strong>{props.overall}</strong>/5
      </p>
    </div>
  );
}

export default function ShopPublicReviews() {
  const { shopId } = useParams();
  const { token, user } = useAuth();
  const ctx = useOutletContext<ShopFrontOutletContext>();
  const m = ctx.sobre?.metricas;
  const nome = ctx.sobre?.loja.name ?? "Loja";

  const [sort, setSort] = useState<ReviewSortKey>("recent");
  const [photosOnly, setPhotosOnly] = useState(false);
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

  /** Primeira página quando filtros mudam — evitar dependência de `items`. */
  const reloadFirstPage = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams({
      sort,
      take: String(PAGE_SIZE),
      skip: "0",
    });
    if (photosOnly) qs.set("photosOnly", "1");
    try {
      const r = await apiFetch<{ items: ShopReviewItem[]; total: number }>(
        `/shops/${encodeURIComponent(shopId)}/reviews?${qs.toString()}`,
        token ? { token } : undefined,
      );
      setItems(r.items ?? []);
      setTotal(r.total ?? 0);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível carregar as avaliações.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [photosOnly, shopId, sort, token]);

  const loadMore = useCallback(async () => {
    if (!shopId) return;
    setLoadingMore(true);
    setErr(null);
    const qs = new URLSearchParams({
      sort,
      take: String(PAGE_SIZE),
      skip: String(items.length),
    });
    if (photosOnly) qs.set("photosOnly", "1");
    try {
      const r = await apiFetch<{ items: ShopReviewItem[]; total: number }>(
        `/shops/${encodeURIComponent(shopId)}/reviews?${qs.toString()}`,
        token ? { token } : undefined,
      );
      setTotal(r.total ?? 0);
      setItems((prev) => [...prev, ...(r.items ?? [])]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível carregar mais opiniões.");
    } finally {
      setLoadingMore(false);
    }
  }, [items.length, photosOnly, shopId, sort, token]);

  useEffect(() => {
    if (!shopId) return;
    void reloadFirstPage();
  }, [shopId, sort, photosOnly, reloadFirstPage]);

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
      // silêncio: feedback visual mínimo
    } finally {
      setHelpfulBusyId(null);
    }
  };

  const hasMore = items.length < total;
  const base = shopId ? `/loja/${encodeURIComponent(shopId)}` : "";

  return (
    <div className="ae-storefront-body">
      <section className="page-panel ae-storefront-panel">
        <h2 className="ae-storefront-h2">Feedback dos compradores</h2>
        <p className="ae-muted" style={{ maxWidth: 720, marginTop: 4 }}>
          Cada entrada corresponde a uma compra concluída e entregue. As opiniões estão agrupadas de todos os artigos públicos da
          loja.
        </p>

        {m?.avaliacaoAspectos &&
        (m.avaliacaoAspectos.produto != null ||
          m.avaliacaoAspectos.comunicacao != null ||
          m.avaliacaoAspectos.entrega != null) ? (
          <dl className="ae-storefront-aspects-summary">
            <div>
              <dt>Produto fiel à descrição</dt>
              <dd>{m.avaliacaoAspectos.produto != null ? `${m.avaliacaoAspectos.produto}/5` : "—"}</dd>
            </div>
            <div>
              <dt>Comunicação</dt>
              <dd>{m.avaliacaoAspectos.comunicacao != null ? `${m.avaliacaoAspectos.comunicacao}/5` : "—"}</dd>
            </div>
            <div>
              <dt>Envio</dt>
              <dd>{m.avaliacaoAspectos.entrega != null ? `${m.avaliacaoAspectos.entrega}/5` : "—"}</dd>
            </div>
          </dl>
        ) : null}

        <div className="ae-pdp-reviews-toolbar" style={{ marginTop: 20 }}>
          <div className="ae-pdp-reviews-toolbar__grid">
            <div className="ae-pdp-reviews-toolbar__field">
              <label htmlFor="sf-review-sort">Ordenar por</label>
              <select
                id="sf-review-sort"
                className="ae-pdp-reviews-toolbar__select"
                value={sort}
                onChange={(e) => setSort(e.target.value as ReviewSortKey)}
              >
                <option value="recent">Mais recentes</option>
                <option value="helpful">Mais úteis</option>
                <option value="rating_desc">Nota alta → baixa</option>
                <option value="rating_asc">Nota baixa → alta</option>
              </select>
            </div>
            <label className="ae-pdp-reviews-toolbar__toggle">
              <input type="checkbox" checked={photosOnly} onChange={(e) => setPhotosOnly(e.target.checked)} />
              <span>Só opiniões com fotos</span>
            </label>
          </div>
          {!loading ? (
            <p className="ae-pdp-reviews-toolbar__meta ae-muted">
              Exibindo <strong>{items.length}</strong>
              {total > 0 ? (
                <>
                  {" "}
                  de <strong>{total.toLocaleString("pt-PT")}</strong> opiniões
                </>
              ) : (
                <>
                  {" "}
                  resultados
                </>
              )}
              .
            </p>
          ) : (
            <p className="ae-pdp-reviews-toolbar__meta ae-muted">A sincronizar opiniões…</p>
          )}
        </div>

        {err ? <p style={{ color: "#b00020" }}>{err}</p> : null}

        {!loading && items.length === 0 ? (
          <div className="ae-pdp-reviews-empty">
            <p className="ae-pdp-reviews-empty__title">Ainda não há avaliações públicas</p>
            <p className="ae-pdp-reviews-empty__lead ae-muted">
              Quando compradores confirmarem recepção das encomendas, as opiniões aparecem aqui e nas fichas individuais.
            </p>
            <Link className="ae-linkbtn" to={`${base}/produtos`}>
              Explorar artigos da loja
            </Link>
          </div>
        ) : null}

        {loading ? (
          <ul className="ae-pdp-reviews-list ae-pdp-reviews-list--loading" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="ae-pdp-review-card ae-pdp-review-card--skeleton">
                <div className="ae-pdp-review-card__top">
                  <div className="ae-skel ae-pdp-review-sk-avatar" aria-hidden />
                  <div className="ae-pdp-review-sk-col">
                    <div className="ae-skel ae-pdp-review-sk-line ae-pdp-review-sk-line--title" aria-hidden />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : items.length ? (
          <ul className="ae-pdp-reviews-list">
            {items.map((r) => {
              const displayName = formatReviewerDisplayName(r.user?.name);
              const initials = reviewerAvatarInitials(displayName);
              const dateStr = formatReviewDatePt(r.createdAt);
              const hc = r.helpfulCount ?? 0;
              const photoUrlsResolved = r.photoUrls?.length ? r.photoUrls.map((u) => resolveMediaUrl(u)) : [];
              const ownReview = Boolean(user?.id && r.user?.id && user.id === r.user.id);

              return (
                <li key={r.id} className="ae-pdp-review-card">
                  <div className="ae-pdp-review-card__top">
                    <div className="ae-pdp-review-card__avatar" aria-hidden>
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
                      <Link className="ae-storefront-review-product ae-linkbtn" to={`/product/${encodeURIComponent(r.product.id)}`}>
                        Ref.: {r.product.name.trim().slice(0, 140)}
                        {r.product.name.trim().length > 140 ? "…" : ""}
                      </Link>
                    </div>
                    <StarRating value={r.rating} size="sm" tone="gold" showValue className="ae-pdp-review-card__stars" />
                  </div>
                  <ReviewAspectBars
                    quality={r.ratingQuality}
                    communication={r.ratingSellerCommunication}
                    delivery={r.ratingDelivery}
                    overall={r.rating}
                  />
                  {r.comment?.trim() ? <div className="ae-pdp-review-card__body">{r.comment.trim()}</div> : null}
                  {photoUrlsResolved.length > 0 ? (
                    <div className="ae-pdp-review-card__photos">
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
                  <footer className="ae-pdp-review-card__footer">
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
            <button type="button" className="btn" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? "A carregar…" : "Carregar mais opiniões"}
            </button>
          </div>
        ) : null}
      </section>

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
