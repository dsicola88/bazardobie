import { z } from "zod";

const dec3 = z.coerce.number().nonnegative();
const money = z.coerce.number().nonnegative();

export const freightQuoteBodySchema = z
  .object({
    municipalityId: z.string().trim().min(8).optional(),
    /** Legacy — retrocompat apenas. */
    shippingProvince: z.string().trim().optional(),
    shippingCity: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.municipalityId?.trim()) return;
    const p = data.shippingProvince?.trim().length ?? 0;
    const c = data.shippingCity?.trim().length ?? 0;
    if (p >= 2 && c >= 2) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Indique municipalityId ou, em modo antigo, shippingProvince + shippingCity (mín. 2 caracteres cada).",
    });
  });

export const createDistanceBandSchema = z.object({
  name: z.string().min(1).max(120),
  minDistanceKm: dec3,
  maxDistanceKm: dec3,
  price: money,
  sortOrder: z.coerce.number().int().optional(),
  active: z.coerce.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const patchDistanceBandSchema = createDistanceBandSchema.partial();

const freightLocalityBodySchema = z.object({
  label: z.string().min(1).max(200),
  municipalityId: z.string().trim().min(8).optional(),
  province: z.string().min(1).max(120).optional(),
  city: z.string().min(1).max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  sortOrder: z.coerce.number().int().optional(),
  active: z.coerce.boolean().optional(),
});

export const createFreightLocalitySchema = freightLocalityBodySchema.superRefine((data, ctx) => {
  if (data.municipalityId?.trim()) return;
  const p = data.province?.trim().length ?? 0;
  const c = data.city?.trim().length ?? 0;
  if (p >= 1 && c >= 1) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Indique municipalityId ou par province + city.",
  });
});

export const patchFreightLocalitySchema = freightLocalityBodySchema.partial();

export const createShippingZoneSchema = z.object({
  municipalityId: z.string().trim().min(8),
  label: z.string().max(200).optional().nullable(),
  price: money,
  sortOrder: z.coerce.number().int().optional(),
  active: z.coerce.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const patchShippingZoneSchema = createShippingZoneSchema.partial();
