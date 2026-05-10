import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { buildSearchPath } from "../buildSearchPath.js";
import { resolveMediaUrl } from "../utils/media.js";
import { useSeo } from "../seo/useSeo.js";
import { StarRating } from "../components/StarRating.js";

export type ShopSobrePayload = {
  loja: {
    id: string;
    name: string;
    description?: string | null;
    province: string;
    city: string;
    logoUrl?: string | null;
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

export type ShopFrontOutletContext = {
  storefrontShell: true;
  sobre: ShopSobrePayload | null;
  sobreLoading: boolean;
};

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

export default function ShopPublicOutlet() {
  const { shopId } = useParams();
  const [data, setData] = useState<ShopSobrePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    setData(null);
    setErr(null);
    void apiFetch<ShopSobrePayload>(`/shops/${encodeURIComponent(shopId)}/sobre`)
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
  const base = shopId ? `/loja/${encodeURIComponent(shopId)}` : "/loja";

  const outletContext = useMemo<ShopFrontOutletContext>(
    () => ({
      storefrontShell: true,
      sobre: data,
      sobreLoading: Boolean(shopId) && !data && !err,
    }),
    [data, err, shopId],
  );

  useSeo({
    title: data ? `${nome} — Loja no BAZAR DO BIÉ` : "Loja parceira — BAZAR DO BIÉ",
    description: data
      ? `${nome}: artigos verificados, avaliações e confiança no marketplace angolano BAZAR DO BIÉ.`
      : "Página da loja parceira no BAZAR DO BIÉ.",
    canonicalPath: base,
  });

  if (!shopId) {
    return (
      <div className="page-panel" role="alert">
        Referência da loja em falta.
      </div>
    );
  }

  if (err) {
    return (
      <div className="page-panel" role="alert" style={{ color: "#b00020" }}>
        {err}
      </div>
    );
  }

  const loja = data?.loja;
  const logo = loja ? resolveMediaUrl(loja.logoUrl ?? "") : "";

  const m = data?.metricas;

  const catalogSearchPath = buildSearchPath("/search", new URLSearchParams(), { shopId });

  return (
    <div className="ae-storefront">
      <div className="ae-breadcrumb ae-storefront-bc">
        <Link to="/">Início</Link>
        <span>/</span>
        <Link to="/search">Catálogo</Link>
        <span>/</span>
        <Link to={base}>{nome}</Link>
      </div>

      <header className="ae-storefront-hero">
        <div className="ae-storefront-hero__surface">
          <div className="ae-storefront-hero__brand">
            <div className="ae-storefront-hero__logo-wrap">
              {logo ? (
                <img className="ae-storefront-hero__logo" src={logo} alt="" decoding="async" />
              ) : (
                <span className="ae-storefront-hero__logo-ph" aria-hidden>
                  {(loja?.name ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="ae-storefront-hero__title-block">
              <h1 className="ae-storefront-hero__title">{loja?.name ?? nome}</h1>
              <p className="ae-storefront-hero__meta">
                {loja ? (
                  <>
                    {loja.city}, {loja.province} · Angola
                    {loja.membroDesde ? (
                      <>
                        {" "}
                        · Na plataforma desde {formatMembroDesdePt(loja.membroDesde)}
                      </>
                    ) : null}
                  </>
                ) : (
                  <span className="ae-muted">A carregar perfil público da loja…</span>
                )}
              </p>
              <div className="ae-storefront-hero__chips">
                {data?.resumoReputacao.seloPremium ? (
                  <span className="ae-buybox__chip ae-buybox__chip--premium">Parceiro premium</span>
                ) : null}
                {data?.resumoReputacao.seloVerificado ? (
                  <span className="ae-buybox__chip ae-buybox__chip--verified">Verificado pela plataforma</span>
                ) : (
                  data ? (
                    <span className="ae-buybox__chip">Credibilidade em evolução</span>
                  ) : null
                )}
                {data?.resumoReputacao.nivelConfianca != null ? (
                  <span className="ae-buybox__chip">
                    Confiança nível {data.resumoReputacao.nivelConfianca}/3
                  </span>
                ) : null}
                {typeof m?.produtosActivos === "number" ? (
                  <span className="ae-buybox__chip">
                    {m.produtosActivos} anúncios activos
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="ae-storefront-hero__stats">
            <div className="ae-storefront-hero__stat">
              <p className="ae-storefront-hero__stat-label">Revisão positiva</p>
              <div className="ae-storefront-hero__stat-value">
                {m?.totalAvaliacoes === 0 ? (
                  <span className="ae-storefront-muted-on-dark">Sem avaliações ainda</span>
                ) : m?.revisaoPositivaPercent != null ? (
                  <>
                    <strong>{m.revisaoPositivaPercent}%</strong>
                    <span className="ae-storefront-hero__stat-hint">
                      ({m.totalAvaliacoes} avaliações, notas ≥4★)
                    </span>
                  </>
                ) : (
                  <span className="ae-storefront-muted-on-dark">Percentagem pendente</span>
                )}
              </div>
            </div>
            <div className="ae-storefront-hero__stat">
              <p className="ae-storefront-hero__stat-label">Classificação</p>
              <div className="ae-storefront-hero__stat-value">
                {!m ? (
                  <span className="ae-storefront-muted-on-dark">—</span>
                ) : m.avaliacaoMedia != null && m.totalAvaliacoes > 0 ? (
                  <>
                    <span className="ae-storefront-hero-stars-wrap">
                      <StarRating value={m.avaliacaoMedia} tone="gold" size="sm" showValue />
                    </span>
                    <span className="ae-storefront-hero__stat-hint">média sobre {m.totalAvaliacoes} opiniões</span>
                  </>
                ) : (
                  <span className="ae-storefront-muted-on-dark">
                    Média pública após {m.avaliacoesMinimoParaMediaPublica}+ avaliações
                  </span>
                )}
              </div>
            </div>
            <div className="ae-storefront-hero__stat">
              <p className="ae-storefront-hero__stat-label">Volume</p>
              <div className="ae-storefront-hero__stat-value">
                {!m ? (
                  <span className="ae-storefront-muted-on-dark">—</span>
                ) : (
                  <>
                    <strong>{m.vendasRegistadasCatalogo.toLocaleString("pt-PT")}</strong>
                    <span className="ae-storefront-hero__stat-hint">unidades catalogadas vendidas</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="ae-storefront-hero__cta">
            <Link className="ae-btn-lg ae-btn-buy" to={catalogSearchPath}>
              Pesquisar no catálogo desta loja
            </Link>
            <Link className="ae-btn-lg ae-btn-cart" to={`${base}/avaliacoes`}>
              Ver avaliações
            </Link>
          </div>
        </div>
      </header>

      <nav className="ae-storefront-tabs" aria-label="Secções da loja">
        <NavLink className={({ isActive }) => `ae-storefront-tab${isActive ? " ae-storefront-tab--on" : ""}`} to={base} end>
          Início da loja
        </NavLink>
        <NavLink
          className={({ isActive }) => `ae-storefront-tab${isActive ? " ae-storefront-tab--on" : ""}`}
          to={`${base}/produtos`}
        >
          Produtos
        </NavLink>
        <NavLink
          className={({ isActive }) => `ae-storefront-tab${isActive ? " ae-storefront-tab--on" : ""}`}
          to={`${base}/avaliacoes`}
        >
          Avaliações
        </NavLink>
        <NavLink
          className={({ isActive }) => `ae-storefront-tab${isActive ? " ae-storefront-tab--on" : ""}`}
          to={`${base}/sobre`}
        >
          Confiança e detalhes
        </NavLink>
      </nav>

      <Outlet context={outletContext} />
    </div>
  );
}
