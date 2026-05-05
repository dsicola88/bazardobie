import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch, cartSessionHeaders } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { FavoriteToggle } from "../components/FavoriteToggle.js";
import { ProductReportModal } from "../components/ProductReportModal.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import { formatKz, formatFreteKz } from "../utils/format.js";

type Img = { url: string };
type Variant = { id: string; sku: string; name?: string | null; stock: number };
type Delivery = {
  id: string;
  tipoEntrega: string;
  custoEntrega: string;
  prazoEstimado: number;
  areaProvincia: string;
  areaCidade: string;
  logisticsPartner?: { id: string; name: string } | null;
};

type ProductDetail = {
  id: string;
  name: string;
  description: string;
  demoVideoUrl?: string | null;
  price: string;
  promoPrice?: string | null;
  displayPrice: string;
  soldCount: number;
  averageRating?: string | null;
  reviewCount: number;
  images: Img[];
  variants: Variant[];
  deliveryOptions: Delivery[];
  shop?: {
    id: string;
    name: string;
    city: string;
    province: string;
    logoUrl?: string | null;
    credibilidade?: {
      nivel: number;
      seloVerificado: boolean;
      seloPremium: boolean;
      prioridadePesquisa: number;
      garantiasAoComprador?: {
        identidadeRevistaPelaPlataforma: boolean;
        empresaFormalmenteRevistaPelaPlataforma: boolean;
        fachadaParceiraUrl: string | null;
        textoChips: string[];
      };
    };
  };
  reviews: { rating: number; comment?: string | null; photoUrls?: string[]; user?: { name: string } }[];
};

type Tab = "overview" | "reviews" | "ship";

export default function ProductPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { content } = useSiteContent();
  const codNote = content["public.product_cod_note"] ?? "";
  const [showReport, setShowReport] = useState(false);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [deliveryId, setDeliveryId] = useState("");
  const [mainImg, setMainImg] = useState("");
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!id) return;
    void apiFetch<ProductDetail>(`/products/${id}`)
      .then((p) => {
        setProduct(p);
        setMainImg(p.images[0]?.url ?? "");
        if (p.variants.length === 1) setVariantId(p.variants[0].id);
        if (p.deliveryOptions.length) setDeliveryId(p.deliveryOptions[0].id);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Referência indisponível."));
  }, [id]);

  const needVariant = (product?.variants.length ?? 0) > 0;
  const canAdd = product && deliveryId && (!needVariant || variantId);
  const meta = useMemo(() => product?.deliveryOptions.find((d) => d.id === deliveryId), [deliveryId, product]);

  async function addToCart() {
    if (!product || !deliveryId || (needVariant && !variantId)) return;
    setAdding(true);
    try {
      await apiFetch("/cart/items", {
        method: "POST",
        headers: cartSessionHeaders(),
        token,
        body: JSON.stringify({
          productId: product.id,
          variantId: needVariant ? variantId : undefined,
          productDeliveryOptionId: deliveryId,
          quantity: qty,
        }),
      });
      window.dispatchEvent(new Event("cart-updated"));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Não foi possível actualizar o carrinho.");
    } finally {
      setAdding(false);
    }
  }

  if (err) return <div className="page-panel" style={{ color: "#c00" }}>{err}</div>;
  if (!product) return <p className="ae-muted">A carregar ficha de produto…</p>;

  const trust = product.shop?.credibilidade;
  const guarantees = trust?.garantiasAoComprador;

  return (
    <>
      {showReport && product ? (
        <ProductReportModal
          productId={product.id}
          shopId={product.shop?.id}
          onClose={() => setShowReport(false)}
        />
      ) : null}
      <div className="ae-breadcrumb">
        <Link to="/">Início</Link>
        <span>/</span>
        <Link to="/search">Catálogo</Link>
        <span>/</span>
        <span>{product.name.slice(0, 48)}</span>
      </div>

      <div className="ae-pdp">
        <div className="ae-pdp-grid">
          <div className="ae-pdp-thumbs">
            {product.images.map((im) => (
              <button
                key={im.url}
                type="button"
                className={mainImg === im.url ? "ae-on" : ""}
                onClick={() => setMainImg(im.url)}
              >
                <img src={im.url} alt="" />
              </button>
            ))}
          </div>
          <div className="ae-pdp-main">
            {product.demoVideoUrl ? (
              <video
                src={product.demoVideoUrl}
                controls
                preload="metadata"
                playsInline
                poster={mainImg || product.images[0]?.url}
                style={{ width: "100%", borderRadius: 8, border: "1px solid var(--ae-line)", background: "#000" }}
              />
            ) : (
              <img src={mainImg || product.images[0]?.url} alt="" />
            )}
          </div>

          <div className="ae-buybox">
            <h1 className="ae-buybox__title">{product.name}</h1>
            <div className="ae-buybox__reviews">
              {product.reviewCount > 0 && product.averageRating != null ? (
                <>
                  <strong>★ {Number(product.averageRating).toFixed(1)}</strong>
                  {" · "}
                  {product.reviewCount} avaliações verificadas · {product.soldCount}+ unidades vendidas
                </>
              ) : (
                <span>{product.soldCount}+ unidades vendidas · ainda sem avaliações publicadas</span>
              )}
            </div>
            <div className="ae-buybox__price">
              <span className="ae-buybox__now">{formatKz(product.displayPrice)}</span>
              {product.promoPrice ? (
                <span className="ae-buybox__was">{formatKz(product.price)}</span>
              ) : null}
            </div>

            <div className="ae-buybox__trust">
              <span className="ae-buybox__chip">Transacção segura</span>
              <span className="ae-buybox__chip">Pagamento à entrega (COD)</span>
              {trust?.seloPremium ? (
                <span className="ae-buybox__chip ae-buybox__chip--premium">Parceiro premium</span>
              ) : null}
              {trust?.seloVerificado && !trust?.seloPremium ? (
                <span className="ae-buybox__chip ae-buybox__chip--verified">Parceiro verificado</span>
              ) : null}
            </div>

            {product.shop ? (
              <p className="ae-muted" style={{ fontSize: 12 }}>
                Loja parceira: <strong>{product.shop.name}</strong>
                {guarantees?.textoChips?.length ? (
                  <span className="ae-pdp-trust-inline" title={guarantees.textoChips.join(" ")}>
                    {" "}
                    · {guarantees.textoChips[0]}
                    {guarantees.textoChips.length > 1 ? " (+info na visão geral)" : ""}
                  </span>
                ) : null}
                {" · "}
                {product.shop.city}, {product.shop.province}
              </p>
            ) : null}

            {needVariant ? (
              <div className="ae-field">
                <label>Variante do artigo</label>
                <select value={variantId ?? ""} onChange={(e) => setVariantId(e.target.value || null)}>
                  <option value="">Seleccionar variante…</option>
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                      {(v.name || v.sku) + ` — stock ${v.stock}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="ae-field">
              <label>
                Expedição — {meta?.tipoEntrega === "PLATAFORMA" ? "Operada pela plataforma" : "Operada pela loja parceira"}
                {meta?.tipoEntrega === "PLATAFORMA" && meta.logisticsPartner ? ` · ${meta.logisticsPartner.name}` : ""}
              </label>
              <select value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
                {product.deliveryOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.areaCidade}, {d.areaProvincia} · {formatFreteKz(d.custoEntrega)} · {d.prazoEstimado} dias
                    {d.tipoEntrega === "PLATAFORMA" && d.logisticsPartner
                      ? ` · ${d.logisticsPartner.name}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span className="ae-muted" style={{ fontSize: 12 }}>
                Quantidade
              </span>
              <div className="ae-buybox__qty">
                <button type="button" onClick={() => setQty((n) => Math.max(1, n - 1))}>
                  −
                </button>
                <input
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                />
                <button type="button" onClick={() => setQty((n) => n + 1)}>
                  +
                </button>
              </div>
            </div>

            <div className="ae-buy-actions">
              <button type="button" className="ae-btn-lg ae-btn-buy" disabled={!canAdd || adding} onClick={() => void addToCart()}>
                {adding ? "A actualizar…" : "Adicionar ao carrinho"}
              </button>
              <Link className="ae-btn-lg ae-btn-cart" to="/cart" style={{ textAlign: "center", textDecoration: "none" }}>
                Ver carrinho
              </Link>
            </div>
            <FavoriteToggle productId={product.id} variantId={variantId} needVariant={needVariant} />
            <p style={{ marginTop: 12, fontSize: 12 }}>
              <button type="button" className="ae-linkbtn" onClick={() => setShowReport(true)}>
                Reportar conteúdo
              </button>
              {user ? null : (
                <span className="ae-muted"> — requer início de sessão</span>
              )}
            </p>
            <p className="ae-muted" style={{ fontSize: 12, marginTop: 12, whiteSpace: "pre-wrap" }}>
              {codNote}
            </p>
          </div>
        </div>
      </div>

      <div className="page-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="ae-tabs">
          <button type="button" className={tab === "overview" ? "ae-on" : ""} onClick={() => setTab("overview")}>
            Visão geral
          </button>
          <button type="button" className={tab === "ship" ? "ae-on" : ""} onClick={() => setTab("ship")}>
            Envio, prazos e devoluções
          </button>
          <button type="button" className={tab === "reviews" ? "ae-on" : ""} onClick={() => setTab("reviews")}>
            Avaliações ({product.reviewCount})
          </button>
        </div>
        {tab === "overview" ? (
          <div className="ae-tab-panel">
            <div className="ae-pdp-overview">
              <div style={{ whiteSpace: "pre-wrap" }}>{product.description}</div>
              {guarantees && (guarantees.textoChips.length > 0 || guarantees.fachadaParceiraUrl) ? (
                <aside className="ae-pdp-trust-box" aria-label="Confiança no parceiro">
                  <h3 className="ae-pdp-trust-box__title">Este parceiro na BAZAR DO BIÉ</h3>
                  {guarantees.fachadaParceiraUrl ? (
                    <figure className="ae-pdp-trust-box__photo">
                      <img src={guarantees.fachadaParceiraUrl} alt="Fachada ou actividade do parceiro, revista pela plataforma" />
                      <figcaption className="ae-muted">Imagem facultada pelo parceiro e aceite após revisão da equipa.</figcaption>
                    </figure>
                  ) : null}
                  {guarantees.textoChips.length > 0 ? (
                    <ul className="ae-pdp-trust-chips">
                      {guarantees.textoChips.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  ) : null}
                </aside>
              ) : null}
            </div>
          </div>
        ) : null}
        {tab === "ship" ? (
          <div className="ae-tab-panel">
            <strong>Zona abrangida pela modalidade seleccionada</strong>
            <p>
              {meta?.areaProvincia}, {meta?.areaCidade}
            </p>
            <p className="ae-muted">
              Prazo indicado: <strong>{meta?.prazoEstimado}</strong> dias úteis após confirmação da encomenda. Os prazos
              efectivos dependem da rota logística e podem variar.
            </p>
            <p className="ae-muted">
              Portes desta opção: <strong>{meta ? formatFreteKz(meta.custoEntrega) : "—"}</strong>
            </p>
            <p className="ae-muted">
              Tipo: {meta?.tipoEntrega === "PLATAFORMA" ? "Logística da plataforma BAZAR DO BIÉ" : "Logística da loja parceira"}
              {meta?.tipoEntrega === "PLATAFORMA" && meta.logisticsPartner
                ? ` · Transportadora indicada: ${meta.logisticsPartner.name}`
                : ""}
              .
            </p>
          </div>
        ) : null}
        {tab === "reviews" ? (
          <div className="ae-tab-panel">
            {product.reviews.length === 0 ? (
              <p className="ae-muted">Ainda não existem avaliações para este artigo.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {product.reviews.map((r, i) => (
                  <li key={i} style={{ marginBottom: 16 }}>
                    <strong>{r.rating}</strong> /5 · {(r.user && r.user.name) || "Comprador"}
                    <div className="ae-muted" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                      {r.comment}
                    </div>
                    {r.photoUrls && r.photoUrls.length > 0 ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        {r.photoUrls.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                            <img
                              src={u}
                              alt=""
                              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid var(--ae-line)" }}
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
