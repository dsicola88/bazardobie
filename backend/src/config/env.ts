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
  /** Horas até libertação automática ao vendedor se o comprador não confirmar nem abrir disputa */
  ESCROW_AUTO_CONFIRM_HOURS: Math.max(
    1,
    Number.isFinite(Number(process.env.ESCROW_AUTO_CONFIRM_HOURS))
      ? Number(process.env.ESCROW_AUTO_CONFIRM_HOURS)
      : 48
  ),
  /** Comissão estimada (basis points; 500 = 5 %) para métricas do painel admin */
  PLATFORM_COMMISSION_BPS: Number(process.env.PLATFORM_COMMISSION_BPS) || 500,
};
