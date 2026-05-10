import { env } from "../config/env.js";
import { escapeHtml } from "./escapeHtml.js";
import { emailOutboxService } from "../services/emailOutbox.service.js";

export const TEMPLATE_ORDER_CONFIRMED = "ORDER_CONFIRMED";

export type OrderConfirmedLine = {
  orderCode: string;
  grandTotal: string;
  shopNames: string[];
};

function formatMoneyKz(amountStr: string): string {
  const n = Number(amountStr);
  if (!Number.isFinite(n)) return `${amountStr} Kz`;
  try {
    return `${new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} Kz`;
  } catch {
    return `${amountStr} Kz`;
  }
}

export function buildOrderConfirmationEmail(input: {
  buyerName: string;
  checkoutGroupId: string;
  orders: OrderConfirmedLine[];
}) {
  const base = env.FRONTEND_URL.replace(/\/$/, "");
  const ordersUrl = `${base}/orders`;
  const safeName = escapeHtml(input.buyerName.trim() || "Cliente");

  const linesHtml = input.orders
    .map((o) => {
      const shops = o.shopNames.map((s) => escapeHtml(s)).join(", ");
      return `<tr><td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;"><strong>${escapeHtml(o.orderCode)}</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;">${shops}</td><td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(formatMoneyKz(o.grandTotal))}</td></tr>`;
    })
    .join("");

  const linesText = input.orders
    .map((o) => `- ${o.orderCode} (${o.shopNames.join(", ")}) — ${formatMoneyKz(o.grandTotal)}`)
    .join("\n");

  const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.45;max-width:560px;">
        <h2 style="margin:0 0 12px;color:#0f172a;">Encomenda registada</h2>
        <p>Olá, ${safeName}.</p>
        <p>Obrigado pela sua compra no BAZAR DO BIÉ.</p>
        <p>${input.orders.length === 1 ? "O seu pedido foi registado com sucesso." : `Foram registados <strong>${input.orders.length}</strong> pedidos (lojas diferentes).`}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;background:#fafafa;border-radius:8px;overflow:hidden;border:1px solid #eee;">
          <thead><tr><th align="left" style="padding:10px 12px;background:#f1f5f9;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Pedido</th><th align="left" style="padding:10px 12px;background:#f1f5f9;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Loja(s)</th><th align="right" style="padding:10px 12px;background:#f1f5f9;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Total</th></tr></thead>
          <tbody>${linesHtml}</tbody>
        </table>
        <p style="margin:18px 0 10px;">
          <a href="${ordersUrl}" style="display:inline-block;padding:10px 16px;background:#e62e04;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
            Ver encomendas na conta
          </a>
        </p>
        <p style="font-size:12px;color:#64748b;margin-top:20px;">Referência interna do grupo: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${escapeHtml(input.checkoutGroupId)}</code></p>
        <p style="font-size:12px;color:#64748b;">Se não reconhece esta compra, contacte o suporte imediatamente.</p>
      </div>
    `;

  const text = [
    `Olá, ${input.buyerName.trim() || "Cliente"}.`,
    "",
    input.orders.length === 1
      ? "O seu pedido foi registado no BAZAR DO BIÉ."
      : `Foram registados ${input.orders.length} pedidos no BAZAR DO BIÉ.`,
    "",
    linesText,
    "",
    `Consulte as encomendas em: ${ordersUrl}`,
    `Grupo: ${input.checkoutGroupId}`,
  ].join("\n");

  return {
    subject:
      input.orders.length === 1
        ? `Pedido ${input.orders[0]!.orderCode} — BAZAR DO BIÉ`
        : `${input.orders.length} pedidos confirmados — BAZAR DO BIÉ`,
    html: html.trim(),
    text,
  };
}

/** Idempotente por grupo de checkout — não duplica se o checkout for repetido por engano. */
export async function enqueueOrderConfirmationEmail(input: {
  checkoutGroupId: string;
  buyerEmail: string;
  buyerName: string;
  orders: OrderConfirmedLine[];
}): Promise<void> {
  const { subject, html, text } = buildOrderConfirmationEmail({
    buyerName: input.buyerName,
    checkoutGroupId: input.checkoutGroupId,
    orders: input.orders,
  });
  await emailOutboxService.enqueueTransactionalEmail({
    templateKey: TEMPLATE_ORDER_CONFIRMED,
    dedupeKey: input.checkoutGroupId,
    toEmail: input.buyerEmail.trim().toLowerCase(),
    toName: input.buyerName.trim() || null,
    subject,
    html,
    text,
  });
}
