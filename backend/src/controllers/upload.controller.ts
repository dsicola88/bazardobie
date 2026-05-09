import fs from "node:fs/promises";
import path from "node:path";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { env, isR2Configured } from "../config/env.js";
import { normalizeUploadedImage } from "../services/uploadImageNormalize.js";
import { putPublicObject } from "../services/r2Storage.service.js";

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

    const finalPath = path.join(uploadDir, filename);
    const mime = String(req.file.mimetype || "application/octet-stream").toLowerCase();

    // R2 completo → balde; senão → disco local / Railway (`/uploads/...` servido por express.static)
    if (isR2Configured()) {
      try {
        const body = await fs.readFile(finalPath);
        const key = `uploads/${filename}`;
        const url = await putPublicObject({
          key,
          body,
          contentType: mime,
        });
        await fs.unlink(finalPath).catch(() => {});
        res.status(201).json({ url });
        return;
      } catch (e) {
        await fs.unlink(finalPath).catch(() => {});
        throw new HttpError(
          500,
          e instanceof Error ? e.message : "Falha ao enviar ficheiro para o armazenamento."
        );
      }
    }

    const url = `/uploads/${filename}`;
    res.status(201).json({ url });
  }),
};
