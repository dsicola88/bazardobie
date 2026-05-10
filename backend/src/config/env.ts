import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT) || 4000,
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./uploads",
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? "http://localhost:4000",
  /** URL do site (redireccto após mock de pagamento ou futuro return do PayPal). */
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",
  /** OAuth Google — opcional; sem isto o botão no site fica inactivo até configurar. */
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI ?? "",
  /** OAuth Facebook — opcional */
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID ?? "",
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET ?? "",
  FACEBOOK_REDIRECT_URI: process.env.FACEBOOK_REDIRECT_URI ?? "",
  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_SECURE: String(process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  SMTP_FROM: process.env.SMTP_FROM ?? "",
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME ?? "BAZAR DO BIE",
  /** Resend (https://resend.com) — API simples; plano gratuito generoso; recomendado em produção. */
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  /** Endereço remetente verificado no Resend (ex.: onboarding@resend.dev em dev ou no-reply@seudominio.com). */
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ?? "",
  /**
   * Processa fila `EmailOutbox` periodicamente no mesmo processo da API.
   * Defina "false" se usar cron/script externo (`npm run email-queue-once`).
   */
  ENABLE_EMAIL_QUEUE_PROCESSOR: !["0", "false", "no"].includes(
    (process.env.ENABLE_EMAIL_QUEUE_PROCESSOR ?? "true").toLowerCase()
  ),
  /** Horas até libertação automática ao vendedor se o comprador não confirmar nem abrir disputa */
  ESCROW_AUTO_CONFIRM_HOURS: Math.max(
    1,
    Number.isFinite(Number(process.env.ESCROW_AUTO_CONFIRM_HOURS))
      ? Number(process.env.ESCROW_AUTO_CONFIRM_HOURS)
      : 48
  ),
  /** Comissão estimada (basis points; 500 = 5 %) para métricas do painel admin */
  PLATFORM_COMMISSION_BPS: Number(process.env.PLATFORM_COMMISSION_BPS) || 500,

  /** Cloudflare R2 (S3-compatible) — opcional; quando preenchido, uploads vão para o balde em vez do disco local */
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ?? "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "",
  R2_BUCKET: process.env.R2_BUCKET ?? "",
  /** Origem pública para ler objetos (R2.dev, domínio personalizado ou Worker) — sem barra no fim */
  R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "",
};

/**
 * Usar Cloudflare R2 nos uploads quando todas as credenciais existem e R2 não foi desactivado.
 * Caso contrário, ficheiros ficam em UPLOAD_DIR (Railway: volume em /app/uploads ou disco efémero).
 */
export function isR2Configured(): boolean {
  const off =
    process.env.R2_UPLOADS_ENABLED === "false" ||
    process.env.R2_UPLOADS_ENABLED === "0";
  if (off) return false;
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET &&
      env.R2_PUBLIC_BASE_URL
  );
}
