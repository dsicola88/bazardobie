import { formatRating } from "../utils/format.js";

const FIVE = "★★★★★";

export type StarRatingSize = "sm" | "md" | "lg";
export type StarRatingTone = "gold" | "dark";

type Props = {
  value: number;
  size?: StarRatingSize;
  /** gold = vitrine (tipo AliExpress); dark = bloco detalhado de avaliações */
  tone?: StarRatingTone;
  className?: string;
  /** Mostra o valor numérico (ex. 4,2) ao lado das estrelas */
  showValue?: boolean;
  /** Mostra (n) ao lado, estilo catálogo */
  reviewCount?: number;
  /** Se definido, torna-se selector 1–5 (modal de avaliação) */
  onChange?: (rating: number) => void;
  disabled?: boolean;
};

export function StarRating({
  value,
  size = "md",
  tone = "gold",
  className = "",
  showValue = false,
  reviewCount,
  onChange,
  disabled = false,
}: Props) {
  const v = Number(value);
  const safe = Number.isFinite(v) ? Math.min(5, Math.max(0, v)) : 0;
  const pct = (safe / 5) * 100;
  const countLabel =
    reviewCount != null && reviewCount > 0
      ? `${reviewCount.toLocaleString("pt-PT")} ${reviewCount === 1 ? "avaliação" : "avaliações"}`
      : "";
  const label =
    countLabel !== ""
      ? `Avaliação média ${formatRating(safe)} em 5 estrelas. ${countLabel}.`
      : `Avaliação média ${formatRating(safe)} em 5 estrelas.`;

  if (onChange) {
    const r = Math.max(1, Math.min(5, Math.round(Number.isFinite(v) ? v : 5)));
    return (
      <div
        className={[
          "ae-star-rating",
          "ae-star-rating--interactive",
          `ae-star-rating--${size}`,
          `ae-star-rating--tone-${tone}`,
          className,
        ].join(" ")}
        role="group"
        aria-label="Classificação de 1 a 5 estrelas"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={["ae-star-rating__hit", n <= r ? "ae-star-rating__hit--on" : ""].join(" ")}
            disabled={disabled}
            onClick={() => onChange(n)}
            aria-label={`${n} de 5 estrelas`}
          >
            ★
          </button>
        ))}
      </div>
    );
  }

  return (
    <span
      className={["ae-star-rating", `ae-star-rating--${size}`, `ae-star-rating--tone-${tone}`, className]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={label}
    >
      <span className="ae-star-rating__track" aria-hidden="true">
        <span className="ae-star-rating__bg">{FIVE}</span>
        <span className="ae-star-rating__fg" style={{ width: `${pct}%` }}>
          <span className="ae-star-rating__fg-inner">{FIVE}</span>
        </span>
      </span>
      {showValue ? (
        <span className="ae-star-rating__num" aria-hidden="true">
          {formatRating(safe)}
        </span>
      ) : null}
      {reviewCount != null && reviewCount > 0 ? (
        <span className="ae-star-rating__count" aria-hidden="true">
          ({reviewCount.toLocaleString("pt-PT")})
        </span>
      ) : null}
    </span>
  );
}
