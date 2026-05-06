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
  "public.header_promo_text": {
    label: "Barra promocional (topo, abaixo da pesquisa)",
    defaultValue: "",
    hint: "Deixe vazio para ocultar. Texto curto (ex.: campanha, envio grátis acima de X Kz).",
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
