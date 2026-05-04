import {
  type LogisticsKind,
  pedidoUltimoPasso,
  trackStepsForLogistics,
} from "../utils/orderTracking.js";

type Props = {
  status: string;
  /** Omitido ou `VENDEDOR`: cronologia clássica. `PLATAFORMA`: etapas após preparação são da equipa logística. */
  logistics?: LogisticsKind;
};

export function OrderTimeline({ status, logistics = "VENDEDOR" }: Props) {
  const steps = trackStepsForLogistics(logistics);
  const last = pedidoUltimoPasso(status);
  if (last === 0) {
    return (
      <div className="ae-tracking ae-tracking--cancel">
        <span>Encomenda cancelada</span>
      </div>
    );
  }
  if (last < 0) return null;

  return (
    <div className="ae-tracking">
      <div className="ae-tracking__heading">Estados da encomenda</div>
      <ol className="ae-tracking__steps" aria-label="Estado da encomenda">
        {steps.map((step, index) => {
          const stepNo = index + 1;
          const done = last >= stepNo;
          const current = last === stepNo;
          return (
            <li
              key={step.key}
              className={`ae-tracking__step${done ? " ae-tracking__step--done" : ""}${
                current ? " ae-tracking__step--current" : ""
              }`}
            >
              <span className="ae-tracking__dot">{done ? "✓" : stepNo}</span>
              <span className="ae-tracking__label">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
