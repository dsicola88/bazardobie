import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env, isR2Configured } from "../config/env.js";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!isR2Configured()) {
    throw new Error("R2 não configurado (variáveis R2_* em falta).");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

/**
 * Envia ficheiro para o balde R2 e devolve URL pública (R2_PUBLIC_BASE_URL + key).
 * A key deve usar apenas segmentos seguros (ex.: prefixo `uploads/` + nome do ficheiro gerado pelo multer).
 */
export async function putPublicObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const c = getClient();
  await c.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  );
  const base = env.R2_PUBLIC_BASE_URL;
  const k = params.key.replace(/^\/+/, "");
  const encoded = k
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/${encoded}`;
}
