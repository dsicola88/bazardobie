/** Valores iniciais (espelham o backend até `GET /site-content` responder). */
export const SITE_CONTENT_DEFAULTS: Record<string, string> = {
  "public.site_tagline": "comércio electrónico em Angola",
  "public.support_phone_display": "926 51 02 94",
  "public.support_phone_tel": "+244926510294",
  "public.footer_brand_subtitle": "Angola · lojas nacionais · preços em Kz",
  "public.footer_col_trust": "COD · verificação de lojas · avaliações · entrega local",
  "public.footer_col_support":
    "Suporte BAZAR DO BIÉ: ligue ou envie mensagem para o número indicado na barra inferior.",
  "public.favicon_url": "",
  "public.header_promo_text": "",
  "public.header_promo_enabled": "false",
  "public.header_promo_mode": "bar",
  "public.header_promo_start_at": "",
  "public.header_promo_end_at": "",
  "public.header_promo_priority": "50",
  "public.header_promo_position": "center",
  "public.header_promo_delay_seconds": "2",
  "public.header_promo_cta_text": "Comprar agora",
  "public.header_promo_link_url": "",
  "public.header_promo_price": "",
  "public.header_promo_image_url": "",
  "public.header_promo_keywords": "Super oferta|Entrega rapida|Preco baixo|Qualidade verificada",
  "public.header_promo_marquee": "true",
  "public.header_category_bar_enabled": "true",
  "public.home_hero_fallback": "BAZAR DO BIÉ — Marketplace nacional",
  "public.home_featured_title": "Sugestões em destaque",
  "public.home_bestsellers_title": "Mais vendidos",
  "public.home_category_rail_title": "Explore por categoria",
  "public.home_flash_deals_enabled": "true",
  "public.home_flash_deals_title": "Ofertas do dia · preços rebaixados",
  "public.home_flash_deals_subtitle":
    "Seleção editorial de artigos em promoção. Stock e prazos dependem da loja — primeiro a encomendar, primeiro a garantir.",
  "public.home_flash_deals_end_at": "",
  "public.home_flash_deals_cta": "Ver todas as promoções",
  "public.home_flash_deals_link": "",
  "public.home_pulse_tags": "Lojas nacionais|Envio em Kz|Pagamento COD quando disponível|Ofertas diárias",
  "public.trust_strip_1":
    "Pagamento à entrega|Kwanzas ao receber, quando a loja oferece COD.",
  "public.trust_strip_2": "Lojas verificadas|Níveis BI · NIF · dados bancários.",
  "public.trust_strip_3": "Envio nacional|Prazos e custos segundo a loja e a zona.",
  "public.trust_strip_4": "Avaliar com fotos|Após estado ENTREGUE · até 6 URLs.",
  "public.product_cod_note":
    "Principal: pagamento na entrega (COD) — paga quando recebes. Opcional: transferência com comprovativo, Multicaixa / online quando a loja ou a plataforma o suportarem.",
  "public.allow_seller_delivery": "false",
  "public.vendor_help_channel_url": "",
  "public.checkout_transfer_instructions":
    "Transfira o montante total do pedido para a conta que a loja ou o suporte BAZAR DO BIÉ lhe indicar (confirme sempre os dados por canal oficial).\n\nDepois de efectuar a transferência, guarde o comprovativo (PDF ou foto), coloque-o num serviço acessível por HTTPS (drive, etc.) e cole o link no campo «Link do comprovativo».",
};

export function mergeSiteContent(api: Record<string, string>): Record<string, string> {
  return { ...SITE_CONTENT_DEFAULTS, ...api };
}

export function parseTrustCell(raw: string): { title: string; body: string } {
  const i = raw.indexOf("|");
  if (i < 0) return { title: raw.trim(), body: "" };
  return { title: raw.slice(0, i).trim(), body: raw.slice(i + 1).trim() };
}

export function parseSiteTruthy(raw: string | undefined, fallback = "false"): boolean {
  const v = String(raw ?? fallback).trim().toLowerCase();
  return v === "true" || v === "1" || v === "sim" || v === "yes";
}

export function splitPipeTags(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}
