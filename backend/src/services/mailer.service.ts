import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let cachedTransporter: nodemailer.Transporter | null = null;

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);
}

function transporter() {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
  return cachedTransporter;
}

function fromAddress() {
  return `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM}>`;
}

export const mailerService = {
  isConfigured() {
    return hasSmtpConfig();
  },

  async sendPasswordResetEmail(input: { to: string; name: string; resetUrl: string; ttlMinutes: number }) {
    if (!hasSmtpConfig()) return false;
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;">
        <h2 style="margin:0 0 12px;">Recuperação de senha</h2>
        <p>Olá, ${input.name || "utilizador"}.</p>
        <p>Recebemos um pedido para redefinir a sua senha no BAZAR DO BIÉ.</p>
        <p>
          <a href="${input.resetUrl}" style="display:inline-block;padding:10px 14px;background:#e62e04;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;">
            Redefinir senha
          </a>
        </p>
        <p>Este link expira em ${input.ttlMinutes} minutos.</p>
        <p>Se não foi você, ignore este e-mail com segurança.</p>
      </div>
    `;
    const text = [
      `Olá, ${input.name || "utilizador"}.`,
      "Recebemos um pedido para redefinir a sua senha no BAZAR DO BIÉ.",
      `Abra este link: ${input.resetUrl}`,
      `Este link expira em ${input.ttlMinutes} minutos.`,
      "Se não foi você, ignore este e-mail.",
    ].join("\n");

    await transporter().sendMail({
      from: fromAddress(),
      to: input.to,
      subject: "Recuperação de senha - BAZAR DO BIÉ",
      html,
      text,
    });
    return true;
  },
};
