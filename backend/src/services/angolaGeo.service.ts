import { prisma } from "../lib/prisma.js";

export const angolaGeoService = {
  listProvincesPublic() {
    return prisma.angolaProvince.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { namePt: "asc" }],
      select: { id: true, code: true, namePt: true, sortOrder: true },
    });
  },

  listMunicipalitiesPublic(provinceId: string) {
    return prisma.angolaMunicipality.findMany({
      where: { provinceId, active: true },
      orderBy: [{ sortOrder: "asc" }, { namePt: "asc" }],
      select: {
        id: true,
        code: true,
        namePt: true,
        sortOrder: true,
        provinceId: true,
        latitude: true,
        longitude: true,
      },
    });
  },

  listPickupPointsPublic(municipalityId: string) {
    return prisma.deliveryPickupPoint.findMany({
      where: { municipalityId, active: true },
      orderBy: [{ sortOrder: "asc" }, { namePt: "asc" }],
      select: { id: true, namePt: true, refCode: true, latitude: true, longitude: true },
    });
  },

  listCommunesPublic(municipalityId: string) {
    return prisma.angolaCommune.findMany({
      where: { municipalityId, active: true },
      orderBy: [{ sortOrder: "asc" }, { namePt: "asc" }],
      select: {
        id: true,
        code: true,
        namePt: true,
        sortOrder: true,
        municipalityId: true,
      },
    });
  },

  /** Lista plana para ecrãs admin (ex.: registo de zonas de frete). */
  async listAllMunicipalitiesAdmin() {
    const rows = await prisma.angolaMunicipality.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        namePt: true,
        province: { select: { id: true, code: true, namePt: true, sortOrder: true } },
      },
    });
    rows.sort((a, b) => {
      const ps = (a.province.sortOrder ?? 0) - (b.province.sortOrder ?? 0);
      if (ps !== 0) return ps;
      return a.namePt.localeCompare(b.namePt, "pt");
    });
    return rows;
  },

  async listAllCommunesAdmin() {
    const rows = await prisma.angolaCommune.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        namePt: true,
        municipality: {
          select: {
            id: true,
            namePt: true,
            province: { select: { id: true, code: true, namePt: true, sortOrder: true } },
          },
        },
      },
    });
    rows.sort((a, b) => {
      const ps = (a.municipality.province.sortOrder ?? 0) - (b.municipality.province.sortOrder ?? 0);
      if (ps !== 0) return ps;
      const ms = a.municipality.namePt.localeCompare(b.municipality.namePt, "pt");
      if (ms !== 0) return ms;
      return a.namePt.localeCompare(b.namePt, "pt");
    });
    return rows;
  },

  async getMunicipalityById(id: string) {
    return prisma.angolaMunicipality.findFirst({
      where: { id, active: true },
      include: { province: true },
    });
  },
};
