import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { buildSearchPath } from "../buildSearchPath.js";
import { resolveMediaUrl } from "../utils/media.js";
import { formatRating } from "../utils/format.js";
import { useSeo } from "../seo/useSeo.js";

type SobrePayload = {
  loja: {
    id: string;
    name: string;
    description?: string | null;
    province: string;
    city: string;
    logoUrl?: string | null;
  };
  sinais: { id: string; label: string; ok: boolean }[];
  metricas: {
    pedidosEntregues: number;
    entregasUnidades: number;
    taxaRespostaPercent: number | null;
    taxaRespostaBaseConversas: number;
    avaliacaoMedia: number | null;
    totalAvaliacoes: number;
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
        <span>Sobre a loja</span>
      </div>

      <header className="ae-shop-sobre-hero page-panel">
        <div className="ae-shop-sobre-hero__main">
          <div className="ae-shop-sobre-logo">{logo ? <img src={logo} alt="" /> : <span className="ae-shop-sobre-logo__ph" />}</div>
          <div>
            <h1 className="ae-shop-sobre-title">{loja.name}</h1>
            <p className="ae-muted" style={{ margin: "4px 0 0" }}>
              {loja.city}, {loja.province} · Angola
            </p>
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
            </div>
            <p style={{ marginTop: 14 }}>
              <Link className="ae-btn-lg ae-section__cta ae-section__cta--ghost" to={buildSearchPath("/search", new URLSearchParams(), { shopId: loja.id })}>
                Ver artigos desta loja
              </Link>
            </p>
          </div>
        </div>
      </header>

      <section className="page-panel ae-shop-sobre-metrics" aria-label="Métricas públicas">
        <h2 className="ae-shop-sobre-h2">Métricas e reputação</h2>
        <div className="ae-shop-sobre-grid">
          <div className="ae-shop-sobre-stat">
            <span className="ae-shop-sobre-stat__val">{metricas.totalAvaliacoes}</span>
            <span className="ae-shop-sobre-stat__lbl">Avaliações em produtos</span>
            {metricas.avaliacaoMedia != null ? (
              <span className="ae-muted" style={{ fontSize: 13 }}>
                Média {formatRating(metricas.avaliacaoMedia)} / 5
              </span>
            ) : (
              <span className="ae-muted" style={{ fontSize: 13 }}>
                Sem média ainda
              </span>
            )}
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
