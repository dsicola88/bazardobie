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
  "public.header_logo_url": "",
  "public.header_promo_text": "",
  "public.header_promo_bar_enabled": "",
  "public.header_promo_popup_enabled": "",
  "public.header_promo_enabled": "false",
  "public.header_promo_mode": "bar",
  "public.header_promo_bar_start_at": "",
  "public.header_promo_bar_end_at": "",
  "public.header_promo_popup_start_at": "",
  "public.header_promo_popup_end_at": "",
  "public.header_promo_start_at": "",
  "public.header_promo_end_at": "",
  "public.header_promo_priority": "50",
  "public.header_promo_position": "center",
  "public.header_promo_delay_seconds": "2",
  "public.header_promo_cta_text": "Comprar agora",
  "public.header_promo_link_url": "",
  "public.header_promo_price": "",
  "public.header_promo_image_url": "",
  "public.header_promo_keywords": "Super oferta|Entrega rápida|Preço baixo|Qualidade verificada",
  "public.header_promo_popup_text": "",
  "public.header_promo_popup_keywords": "",
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
  "public.home_flash_deals_surface_bg":
    "linear-gradient(135deg, rgb(14 26 53) 0%, rgb(30 41 59) 38%, rgb(102 34 52) 112%)",
  "public.home_flash_deals_rail_bg":
    "linear-gradient(180deg, rgb(15 23 42 / 0.45) 0%, rgb(10 17 37 / 0.55) 100%)",
  "public.home_flash_deals_text_color": "rgb(248 250 252)",
  "public.home_flash_deals_muted_text_color": "rgb(226 232 240 / 0.88)",
  "public.home_showcase_card_bg": "#ffffff",
  "public.home_showcase_head_bg": "#ffffff",
  "public.home_showcase_shell_bg": "",
  "public.home_group_strip_header_bg":
    "linear-gradient(135deg, rgb(248 250 252) 0%, rgb(255 255 255) 68%)",
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
  "public.terms_partners_doc_ref": "",
  "public.terms_partners_footer_note": "",
  "public.terms_partners_s01": "",
  "public.terms_partners_s02": "",
  "public.terms_partners_s03": "",
  "public.terms_partners_s04": "",
  "public.terms_partners_s05": "",
  "public.terms_partners_s06": "",
  "public.terms_partners_s07": "",
  "public.terms_partners_s08": "",
  "public.terms_partners_s09": "",
  "public.terms_partners_s10": "",
  "public.terms_partners_s11": "",
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
