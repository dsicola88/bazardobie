import { prisma } from "../lib/prisma.js";
import { freightDistanceService } from "./freightDistance.service.js";
import { parseTruthySetting } from "./siteSettings.service.js";

export const ZONE_FREIGHT_SITE_KEY = "public.zone_freight_enabled" as const;

export type FreightPricingMode = "ZONE" | "DISTANCE" | "NONE";

/** Frete por província + cidade (cadastro admin) ganha sobre frete por distância GPS. */
export async function getFreightPricingMode(): Promise<FreightPricingMode> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: ZONE_FREIGHT_SITE_KEY },
      select: { value: true },
    });
    const zoneOn = parseTruthySetting(row?.value, "false");
    if (zoneOn) return "ZONE";
    if (await freightDistanceService.isEnabled()) return "DISTANCE";
    return "NONE";
  } catch {
    if (await freightDistanceService.isEnabled()) return "DISTANCE";
    return "NONE";
  }
}
