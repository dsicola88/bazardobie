import { useId, useMemo } from "react";
import { parsePriceFilterInput } from "../utils/priceFilter.js";

export type SearchPriceRangeProps = {
  disabled: boolean;
  floor: number;
  ceiling: number;
  minPriceParam: string | null;
  maxPriceParam: string | null;
  minDraft: string;
  maxDraft: string;
  onMinDraftChange: (v: string) => void;
  onMaxDraftChange: (v: string) => void;
  onApplyTextInputs: () => void;
  commitSliderRange: (lo: number, hi: number) => void;
};

export function SearchPriceRange({
  disabled,
  floor,
  ceiling,
  minPriceParam,
  maxPriceParam,
  minDraft,
  maxDraft,
  onMinDraftChange,
  onMaxDraftChange,
  onApplyTextInputs,
  commitSliderRange,
}: SearchPriceRangeProps) {
  const uid = useId();
  const span = Math.max(ceiling - floor, 1);
  const step = useMemo(() => Math.max(Math.round(span / 160), 1), [span]);

  const lowSlide = Math.min(ceiling, Math.max(floor, parsePriceFilterInput(minPriceParam) ?? floor));
  const highSlide = Math.min(ceiling, Math.max(floor, parsePriceFilterInput(maxPriceParam) ?? ceiling));

  const activeMin = parsePriceFilterInput(minPriceParam);
  const activeMax = parsePriceFilterInput(maxPriceParam);
  const hasActivePrice = activeMin != null || activeMax != null;

  const fmt = (n: number) => n.toLocaleString("pt-AO");

  const sliderBroken = ceiling <= floor || disabled;

  const fillLeft = ((lowSlide - floor) / span) * 100;
  const fillWidth = Math.max(((highSlide - lowSlide) / span) * 100, 0);

  return (
    <div className={`ae-price-filter${sliderBroken ? " ae-price-filter--disabled" : ""}`}>
      <div className="ae-price-filter__band" aria-live="polite">
        <span className="ae-price-filter__band-label">{hasActivePrice ? "Faixa activa" : "Catálogo (referência)"}</span>
        <span className="ae-price-filter__band-values">
          {hasActivePrice ? (
            <>
              {fmt(activeMin ?? floor)} — {fmt(activeMax ?? ceiling)} Kz
            </>
          ) : (
            <>
              {fmt(floor)} — {fmt(ceiling)} Kz
            </>
          )}
        </span>
      </div>

      <div className={sliderBroken ? "ae-price-slider ae-price-slider--off" : "ae-price-slider"}>
        <div className="ae-price-slider__rail" />
        <div className="ae-price-slider__fill" style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }} />
        <input
          id={`${uid}-r-min`}
          type="range"
          className="ae-price-slider__input ae-price-slider__input--lower"
          disabled={sliderBroken}
          min={floor}
          max={ceiling}
          step={step}
          value={lowSlide}
          aria-label="Ajustar preço mínimo"
          onChange={(e) => {
            const hi = parsePriceFilterInput(maxPriceParam) ?? ceiling;
            let lo = Number(e.target.value);
            if (!Number.isFinite(lo)) return;
            if (lo > hi) lo = hi;
            commitSliderRange(lo, hi);
          }}
        />
        <input
          id={`${uid}-r-max`}
          type="range"
          className="ae-price-slider__input ae-price-slider__input--upper"
          disabled={sliderBroken}
          min={floor}
          max={ceiling}
          step={step}
          value={highSlide}
          aria-label="Ajustar preço máximo"
          onChange={(e) => {
            const lo = parsePriceFilterInput(minPriceParam) ?? floor;
            let hi = Number(e.target.value);
            if (!Number.isFinite(hi)) return;
            if (hi < lo) hi = lo;
            commitSliderRange(lo, hi);
          }}
        />
      </div>

      <div className="ae-price-filter__manual">
        <div className="ae-price-filter__manual-row">
          <label className="sr-only" htmlFor={`${uid}-t-min`}>
            Preço mínimo em Kz
          </label>
          <input
            id={`${uid}-t-min`}
            className="ae-filters__input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Mínimo"
            disabled={disabled}
            value={minDraft}
            onChange={(e) => onMinDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApplyTextInputs();
              }
            }}
          />
          <label className="sr-only" htmlFor={`${uid}-t-max`}>
            Preço máximo em Kz
          </label>
          <input
            id={`${uid}-t-max`}
            className="ae-filters__input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Máximo"
            disabled={disabled}
            value={maxDraft}
            onChange={(e) => onMaxDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApplyTextInputs();
              }
            }}
          />
        </div>
        <button type="button" className="btn btn-primary ae-filters__apply" disabled={disabled} onClick={onApplyTextInputs}>
          Aplicar valores escritos
        </button>
      </div>
      <p className="ae-filters__facet-hint ae-muted" style={{ marginTop: 10 }}>
        O controlo deslizante actualiza o filtro de imediato; nas caixas pode usar espaços ou pontos de milhares (ex.:{" "}
        <span className="ae-admin-mono">185 000</span>).
      </p>
    </div>
  );
}
