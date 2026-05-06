export type DashboardPeriod = "day" | "month" | "year" | "custom";

export function resolveDashboardRange(period: DashboardPeriod, startRaw?: string, endRaw?: string) {
  const now = new Date();
  if (period === "custom") {
    const start = new Date(startRaw ?? "");
    const end = new Date(endRaw ?? "");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Intervalo custom inválido");
    }
    if (end < start) throw new Error("Data final não pode ser anterior à inicial");
    return { start, end };
  }
  if (period === "day") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { start, end: now };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { start, end: now };
}

export function previousRangeFrom(start: Date, end: Date) {
  const span = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);
  return { prevStart, prevEnd };
}
