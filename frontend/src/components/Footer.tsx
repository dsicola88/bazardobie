import { Link } from "react-router-dom";
import { useSiteContent } from "../site/SiteContentContext.js";

export function Footer() {
  const { content } = useSiteContent();
  const tagline = content["public.site_tagline"] ?? "";
  const phoneDisplay = content["public.support_phone_display"] ?? "";
  const phoneTel = content["public.support_phone_tel"] ?? "";
  const brandSub = content["public.footer_brand_subtitle"] ?? "";
  const colTrust = content["public.footer_col_trust"] ?? "";
  const colSupport = content["public.footer_col_support"] ?? "";

  return (
    <footer className="ae-footer">
      <div className="ae-shell ae-footer__grid">
        <div>
          <div className="ae-footer__brand">BAZAR DO BIÉ</div>
          <p className="ae-footer__txt">{brandSub}</p>
        </div>
        <div>
          <div className="ae-footer__h">Loja</div>
          <Link to="/search">Explorar catálogo</Link>
          <Link to="/cart">Carrinho de compras</Link>
          <Link to="/orders">As minhas encomendas</Link>
        </div>
        <div>
          <div className="ae-footer__h">Parceiros</div>
          <Link to="/quero-vender">Programa de parceiros</Link>
          <Link to="/termos-parceiros">Termos do parceiro</Link>
          <Link to="/vendor">Área comercial (parceiros)</Link>
          <Link to="/vendor/products">Catálogo</Link>
          <Link to="/vendor/orders">Encomendas</Link>
        </div>
        <div>
          <div className="ae-footer__h">Compras com confiança</div>
          <p className="ae-footer__txt">{colTrust}</p>
        </div>
        <div>
          <div className="ae-footer__h">Apoio ao cliente</div>
          <p className="ae-footer__txt">{colSupport}</p>
        </div>
      </div>
      <div className="ae-footer__copy">
        <div className="ae-shell">
          © {new Date().getFullYear()} BAZAR DO BIÉ — {tagline}
          {phoneDisplay ? (
            <>
              {" "}
              · Suporte:{" "}
              <a href={phoneTel ? `tel:${phoneTel.replace(/\s/g, "")}` : `tel:${phoneDisplay.replace(/\s/g, "")}`}>
                {phoneDisplay}
              </a>
            </>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
