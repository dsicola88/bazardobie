import { z } from "zod";

const homeGroupLayoutStyle = z.enum(["GRID", "SHOWCASE"]);
const homeGroupBadgeType = z.enum(["NONE", "TEXT", "TIMER"]);
const homeGroupCardEmphasis = z.enum(["BALANCED", "DISCOUNT", "RATING"]);

export const patchHomeProductGroupSchema = z
  .object({
    title: z.string().min(2).optional(),
    subtitle: z.union([z.string().max(500), z.null(), z.literal("")]).optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    maxDisplay: z.number().int().positive().max(48).optional(),
    layoutStyle: homeGroupLayoutStyle.optional(),
    badgeType: homeGroupBadgeType.optional(),
    badgeText: z.union([z.string().max(240), z.null(), z.literal("")]).optional(),
    badgeEndAt: z.union([z.string(), z.null()]).optional(),
    ctaLabel: z.union([z.string().max(120), z.null(), z.literal("")]).optional(),
    ctaHref: z.union([z.string().max(500), z.null(), z.literal("")]).optional(),
    productCardEmphasis: homeGroupCardEmphasis.optional(),
  });

export type PatchHomeProductGroupInput = z.infer<typeof patchHomeProductGroupSchema>;

export const addHomeGroupProductSchema = z.object({
  productId: z.string().min(1),
});
