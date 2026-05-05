import { z } from "zod";

const mediaUrlSchema = z.string().url().refine(
  (url) => /\.(jpg|jpeg|png|webp|gif|mp4|webm|mov)(\?.*)?$/i.test(url),
  "Media deve ser imagem (JPG/PNG/WebP/GIF) ou video curto (MP4/WebM/MOV)."
);

export const postOrderChatMessageSchema = z
  .object({
    text: z.string().trim().min(1).max(2000).optional(),
    mediaUrl: mediaUrlSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.text && !v.mediaUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["text"],
        message: "Envie texto, ficheiro multimidia ou ambos.",
      });
    }
  });
