import { useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Link } from "react-router-dom";

type Props = {
  /** URL já resolvida (absoluta) para pintar `<img>` e fundo da lupa. */
  thumbUrl: string;
  /** Destino igual ao nome do produto (com variante opcional). */
  to: string;
  onImgError?: () => void;
};

export function CartThumbWithZoom({ thumbUrl, to, onImgError }: Props) {
  const [zoomOn, setZoomOn] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  const bgImage = useMemo(() => `url(${JSON.stringify(thumbUrl)})`, [thumbUrl]);

  function onMove(ev: ReactMouseEvent<HTMLDivElement>) {
    const rect = ev.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((ev.clientX - rect.left) / rect.width) * 100;
    const y = ((ev.clientY - rect.top) / rect.height) * 100;
    setZoomPos({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }

  if (!thumbUrl) return null;

  return (
    <div
      className={`ae-cart-thumb-zoom ${zoomOn ? "ae-cart-thumb-zoom--on" : ""}`}
      onMouseLeave={() => setZoomOn(false)}
    >
      <Link to={to} className="ae-cart-thumb-zoom__link">
        <div
          className="ae-cart-thumb-zoom__wrap"
          onMouseEnter={() => setZoomOn(true)}
          onMouseMove={onMove}
        >
          <img src={thumbUrl} alt="" loading="lazy" decoding="async" onError={onImgError} />
          <span className="ae-cart-thumb-zoom__loupe" style={{ left: `${zoomPos.x}%`, top: `${zoomPos.y}%` }} aria-hidden />
        </div>
      </Link>
      <div
        className="ae-cart-thumb-zoom__pane"
        aria-hidden
        style={{
          backgroundImage: bgImage,
          backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
          opacity: zoomOn ? 1 : 0,
          visibility: zoomOn ? ("visible" as const) : ("hidden" as const),
        }}
      />
    </div>
  );
}
