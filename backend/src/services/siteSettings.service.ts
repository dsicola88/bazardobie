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
    label: "Barra — mensagem (texto na faixa vermelha)",
    defaultValue: "",
    hint: "Texto curto na barra. Independente do texto do popup.",
  },
  "public.header_promo_bar_enabled": {
    label: "Barra promocional — activar",
    defaultValue: "",
    hint: "true / false, ou vazio para usar a configuração legada «Ativar promo» + modo barra.",
  },
  "public.header_promo_popup_enabled": {
    label: "Popup promocional — activar",
    defaultValue: "",
    hint: "true / false, ou vazio para usar a configuração legada «Ativar promo» + modo popup.",
  },
  "public.header_promo_enabled": {
    label: "Legado — ativar promo (barra ou popup)",
    defaultValue: "false",
    hint: "Preferir os switches «Barra» e «Popup» acima. Isto mantém compatibilidade com dados antigos.",
  },
  "public.header_promo_mode": {
    label: "Legado — modo único (bar | popup)",
    defaultValue: "bar",
    hint: "Usado só quando os novos switches estão vazios.",
  },
  "public.header_promo_bar_start_at": {
    label: "Barra — início (ISO ou datetime-local)",
    defaultValue: "",
    hint: "Vazio + campos legados abaixo: usa o intervalo legado partilhado.",
  },
  "public.header_promo_bar_end_at": {
    label: "Barra — fim",
    defaultValue: "",
  },
  "public.header_promo_popup_start_at": {
    label: "Popup — início",
    defaultValue: "",
  },
  "public.header_promo_popup_end_at": {
    label: "Popup — fim",
    defaultValue: "",
  },
  "public.header_promo_start_at": {
    label: "Legado — início (barra ou popup)",
    defaultValue: "",
    hint: "Intervalo único antigo; usado como fallback se barra/popup não tiver datas próprias.",
  },
  "public.header_promo_end_at": {
    label: "Legado — fim",
    defaultValue: "",
  },
  "public.header_promo_priority": {
    label: "Popup — prioridade (camadas)",
    defaultValue: "50",
    hint: "Número inteiro (maior = mais importante). Afecta sobretudo o popup.",
  },
  "public.header_promo_position": {
    label: "Popup — posição",
    defaultValue: "center",
    hint: "center, top-right, bottom-right.",
  },
  "public.header_promo_delay_seconds": {
    label: "Popup — atraso após entrar (segundos)",
    defaultValue: "2",
    hint: "Tempo até o popup aparecer (0–180).",
  },
  "public.header_promo_cta_text": {
    label: "Popup — texto do botão (CTA)",
    defaultValue: "Comprar agora",
  },
  "public.header_promo_link_url": {
    label: "Popup — link do botão",
    defaultValue: "",
    hint: "https://... ou caminho iniciado por /.",
  },
  "public.header_promo_price": {
    label: "Popup — preço em destaque",
    defaultValue: "",
    hint: "Ex.: Kz 9.900",
  },
  "public.header_promo_image_url": {
    label: "Popup — imagem do card",
    defaultValue: "",
    hint: "Só o popup usa imagem; a barra é só texto e chips.",
  },
  "public.header_promo_popup_text": {
    label: "Popup — mensagem principal",
    defaultValue: "",
    hint: "Se vazio, usa o texto da barra como fallback.",
  },
  "public.header_promo_keywords": {
    label: "Barra — chips (separados por |)",
    defaultValue: "Super oferta|Entrega rapida|Preco baixo|Qualidade verificada",
    hint: "Até 4 chips na barra.",
  },
  "public.header_promo_popup_keywords": {
    label: "Popup — chips (separados por |)",
    defaultValue: "",
    hint: "Vazio = reutiliza os chips da barra no card do popup.",
  },
  "public.header_promo_marquee": {
    label: "Barra — animar chips (marquee)",
    defaultValue: "true",
    hint: "true / 1 / sim para animar a faixa.",
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
  "public.terms_partners_doc_ref": {
    label: "Termos parceiros — linha «Referência» (documento público)",
    defaultValue: "",
    hint:
      'Vazio = texto por defeito (ex.: "Maio de 2026"). Aparece no cabeçalho imprimível de /termos-parceiros.',
  },
  "public.terms_partners_footer_note": {
    label: "Termos parceiros — rodapé do documento",
    defaultValue: "",
    hint:
      "Vazio = texto por defeito. Disponível apenas em texto corrido ou listas (- item por linha, blocos separados por linha em branco).",
  },
  "public.terms_partners_s01": {
    label: 'Termos parceiros — secção «1. Âmbito e natureza»',
    defaultValue: "",
    hint:
      "Vazio = texto jurídico por defeito. Opcional primeira linha # Título. Parágrafos separados por linha em blanco; listas com cada linha - item.",
  },
  "public.terms_partners_s02": {
    label: 'Termos parceiros — secção «2. Adesão e conta»',
    defaultValue: "",
    hint: "Vazio = defeito da aplicação. Formato igual à secção anterior.",
  },
  "public.terms_partners_s03": {
    label: 'Termos parceiros — secção «3. Comissão»',
    defaultValue: "",
    hint: "Vazio = defeito da aplicação.",
  },
  "public.terms_partners_s04": {
    label: 'Termos parceiros — secção «4. Envio e rastreamento»',
    defaultValue: "",
    hint: "Vazio = defeito da aplicação.",
  },
  "public.terms_partners_s05": {
    label: 'Termos parceiros — secção «5. Escrow e disputas»',
    defaultValue: "",
    hint: "Vazio = defeito da aplicação.",
  },
  "public.terms_partners_s06": {
    label: 'Termos parceiros — secção «6. Credibilização»',
    defaultValue: "",
    hint: "Vazio = defeito da aplicação.",
  },
  "public.terms_partners_s07": {
    label: 'Termos parceiros — secção «7. Obrigações»',
    defaultValue: "",
    hint: "Vazio = defeito da aplicação.",
  },
  "public.terms_partners_s08": {
    label: 'Termos parceiros — secção «8. Suspensão»',
    defaultValue: "",
    hint: "Vazio = defeito da aplicação.",
  },
  "public.terms_partners_s09": {
    label: 'Termos parceiros — secção «9. Dados pessoais»',
    defaultValue: "",
    hint: "Vazio = defeito da aplicação.",
  },
  "public.terms_partners_s10": {
    label: 'Termos parceiros — secção «10. Alterações»',
    defaultValue: "",
    hint: "Vazio = defeito da aplicação.",
  },
  "public.terms_partners_s11": {
    label: 'Termos parceiros — secção «11. Contacto»',
    defaultValue: "",
    hint: "Vazio = defeito da aplicação.",
  },
};

/** Chaves só deste documento legal (painel próprio ADMIN + SUPORTE). */
export const PARTNER_TERMS_SITE_KEYS = [
  "public.terms_partners_doc_ref",
  "public.terms_partners_footer_note",
  "public.terms_partners_s01",
  "public.terms_partners_s02",
  "public.terms_partners_s03",
  "public.terms_partners_s04",
  "public.terms_partners_s05",
  "public.terms_partners_s06",
  "public.terms_partners_s07",
  "public.terms_partners_s08",
  "public.terms_partners_s09",
  "public.terms_partners_s10",
  "public.terms_partners_s11",
] as const;

const PARTNER_TERMS_SITE_KEY_SET = new Set<string>(PARTNER_TERMS_SITE_KEYS);

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

  async listPartnerTermsForAdmin() {
    const keys = [...PARTNER_TERMS_SITE_KEYS];
    try {
      const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } });
      const rowMap = new Map(rows.map((r) => [r.key, r.value]));
      return keys.map((key) => {
        const def = SITE_SETTING_DEFS[key];
        const value = rowMap.get(key);
        return {
          key,
          label: def.label,
          hint: def.hint,
          value: value ?? def.defaultValue,
          defaultValue: def.defaultValue,
        };
      });
    } catch (e) {
      warnSiteSettingRead("listPartnerTermsForAdmin", e);
      return keys.map((key) => {
        const def = SITE_SETTING_DEFS[key];
        return {
          key,
          label: def.label,
          hint: def.hint,
          value: def.defaultValue,
          defaultValue: def.defaultValue,
        };
      });
    }
  },

  async upsertPartnerTerms(pairs: Record<string, string>) {
    const maxLen = 80_000;
    const filtered: Record<string, string> = {};
    for (const [key, raw] of Object.entries(pairs)) {
      if (!PARTNER_TERMS_SITE_KEY_SET.has(key)) continue;
      if (typeof raw !== "string") continue;
      if (raw.length > maxLen) {
        throw new HttpError(400, `Campo "${key}" excede o limite (${maxLen} caracteres).`, {
          code: "PARTNER_TERMS_TOO_LONG",
        });
      }
      filtered[key] = raw;
    }
    return this.upsertMany(filtered);
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
