import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { haversineDistanceKm } from "../utils/haversine.js";

export const FREIGHT_SITE_KEYS = {
  enabled: "public.distance_freight_enabled",
  hubLat: "logistics.platform_freight_hub_lat",
  hubLng: "logistics.platform_freight_hub_lng",
} as const;

function norm(s: string): string {
  return s.normalize("NFKD").trim().toLowerCase();
}

async function rawSetting(key: string): Promise<string | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key }, select: { value: true } });
  return row?.value?.trim() ?? null;
}

export const freightDistanceService = {
  async isEnabled(): Promise<boolean> {
    const v = await rawSetting(FREIGHT_SITE_KEYS.enabled);
    const s = (v ?? "false").toLowerCase();
    return s === "true" || s === "1" || s === "sim";
  },

  /** Configurações de hub públicas só para admins; usadas no servidor. */
  async getPlatformHubCoordinates(): Promise<{ lat: number; lng: number } | null> {
    const latS = await rawSetting(FREIGHT_SITE_KEYS.hubLat);
    const lngS = await rawSetting(FREIGHT_SITE_KEYS.hubLng);
    if (!latS || !lngS) return null;
    const lat = Number(latS);
    const lng = Number(lngS);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  },

  async listActiveBands() {
    return prisma.shippingDistanceBand.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { minDistanceKm: "asc" }],
    });
  },

  async listPublicLocalities(provinceFilter?: string, municipalityId?: string) {
    const p = provinceFilter?.trim();
    const m = municipalityId?.trim();
    return prisma.freightLocality.findMany({
      where: {
        active: true,
        ...(p ? { province: { equals: p.trim(), mode: "insensitive" } } : {}),
        ...(m ? { municipalityId: m } : {}),
      },
      orderBy: [{ province: "asc" }, { sortOrder: "asc" }, { city: "asc" }],
      select: {
        id: true,
        label: true,
        province: true,
        city: true,
        municipalityId: true,
      },
    });
  },

  lookupBandPriceKm(distanceKm: number, bands: { id: string; minDistanceKm: Decimal; maxDistanceKm: Decimal; price: Decimal }[]) {
    const d = distanceKm;
    for (const b of bands) {
      const lo = Number(b.minDistanceKm);
      const hi = Number(b.maxDistanceKm);
      if (d >= lo && d < hi) {
        return { bandId: b.id, price: b.price };
      }
    }
    if (bands.length === 0) {
      throw new HttpError(
        503,
        "Não há faixas de frete por distância configuradas. Contacte o suporte.",
        { code: "FREIGHT_BANDS_MISSING" }
      );
    }
    const last = bands[bands.length - 1];
    const loLast = Number(last.minDistanceKm);
    if (d >= loLast) {
      return { bandId: last.id, price: last.price };
    }
    throw new HttpError(
      400,
      "Distância fora de qualquer faixa tarifária — verifique cadastro das faixas em Administração.",
      { code: "FREIGHT_DISTANCE_OUTSIDE_BANDS" }
    );
  },

  async resolveFreightPriceForOrder(opts: {
    tipoEntrega: "PLATAFORMA" | "VENDEDOR";
    shopFreightLat: Decimal | null;
    shopFreightLng: Decimal | null;
    freightLocalityId: string | null;
    shippingMunicipalityId: string;
  }): Promise<{ distanceKm: number; bandId: string; freightTotal: Decimal }> {
    const localityId = opts.freightLocalityId;
    if (!localityId?.trim()) {
      throw new HttpError(
        400,
        "Seleccione a localidade / zona de destino para cálculo do frete (modo por distância activo).",
        { code: "FREIGHT_LOCALITY_REQUIRED" }
      );
    }
    const locality = await prisma.freightLocality.findFirst({
      where: { id: localityId.trim(), active: true },
    });
    if (!locality) {
      throw new HttpError(
        400,
        "Localidade de frete inválida ou desactivada — escolha outra entrada na lista.",
        { code: "FREIGHT_LOCALITY_INVALID" }
      );
    }
    if (locality.municipalityId) {
      if (locality.municipalityId !== opts.shippingMunicipalityId) {
        throw new HttpError(
          400,
          "O destino estrutural (município) deve coincidir com a zona GPS seleccionada para o frete.",
          { code: "FREIGHT_ADDRESS_MISMATCH_MUNICIPALITY" }
        );
      }
    } else {
      const mun = await prisma.angolaMunicipality.findFirst({
        where: { id: opts.shippingMunicipalityId, active: true },
        include: { province: true },
      });
      if (!mun) {
        throw new HttpError(400, "Município de destino inválido.", { code: "SHIPPING_MUNICIPALITY_INVALID" });
      }
      if (
        norm(mun.province.namePt) !== norm(locality.province) ||
        norm(mun.namePt) !== norm(locality.city)
      ) {
        throw new HttpError(
          400,
          "O município de destino não corresponde à localidade de frete escolhida.",
          { code: "FREIGHT_ADDRESS_MISMATCH_LEGACY" }
        );
      }
    }

    let oLat: number;
    let oLng: number;
    if (opts.tipoEntrega === "PLATAFORMA") {
      const hub = await this.getPlatformHubCoordinates();
      if (!hub) {
        throw new HttpError(
          503,
          "Hub de origem da plataforma não configurado (latitude/longitude). Defina em Administração → Frete por distância.",
          { code: "FREIGHT_HUB_MISSING" }
        );
      }
      oLat = hub.lat;
      oLng = hub.lng;
    } else {
      if (opts.shopFreightLat == null || opts.shopFreightLng == null) {
        throw new HttpError(
          400,
          "Esta loja ainda não definiu coordenadas de origem para o envio próprio — conclua o registo nos dados da loja ou desactive temporariamente o frete por distância.",
          { code: "FREIGHT_SHOP_ORIGIN_MISSING" }
        );
      }
      oLat = Number(opts.shopFreightLat);
      oLng = Number(opts.shopFreightLng);
      if (!Number.isFinite(oLat) || !Number.isFinite(oLng)) {
        throw new HttpError(400, "Coordenadas de origem da loja inválidas.", {
          code: "FREIGHT_SHOP_ORIGIN_INVALID",
        });
      }
    }

    const dLat = Number(locality.latitude);
    const dLng = Number(locality.longitude);
    const distanceKm = haversineDistanceKm(oLat, oLng, dLat, dLng);

    const bands = await this.listActiveBands();
    const { bandId, price } = this.lookupBandPriceKm(distanceKm, bands);

    return { distanceKm, bandId, freightTotal: new Decimal(price) };
  },

  splitFreightAcrossLineCount(total: Decimal, lineCount: number): Decimal[] {
    if (lineCount <= 0) throw new HttpError(500, "Linhas de pedido inconsistentes.");
    const cents = Number(total.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP));
    if (!Number.isFinite(cents) || cents < 0) {
      throw new HttpError(500, "Valor de frete inconsistente.");
    }
    const n = lineCount;
    const base = Math.floor(cents / n);
    let remainder = cents - base * n;
    const arr: Decimal[] = [];
    for (let i = 0; i < n; i++) {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder--;
      arr.push(new Decimal(base + extra).dividedBy(100));
    }
    const sumCheck = arr.reduce((a, x) => a.plus(x), new Decimal(0));
    if (!sumCheck.equals(total)) {
      const lastIdx = arr.length - 1;
      arr[lastIdx] = arr[lastIdx]!.plus(total.minus(sumCheck));
    }
    return arr;
  },
};
