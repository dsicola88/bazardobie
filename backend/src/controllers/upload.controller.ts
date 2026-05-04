import fs from "node:fs/promises";
import path from "node:path";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { env } from "../config/env.js";
import { normalizeUploadedImage } from "../services/uploadImageNormalize.js";

export const uploadController = {
  upload: asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Ficheiro em falta (campo file)");

    let filename = req.file.filename;
    const uploadDir = path.resolve(env.UPLOAD_DIR);

    if (req.file.mimetype.startsWith("image/")) {
      try {
        filename = await normalizeUploadedImage(
          path.join(uploadDir, req.file.filename),
          uploadDir,
          req.file.filename,
          req.file.mimetype
        );
      } catch {
        await fs.unlink(path.join(uploadDir, req.file.filename)).catch(() => {});
        throw new HttpError(
          400,
          "Não foi possível processar a imagem. Use JPG, PNG ou WebP."
        );
      }
    }

    const url = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/uploads/${filename}`;
    res.status(201).json({ url });
  }),
};
