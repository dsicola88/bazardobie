import { apiFetch } from "../api.js";

/** Retoma liquidação electrónica (MOCK ou gateway real configurado no backend). */
export async function resumeCheckoutPayment(token: string, checkoutGroupId: string): Promise<void> {
  const sess = await apiFetch<{ approveUrl?: string }>(
    `/checkout/group/${encodeURIComponent(checkoutGroupId)}/pay`,
    { method: "POST", token, body: JSON.stringify({ provider: "MOCK" }) }
  );
  if (sess.approveUrl) window.location.assign(sess.approveUrl);
  else alert("Resposta sem URL de liquidação (ambiente de demonstração).");
}
