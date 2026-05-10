import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { buildSearchPath } from "../buildSearchPath.js";
import { resolveMediaUrl } from "../utils/media.js";
import { useSeo } from "../seo/useSeo.js";
import { StarRating } from "../components/StarRating.js";

type SobrePayload = {
  loja: {
    id: string;
    name: string;
    description?: string | null;
    province: string;
    city: string;
    logoUrl?: string | null;
    /** ISO — registo na plataforma */
    membroDesde?: string;
  };
  sinais: { id: string; label: string; ok: boolean }[];
  metricas: {
    pedidosEntregues: number;
    entregasUnidades: number;
    taxaRespostaPercent: number | null;
    taxaRespostaBaseConversas: number;
    avaliacaoMedia: number | null;
    avaliacaoAspectos: {
      produto: number | null;
      comunicacao: number | null;
      entrega: number | null;
    } | null;
    totalAvaliacoes: number;
    revisaoPositivaPercent: number | null;
    vendasSemDisputaPercent: number | null;
    pedidosComDisputaEntregues: number;
    novoVendedor: boolean;
    reputacaoHintPt: string | null;
    avaliacoesMinimoParaMediaPublica: number;
    produtosActivos: number;
    vendasRegistadasCatalogo: number;
    ultimaActividadeEm: string;
  };
  resumoReputacao: {
    seloVerificado: boolean;
    seloPremium: boolean;
    nivelConfianca: number;
    textoChips: string[];
    fachadaParceiraUrl: string | null;
  };
};

type ShopOutletCtx = { storefrontShell?: boolean } | undefined;

function formatMembroDesdePt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-AO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function ultimaActividadeLegivel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t1 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((t0 - t1) / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays > 0 && diffDays < 7) return `Há ${diffDays} dias`;
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default function ShopPublicAboutPage() {
  const { shopId } = useParams();
  const storefrontShell = Boolean(useOutletContext<ShopOutletCtx>()?.storefrontShell);
  const [data, setData] = useState<SobrePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    setData(null);
    setErr(null);
    void apiFetch<SobrePayload>(`/shops/${encodeURIComponent(shopId)}/sobre`)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Loja não encontrada.");
      });
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const nome = data?.loja.name ?? "Loja parceira";

  useSeo({
    title: data ? `Sobre ${nome} — BAZAR DO BIÉ` : "Sobre a loja — BAZAR DO BIÉ",
    description: data
      ? `Confiança, reputação e métricas públicas de ${nome} no marketplace BAZAR DO BIÉ.`
      : "Perfil público da loja parceira.",
    canonicalPath: shopId ? `/loja/${shopId}/sobre` : "/loja",
  });

  if (err) {
    return (
      <div className="page-panel" style={{ color: "#b00020" }}>
        {err}
      </div>
    );
  }
  if (!data) {
    return <p className="ae-muted">A carregar informação da loja…</p>;
  }

  const { loja, sinais, metricas, resumoReputacao } = data;
  const logo = resolveMediaUrl(loja.logoUrl ?? "");
  const taxa =
    metricas.taxaRespostaPercent != null
      ? `${metricas.taxaRespostaPercent}% (amostra: ${metricas.taxaRespostaBaseConversas} conversas com comprador)`
      : metricas.taxaRespostaBaseConversas > 0
        ? `Em consolidação (${metricas.taxaRespostaBaseConversas} conversas; mínimo 3 para percentagem)`
        : "Ainda sem amostra suficiente nas conversas recentes";

  return (
    <>
      <div className="ae-breadcrumb">
        <Link to="/">Início</Link>
        <span>/</span>
        <Link to="/search">Catálogo</Link>
        <span>/</span>
        {storefrontShell && shopId ? (
          <>
            <Link to={`/loja/${encodeURIComponent(shopId)}`}>{loja.name}</Link>
            <span>/</span>
          </>
        ) : null}
        <span>{storefrontShell ? "Confiança e detalhes" : "Sobre a loja"}</span>
      </div>

      {storefrontShell ? (
        <section className="page-panel ae-storefront-panel ae-storefront-about-intro">
          <h2 className="ae-storefront-h2" style={{ marginTop: 0 }}>
            Credibilidade, métricas e verificações
          </h2>
          <p className="ae-muted" style={{ margin: "6px 0 0", maxWidth: 720 }}>
            Informação institucional da equipa <strong>BAZAR DO BIÉ</strong> sobre este parceiro — transparência sem expor dados
            sensíveis.
          </p>
        </section>
      ) : (
        <header className="ae-shop-sobre-hero page-panel">
          <div className="ae-shop-sobre-hero__main">
            <div className="ae-shop-sobre-logo">
              {logo ? <img src={logo} alt="" /> : <span className="ae-shop-sobre-logo__ph" />}
            </div>
            <div>
            <h1 className="ae-shop-sobre-title">{loja.name}</h1>
            <p className="ae-muted" style={{ margin: "4px 0 0" }}>
              {loja.city}, {loja.province} · Angola
            </p>
            {loja.membroDesde ? (
              <p className="ae-muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
                Na plataforma desde {formatMembroDesdePt(loja.membroDesde)}
              </p>
            ) : null}
            <div className="ae-shop-sobre-badges" style={{ marginTop: 12 }}>
              {resumoReputacao.seloPremium ? (
                <span className="ae-buybox__chip ae-buybox__chip--premium">Parceiro premium</span>
              ) : null}
              {resumoReputacao.seloVerificado ? (
                <span className="ae-buybox__chip ae-buybox__chip--verified">Parceiro verificado</span>
              ) : (
                <span className="ae-buybox__chip">Parceiro em desenvolvimento de confiança</span>
              )}
              <span className="ae-buybox__chip">Nível {resumoReputacao.nivelConfianca} / 3</span>
              {metricas.novoVendedor ? (
                <span className="ae-buybox__chip" title={metricas.reputacaoHintPt ?? undefined}>
                  Novo vendedor · reputação em formação
                </span>
              ) : null}
            </div>
            <p style={{ marginTop: 14 }}>
              <Link
                className="ae-btn-lg ae-section__cta ae-section__cta--ghost"
                to={buildSearchPath("/search", new URLSearchParams(), { shopId: loja.id })}
                title="Abre o catálogo público com filtros: só artigos desta loja parceira."
              >
                Ver artigos desta loja
              </Link>
            </p>
            <p className="ae-muted" style={{ marginTop: 8, fontSize: 12, maxWidth: 520, lineHeight: 1.45 }}>
              O catálogo é o mesmo do marketplace, limitado a esta loja — pode ordenar, filtrar por categoria e abrir cada
              artigo normalmente.
            </p>
          </div>
        </div>
        </header>
      )}

      <section className="page-panel ae-shop-sobre-metrics" aria-label="Métricas públicas">
        <h2 className="ae-shop-sobre-h2">Métricas e reputação</h2>
        <p className="ae-muted" style={{ marginTop: -4, marginBottom: 12, fontSize: 12, maxWidth: 760 }}>
          As métricas abaixo (opiniões, médias, unidades vendidas e entregues, número de pedidos entregues, taxa «sem disputa»
          e última actualização relacionada ao catálogo) aplicam apenas a linhas/anúncios públicos nesta loja — o mesmo âmbito
          que «Avaliações».{" "}
          A taxa de resposta no chat é uma amostra global de conversas com o vendedor, independente dos artigos da vitrina.
        </p>
        {metricas.reputacaoHintPt ? (
          <p className="ae-muted" style={{ marginTop: 4, maxWidth: 820, fontSize: 13, lineHeight: 1.5 }}>
            {metricas.reputacaoHintPt}
          </p>
        ) : null}
        <div className="ae-shop-sobre-grid">
          <div className="ae-shop-sobre-stat">
            <span className="ae-shop-sobre-stat__val">{metricas.totalAvaliacoes}</span>
            <span className="ae-shop-sobre-stat__lbl">Avaliações em produtos</span>
            {metricas.avaliacaoMedia != null ? (
              <div className="ae-muted" style={{ fontSize: 13, marginTop: 8 }}>
                <StarRating value={metricas.avaliacaoMedia} size="sm" showValue />
                <span style={{ marginLeft: 6 }}>experiência global (média pública)</span>
              </div>
            ) : (
              <span className="ae-muted" style={{ fontSize: 13 }}>
                Média oculta até {metricas.avaliacoesMinimoParaMediaPublica}+ avaliações verificadas · actualmente{" "}
                {metricas.totalAvaliacoes}
              </span>
            )}
            {metricas.avaliacaoAspectos != null &&
            (metricas.avaliacaoAspectos.produto != null ||
              metricas.avaliacaoAspectos.comunicacao != null ||
              metricas.avaliacaoAspectos.entrega != null) ? (
              <ul className="ae-muted" style={{ fontSize: 12, margin: "10px 0 0", paddingLeft: 18 }}>
                {metricas.avaliacaoAspectos.produto != null ? (
                  <li>Qualidade do produto (média): {metricas.avaliacaoAspectos.produto}/5</li>
                ) : null}
                {metricas.avaliacaoAspectos.comunicacao != null ? (
                  <li>Comunicação do vendedor: {metricas.avaliacaoAspectos.comunicacao}/5</li>
                ) : null}
                {metricas.avaliacaoAspectos.entrega != null ? (
                  <li>Entrega / logística: {metricas.avaliacaoAspectos.entrega}/5</li>
                ) : null}
              </ul>
            ) : null}
            {metricas.revisaoPositivaPercent != null ? (
              <p className="ae-muted" style={{ fontSize: 13, marginTop: 10 }}>
                <strong>{metricas.revisaoPositivaPercent}%</strong> das opiniões com nota ≥4★ (de{" "}
                {metricas.totalAvaliacoes.toLocaleString("pt-PT")} avaliações registadas nos produtos da loja).
              </p>
            ) : null}
          </div>
          <div className="ae-shop-sobre-stat">
            <span className="ae-shop-sobre-stat__val">{metricas.vendasRegistadasCatalogo.toLocaleString("pt-PT")}</span>
            <span className="ae-shop-sobre-stat__lbl">Unidades vendidas (registo do catálogo)</span>
          </div>
          <div className="ae-shop-sobre-stat">
            <span className="ae-shop-sobre-stat__val">{metricas.entregasUnidades.toLocaleString("pt-PT")}</span>
            <span className="ae-shop-sobre-stat__lbl">Unidades em encomendas entregues</span>
            <span className="ae-muted" style={{ fontSize: 13 }}>
              {metricas.pedidosEntregues.toLocaleString("pt-PT")} pedidos concluídos (estado entregue)
            </span>
          </div>
          <div className="ae-shop-sobre-stat">
            <span className="ae-shop-sobre-stat__val">{metricas.produtosActivos}</span>
            <span className="ae-shop-sobre-stat__lbl">Anúncios activos aprovados</span>
          </div>
          <div className="ae-shop-sobre-stat ae-shop-sobre-stat--wide">
            <span className="ae-shop-sobre-stat__val">
              {metricas.vendasSemDisputaPercent != null ? `${metricas.vendasSemDisputaPercent}%` : "—"}
            </span>
            <span className="ae-shop-sobre-stat__lbl">Pedidos entregues sem disputa registada</span>
            <span className="ae-muted" style={{ fontSize: 13 }}>
              {metricas.pedidosEntregues.toLocaleString("pt-PT")} entregues no total ·{" "}
              {metricas.pedidosComDisputaEntregues.toLocaleString("pt-PT")} com pelo menos uma disputa
            </span>
          </div>
          <div className="ae-shop-sobre-stat ae-shop-sobre-stat--wide">
            <span className="ae-shop-sobre-stat__val">{taxa}</span>
            <span className="ae-shop-sobre-stat__lbl">Taxa de resposta no chat (24h após primeira mensagem do comprador)</span>
          </div>
          <div className="ae-shop-sobre-stat">
            <span className="ae-shop-sobre-stat__val">{ultimaActividadeLegivel(metricas.ultimaActividadeEm)}</span>
            <span className="ae-shop-sobre-stat__lbl">Última actividade registada</span>
          </div>
        </div>
      </section>

      <section className="page-panel ae-shop-sobre-check" aria-label="Verificações BAZAR DO BIÉ">
        <h2 className="ae-shop-sobre-h2">O que validámos para si</h2>
        <p className="ae-muted" style={{ marginTop: 0, maxWidth: 720 }}>
          Estes itens reflectem revisão interna da equipa. <strong>Não publicamos</strong> cópias de BI, NIF nem
          comprovativos bancários — estes documentos permanecem na área administrativa para segurança e conformidade.
        </p>
        <ul className="ae-shop-sobre-list">
          {sinais.map((s) => (
            <li key={s.id} className={s.ok ? "ae-shop-sobre-list__ok" : "ae-shop-sobre-list__no"}>
              <span aria-hidden="true">{s.ok ? "✓" : "○"}</span>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
        {resumoReputacao.textoChips.length > 0 ? (
          <ul className="ae-shop-sobre-chips">
            {resumoReputacao.textoChips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {resumoReputacao.fachadaParceiraUrl ? (
        <section className="page-panel" aria-label="Imagem da loja ou actividade">
          <h2 className="ae-shop-sobre-h2">Fachada ou actividade (aprovada pela plataforma)</h2>
          <figure className="ae-shop-sobre-figure">
            <img
              src={resolveMediaUrl(resumoReputacao.fachadaParceiraUrl)}
              alt="Imagem pública facultada pelo parceiro e aceite após revisão"
              loading="lazy"
              decoding="async"
            />
            <figcaption className="ae-muted" style={{ fontSize: 13, marginTop: 8 }}>
              Não é documento de identificação civil — apenas referência visual para compradores.
            </figcaption>
          </figure>
        </section>
      ) : null}

      {loja.description?.trim() ? (
        <section className="page-panel">
          <h2 className="ae-shop-sobre-h2">Sobre o parceiro</h2>
          <div style={{ whiteSpace: "pre-wrap", maxWidth: 820 }}>{loja.description.trim()}</div>
        </section>
      ) : null}
    </>
  );
}
