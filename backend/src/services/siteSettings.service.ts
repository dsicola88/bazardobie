import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";

/** Chaves permitidas no painel (prefixo public. = expostas no site). */
export const SITE_SETTING_DEFS: Record<string, { label: string; defaultValue: string; hint?: string }> = {
  "public.site_tagline": {
    label: "Slogan (linha institucional)",
    defaultValue: "comércio electrónico em Angola",
    hint: "Aparece junto ao copyright no rodapé.",
  },
  "public.support_phone_display": {
    label: "Telefone suporte (texto)",
    defaultValue: "926 51 02 94",
    hint: "Como mostrar ao utilizador.",
  },
  "public.support_phone_tel": {
    label: "Telefone suporte (ligação)",
    defaultValue: "+244926510294",
    hint: "Para href=tel: — inclua código do país.",
  },
  "public.footer_brand_subtitle": {
    label: "Rodapé — descrição da marca",
    defaultValue: "Angola · lojas nacionais · preços em Kz",
  },
  "public.footer_col_trust": {
    label: "Rodapé — bloco «Confiança»",
    defaultValue: "COD · verificação de lojas · avaliações · entrega local",
  },
  "public.footer_col_support": {
    label: "Rodapé — bloco «Apoio ao cliente»",
    defaultValue:
      "Suporte BAZAR DO BIÉ: ligue ou envie mensagem para o número indicado na barra inferior.",
  },
  "public.favicon_url": {
    label: "Favicon (URL ou /uploads/...)",
    defaultValue: "",
    hint: "Use ícone quadrado (.ico, .png ou .svg). Pode fazer upload no painel e colar aqui a URL retornada.",
  },
  "public.header_promo_text": {
    label: "Barra promocional (topo, abaixo da pesquisa)",
    defaultValue: "",
    hint: "Deixe vazio para ocultar. Texto curto (ex.: campanha, envio grátis acima de X Kz).",
  },
  "public.header_promo_enabled": {
    label: "Ativar barra/popup promocional",
    defaultValue: "false",
    hint: "Se false, nada aparece no topo (nem barra nem popup).",
  },
  "public.header_promo_mode": {
    label: "Modo da promo",
    defaultValue: "bar",
    hint: "bar = barra vermelha compacta. popup = mostra um popup ao visitar.",
  },
  "public.header_promo_start_at": {
    label: "Promo — início (ISO ou data)",
    defaultValue: "",
    hint: "Ex.: 2026-05-10 ou 2026-05-10T08:00:00Z. Vazio = inicia imediatamente.",
  },
  "public.header_promo_end_at": {
    label: "Promo — fim (ISO ou data)",
    defaultValue: "",
    hint: "Ex.: 2026-05-15 ou 2026-05-15T23:59:00Z. Vazio = sem data final.",
  },
  "public.header_promo_priority": {
    label: "Promo — prioridade",
    defaultValue: "50",
    hint: "Número inteiro (maior = mais importante). Útil para gestão de campanhas.",
  },
  "public.header_promo_position": {
    label: "Promo — posição do popup",
    defaultValue: "center",
    hint: "center, top-right, bottom-right.",
  },
  "public.header_promo_delay_seconds": {
    label: "Promo — atraso para aparecer (segundos)",
    defaultValue: "2",
    hint: "Tempo após o utilizador entrar na app para disparar o popup.",
  },
  "public.header_promo_cta_text": {
    label: "Promo — texto do botão (CTA)",
    defaultValue: "Comprar agora",
  },
  "public.header_promo_link_url": {
    label: "Promo — link do botão (popup)",
    defaultValue: "",
    hint: "URL clicável do CTA no popup. Aceita https://... ou caminho interno iniciado por /.",
  },
  "public.header_promo_price": {
    label: "Promo — preço em destaque",
    defaultValue: "",
    hint: "Ex.: Kz 9.900 ou US $1.33",
  },
  "public.header_promo_image_url": {
    label: "Promo — imagem principal (URL ou /uploads/...)",
    defaultValue: "",
    hint: "Imagem do topo do card promocional.",
  },
  "public.header_promo_keywords": {
    label: "Barra promocional — palavras em destaque (separadas por |)",
    defaultValue: "Super oferta|Entrega rapida|Preco baixo|Qualidade verificada",
    hint: "Ex.: Smartphone|Moda|Eletronica|Casa. As palavras rodam com animacao no topo.",
  },
  "public.header_promo_marquee": {
    label: "Barra promocional — activar faixa animada",
    defaultValue: "true",
    hint: "true / 1 / sim para animar a faixa de promocoes estilo marketplace.",
  },
  "public.header_category_bar_enabled": {
    label: "Barra de categorias (topo) — activar",
    defaultValue: "true",
    hint: "true / 1 / sim para mostrar a barra de categorias abaixo do cabeçalho.",
  },
  "public.home_hero_fallback": {
    label: "Mensagem quando não há banners",
      defaultValue: "BAZAR DO BIÉ — Marketplace nacional",
  },
  "public.home_featured_title": {
    label: "Título — secção em destaque",
    defaultValue: "Sugestões em destaque",
  },
  "public.home_bestsellers_title": {
    label: "Título — mais vendidos",
    defaultValue: "Mais vendidos",
  },
  "public.home_category_rail_title": {
    label: "Home — título do carril de categorias",
    defaultValue: "Explore por categoria",
    hint: "Aparece acima do mega-menu de categorias na página inicial.",
  },
  "public.home_flash_deals_enabled": {
    label: "Home — faixa «Ofertas do dia» (activar)",
    defaultValue: "true",
    hint: "true / 1 / sim: mostra a faixa horizontal com countdown e produtos em promoção.",
  },
  "public.home_flash_deals_title": {
    label: "Home — «Ofertas do dia» (título)",
    defaultValue: "Ofertas do dia · preços rebaixados",
  },
  "public.home_flash_deals_subtitle": {
    label: "Home — «Ofertas do dia» (subtítulo)",
    defaultValue:
      "Seleção editorial de artigos em promoção. Stock e prazos dependem da loja — primeiro a encomendar, primeiro a garantir.",
  },
  "public.home_flash_deals_end_at": {
    label: "Home — «Ofertas do dia» — fim da janela (ISO)",
    defaultValue: "",
    hint: "Ex.: 2026-05-10T21:59:00+01:00. Vazio = sem contagem decrescente a mostrar.",
  },
  "public.home_flash_deals_cta": {
    label: "Home — «Ofertas do dia» — texto do botão",
    defaultValue: "Ver todas as promoções",
  },
  "public.home_flash_deals_link": {
    label: "Home — «Ofertas do dia» — link do botão (opcional)",
    defaultValue: "",
    hint: "Vazio = /search?onSale=true&sort=preco_asc. Ou URL/caminho próprio iniciado por /.",
  },
  "public.home_pulse_tags": {
    label: "Home — benefícios (separados por |)",
    defaultValue: "Lojas nacionais|Envio em Kz|Pagamento COD quando disponível|Ofertas diárias",
    hint: "Faixa discreta sob as ofertas do dia.",
  },
  "public.trust_strip_1": {
    label: "Faixa de confiança — cartão 1 (título|texto)",
    defaultValue: "Pagamento à entrega|Kwanzas ao receber, quando a loja oferece COD.",
  },
  "public.trust_strip_2": {
    label: "Faixa de confiança — cartão 2",
    defaultValue: "Lojas verificadas|Níveis BI · NIF · dados bancários.",
  },
  "public.trust_strip_3": {
    label: "Faixa de confiança — cartão 3",
    defaultValue: "Envio nacional|Prazos e custos segundo a loja e a zona.",
  },
  "public.trust_strip_4": {
    label: "Faixa de confiança — cartão 4",
    defaultValue: "Avaliar com fotos|Após estado ENTREGUE · até 6 URLs.",
  },
  "public.product_cod_note": {
    label: "Produto — nota de pagamento (abaixo dos botões)",
    defaultValue:
      "Principal: pagamento na entrega (COD) — paga quando recebes. Opcional: transferência com comprovativo, Multicaixa / online quando a loja ou a plataforma o suportarem.",
  },
  "public.allow_seller_delivery": {
    label: "Marketplace — permitir envio pela loja (vendedor)",
    defaultValue: "false",
    hint: "Por defeito só o envio BAZAR DO BIÉ (plataforma) está disponível nos anúncios. Defina como true / 1 / sim para as lojas poderem oferecer envio próprio.",
  },
  "public.vendor_help_channel_url": {
    label: "Vendedor — link do canal de ajuda (dashboard/menu)",
    defaultValue: "",
    hint: "Ex.: canal no YouTube com vídeos de treinamento para vendedores.",
  },
  "public.checkout_transfer_instructions": {
    label: "Checkout — instruções para transferência bancária",
    defaultValue:
      "Transfira o montante total da encomenda para a conta que a loja ou o suporte BAZAR DO BIÉ lhe indicar (confirme sempre os dados por canal oficial).\n\nDepois de efectuar a transferência, pode carregar o comprovativo (foto ou PDF, até 5 MB) directamente no checkout ou, em alternativa, publicar o ficheiro num serviço com link HTTPS e colar o endereço no campo do formulário.",
    hint: "Texto multilinha mostrado no checkout quando o cliente escolhe «Transferência». Pode incluir IBAN, nome do titular e referências.",
  },
  "public.distance_freight_enabled": {
    label: "Frete por distância — activar no checkout",
    defaultValue: "false",
    hint: "true / 1 / sim: o porte do pedido passa a ser calculado por faixas de km (origem loja ou hub da plataforma → localidade de entrega). O cliente escolhe a localidade no checkout.",
  },
  "logistics.platform_freight_hub_lat": {
    label: "Frete — latitude do hub (envio BAZAR DO BIÉ), WGS‑84",
    defaultValue: "",
    hint: "Ex.: -8.8383. Obrigatório quando o modo por distância está activo e há pedidos com envio pela plataforma. Não é exposto no site público.",
  },
  "logistics.platform_freight_hub_lng": {
    label: "Frete — longitude do hub (envio BAZAR DO BIÉ), WGS‑84",
    defaultValue: "",
    hint: "Ex.: 13.2344. Par da latitude acima.",
  },
  "public.zone_freight_enabled": {
    label: "Frete por zona (morada) — activar no checkout",
    defaultValue: "false",
    hint:
      "true / 1 / sim: o porte vem da tabela «Zonas por cidade» (província + cidade do endereço). Tem prioridade sobre o frete por distância GPS. Ex.: Luanda + Talatona → preço cadastrado.",
  },
  "logistics.platform_commission_bps": {
    label: "Comissão da plataforma (basis points)",
    defaultValue: "500",
    hint: "500 = 5%, 1000 = 10%. Usado em relatórios e painel financeiro/admin.",
  },
};

const ALLOWED_KEYS = new Set(Object.keys(SITE_SETTING_DEFS));

/** Aceita true / 1 / sim / yes (minúsculas). */
export function parseTruthySetting(raw: string | undefined, fallback: string): boolean {
  const v = (raw ?? fallback).trim().toLowerCase();
  return v === "true" || v === "1" || v === "sim" || v === "yes";
}

export function defaultPublicMap(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const [k, d] of Object.entries(SITE_SETTING_DEFS)) {
    m[k] = d.defaultValue;
  }
  return m;
}

const DEF_ALLOW_SELLER = SITE_SETTING_DEFS["public.allow_seller_delivery"].defaultValue;
const DEF_PLATFORM_COMMISSION_BPS = SITE_SETTING_DEFS["logistics.platform_commission_bps"].defaultValue;

function warnSiteSettingRead(method: string, err: unknown): void {
  console.warn(
    `[siteSettings.${method}] Tabela SiteSetting inacessível ou migrações em falta — a usar valores por defeito. ` +
      `Execute: npx prisma migrate deploy. Detalhe:`,
    err
  );
}

export const siteSettingsService = {
  async getPublicMap(): Promise<Record<string, string>> {
    try {
      const rows = await prisma.siteSetting.findMany({
        where: { key: { startsWith: "public." } },
      });
      const base = defaultPublicMap();
      for (const r of rows) {
        if (ALLOWED_KEYS.has(r.key)) base[r.key] = r.value;
      }
      return base;
    } catch (e) {
      warnSiteSettingRead("getPublicMap", e);
      return defaultPublicMap();
    }
  },

  async isSellerDeliveryAllowed(): Promise<boolean> {
    try {
      const row = await prisma.siteSetting.findUnique({
        where: { key: "public.allow_seller_delivery" },
      });
      return parseTruthySetting(row?.value, DEF_ALLOW_SELLER);
    } catch (e) {
      warnSiteSettingRead("isSellerDeliveryAllowed", e);
      return parseTruthySetting(undefined, DEF_ALLOW_SELLER);
    }
  },

  async getPlatformCommissionBps(): Promise<number> {
    try {
      const row = await prisma.siteSetting.findUnique({
        where: { key: "logistics.platform_commission_bps" },
      });
      const n = Number((row?.value ?? DEF_PLATFORM_COMMISSION_BPS).trim());
      if (!Number.isFinite(n) || n < 0) return Number(DEF_PLATFORM_COMMISSION_BPS);
      return Math.round(n);
    } catch (e) {
      warnSiteSettingRead("getPlatformCommissionBps", e);
      return Number(DEF_PLATFORM_COMMISSION_BPS);
    }
  },

  async listForAdmin() {
    const base = SITE_SETTING_DEFS;
    try {
      const rows = await prisma.siteSetting.findMany();
      const rowMap = new Map(rows.map((r) => [r.key, r]));
      return Object.entries(base).map(([key, def]) => ({
        key,
        label: def.label,
        value: rowMap.get(key)?.value ?? def.defaultValue,
        defaultValue: def.defaultValue,
        hint: def.hint,
      }));
    } catch (e) {
      warnSiteSettingRead("listForAdmin", e);
      return Object.entries(base).map(([key, def]) => ({
        key,
        label: def.label,
        value: def.defaultValue,
        defaultValue: def.defaultValue,
        hint: def.hint,
      }));
    }
  },

  async upsertMany(pairs: Record<string, string>) {
    const entries = Object.entries(pairs).filter(([, v]) => v !== undefined);
    for (const [key] of entries) {
      if (!ALLOWED_KEYS.has(key)) {
        throw new HttpError(400, `Chave não permitida: ${key}`);
      }
    }
    if (entries.length) {
      await prisma.$transaction(
        entries.map(([key, value]) =>
          prisma.siteSetting.upsert({
            where: { key },
            create: {
              key,
              value,
              label: SITE_SETTING_DEFS[key]?.label,
            },
            update: { value },
          })
        )
      );
    }
    return this.getPublicMap();
  },

  async seedDefaultsIfEmpty() {
    try {
      const n = await prisma.siteSetting.count();
      if (n > 0) return;
      const data = Object.entries(SITE_SETTING_DEFS).map(([key, d]) => ({
        key,
        value: d.defaultValue,
        label: d.label,
      }));
      await prisma.siteSetting.createMany({ data });
    } catch (e) {
      warnSiteSettingRead("seedDefaultsIfEmpty", e);
    }
  },
};
