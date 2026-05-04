import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { HttpError } from "./errorHandler.js";

const dir = path.resolve(env.UPLOAD_DIR);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename: (_req, file, cb) => {
    const safe = `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, "_")}`;
    cb(null, safe);
  },
});

const allowedMime = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const m = String(file.mimetype || "").toLowerCase();
    if (allowedMime.has(m)) {
      cb(null, true);
      return;
    }
    cb(new HttpError(400, "Formato não suportado — use JPG, PNG, WebP, GIF ou PDF (máx. 5 MB)."));
  },
}).single("file");

export function runUpload(req: Request, res: Response, next: NextFunction): void {
  upload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof HttpError) {
      next(err);
      return;
    }
    if (err instanceof Error && err.message.includes("Limite")) {
      next(new HttpError(400, "Ficheiro demasiado grande (máx. 5 MB)."));
      return;
    }
    next(new HttpError(400, "Upload inválido — verifique o formato e o tamanho.", { cause: err }));
  });
}
