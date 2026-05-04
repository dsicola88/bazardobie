import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";

type Db = Prisma.TransactionClient | typeof prisma;

export const freightZoneService = {
  findZoneByShippingAddress(client: Db, province: string, city: string) {
    const p = province.trim();
    const c = city.trim();
    if (p.length < 2 || c.length < 2) return Promise.resolve(null);
    return client.shippingZone.findFirst({
      where: {
        active: true,
        province: { equals: p, mode: "insensitive" },
        city: { equals: c, mode: "insensitive" },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  },

  /** Prioridade 1: `municipalityId` cadastrado na zona. Fallback: nomes texto legados nos registos ShippingZone sem FK. */
  async findBestZone(client: Db, municipalityId: string) {
    const byStruct = await client.shippingZone.findFirst({
      where: { active: true, municipalityId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    if (byStruct) return byStruct;

    const mun = await client.angolaMunicipality.findFirst({
      where: { id: municipalityId },
      include: { province: true },
    });
    if (!mun) return null;
    return this.findZoneByShippingAddress(client, mun.province.namePt, mun.namePt);
  },

  async resolveCheckoutFreight(client: Db, opts: { municipalityId: string }) {
    const zone = await this.findBestZone(client, opts.municipalityId);
    if (!zone) {
      const mun = await client.angolaMunicipality.findFirst({
        where: { id: opts.municipalityId },
        include: { province: true },
      });
      const place = mun ? `${mun.namePt}, ${mun.province.namePt}` : "município seleccionado";
      throw new HttpError(
        400,
        `Não existe tarifa de frete cadastrada para ${place}. ` +
          "Escolha outro município ou espere nova cobertura do marketplace.",
        { code: "FREIGHT_ZONE_NOT_FOUND" }
      );
    }
    return { zoneId: zone.id, price: zone.price, label: zone.label };
  },

  /** Cotação ao cliente por ID estrutural. */
  async quoteByMunicipalityId(
    municipalityId: string
  ): Promise<{ matched: boolean; price?: number; label?: string | null }> {
    const z = await this.findBestZone(prisma, municipalityId);
    if (!z) return { matched: false };
    return { matched: true, price: Number(z.price), label: z.label };
  },
};
