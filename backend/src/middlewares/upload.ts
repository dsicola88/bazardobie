import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { HttpError } from "./errorHandler.js";

const dir = path.resolve(env.UPLOAD_DIR);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase().replace(/[^.\w]/g, "");
    const base = path.basename(file.originalname || "upload", ext).replace(/[^\w-]/g, "_").slice(0, 48) || "upload";
    const safe = `${Date.now()}-${crypto.randomUUID()}-${base}${ext}`;
    cb(null, safe);
  },
});

const allowedMime = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
]);

const allowedImageMime = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const m = String(file.mimetype || "").toLowerCase();
    if (allowedMime.has(m)) {
      cb(null, true);
      return;
    }
    cb(
      new HttpError(
        400,
        "Formato não suportado — use JPG, PNG, WebP, GIF, MP4, WebM, MOV ou PDF (máx. 20 MB)."
      )
    );
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
      next(new HttpError(400, "Ficheiro demasiado grande (máx. 20 MB)."));
      return;
    }
    next(new HttpError(400, "Upload inválido — verifique o formato e o tamanho.", { cause: err }));
  });
}

const imageSearchUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const m = String(file.mimetype || "").toLowerCase();
    if (allowedImageMime.has(m)) {
      cb(null, true);
      return;
    }
    cb(new HttpError(400, "Imagem inválida — use JPG, PNG, WebP ou GIF (máx. 8 MB)."));
  },
}).single("image");

export function runImageSearchUpload(req: Request, res: Response, next: NextFunction): void {
  imageSearchUpload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof HttpError) {
      next(err);
      return;
    }
    next(new HttpError(400, "Upload de imagem inválido para pesquisa visual.", { cause: err }));
  });
}
