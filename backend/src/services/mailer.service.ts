import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let cachedTransporter: nodemailer.Transporter | null = null;

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);
}

function hasResendConfig() {
  return Boolean(env.RESEND_API_KEY?.trim());
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

function smtpFromHeader() {
  return `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM}>`;
}

/** Domínio ou endereço «from» para Resend (deve estar verificado no painel Resend). */
function resendFromAddress(): string {
  const addr = (env.RESEND_FROM_EMAIL || env.SMTP_FROM || "").trim();
  if (!addr) throw new Error("Defina RESEND_FROM_EMAIL ou SMTP_FROM para enviar e-mail.");
  const name = env.SMTP_FROM_NAME?.trim();
  return name ? `"${name}" <${addr}>` : addr;
}

async function sendViaResend(input: {
  toEmail: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const key = env.RESEND_API_KEY!.trim();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromAddress(),
      to: [input.toEmail],
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend HTTP ${res.status}: ${body}`);
  }
}

function extractEmailAddress(raw: string): string {
  const trimmed = raw.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  const candidate = angle ? angle[1]!.trim() : trimmed;
  return candidate.toLowerCase();
}

export const mailerService = {
  /** SMTP tradicional ou API Resend — pelo menos um configurado. */
  isDeliveryConfigured(): boolean {
    return hasResendConfig() || hasSmtpConfig();
  },

  /** Compat: só SMTP (legado). */
  isConfigured() {
    return hasSmtpConfig();
  },

  async sendRawEmail(input: { to: string; toName?: string | null; subject: string; html: string; text?: string }) {
    const toHeader = input.toName?.trim()
      ? `"${input.toName.replace(/"/g, "").trim()}" <${input.to.trim()}>`
      : input.to.trim();
    const toEmail = extractEmailAddress(input.to);

    if (hasResendConfig()) {
      await sendViaResend({
        toEmail,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return;
    }

    if (!hasSmtpConfig()) {
      throw new Error("E-mail não configurado: defina RESEND_API_KEY ou SMTP_*.");
    }

    await transporter().sendMail({
      from: smtpFromHeader(),
      to: toHeader,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  },

  async sendPasswordResetEmail(input: { to: string; name: string; resetUrl: string; ttlMinutes: number }) {
    if (!this.isDeliveryConfigured()) return false;
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

    await this.sendRawEmail({
      to: input.to,
      toName: input.name,
      subject: "Recuperação de senha - BAZAR DO BIÉ",
      html,
      text,
    });
    return true;
  },
};
