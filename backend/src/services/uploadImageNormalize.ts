import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const MAX_EDGE = 2048;

/** MIME types we pass through without raster processing (vectors, unlikely uploads). */
const SKIP_NORMALIZE = new Set(["image/svg+xml"]);

/**
 * Auto-orient (EXIF), cap resolution for vitrine uniforme, compress — fotos de produto mais consistentes.
 */
export async function normalizeUploadedImage(
  inputPath: string,
  uploadDir: string,
  originalFilename: string,
  mimetype: string
): Promise<string> {
  if (SKIP_NORMALIZE.has(mimetype)) {
    return originalFilename;
  }

  const base = path.basename(originalFilename, path.extname(originalFilename));

  const rotated = sharp(inputPath).rotate();
  const meta = await rotated.metadata();
  const hasAlpha = meta.hasAlpha === true;

  const resized = rotated.resize({
    width: MAX_EDGE,
    height: MAX_EDGE,
    fit: "inside",
    withoutEnlargement: true,
  });

  const buf = hasAlpha
    ? await resized.png({ compressionLevel: 8 }).toBuffer()
    : await resized.jpeg({ quality: 88, mozjpeg: true }).toBuffer();

  const ext = hasAlpha ? ".png" : ".jpg";
  const outName = `${base}-${crypto.randomUUID()}${ext}`;
  const finalPath = path.join(uploadDir, outName);
  const tmpPath = path.join(uploadDir, `.tmp-${Date.now()}-${crypto.randomUUID()}-${base}${ext}`);

  await fs.writeFile(tmpPath, buf);
  await fs.unlink(inputPath);
  await fs.rename(tmpPath, finalPath);

  return outName;
}
