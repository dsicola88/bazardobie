import { useEffect, useMemo, useState } from "react";

export type FlashDealRemain = {
  /** Milissegundos restantes até à data-limite (≤0 se expirou). */
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function deadlineMs(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const t = Date.parse(raw.trim());
  return Number.isFinite(t) ? t : null;
}

/** Contagem regressiva até `endAtISO`; devolve null se a data não for válida. */
export function useFlashDealCountdown(endAtISO: string | undefined): FlashDealRemain | null {
  const target = useMemo(() => deadlineMs(endAtISO), [endAtISO]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target == null) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [target]);

  if (target == null) return null;
  const totalMs = target - now;
  if (totalMs <= 0)
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

  const secTotal = Math.floor(totalMs / 1000);
  const days = Math.floor(secTotal / 86400);
  const hours = Math.floor((secTotal % 86400) / 3600);
  const minutes = Math.floor((secTotal % 3600) / 60);
  const seconds = secTotal % 60;
  return { totalMs, days, hours, minutes, seconds };
}
