import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  PARTNER_TERMS_DOC_REF_FALLBACK,
  PARTNER_TERMS_DOC_REF_KEY,
  PARTNER_TERMS_FOOTER_FALLBACK,
  PARTNER_TERMS_FOOTER_KEY,
  partnerTermsSections,
} from "../legal/partnerTermsBuiltin.js";
import { renderPartnerTermsPlain, resolvePartnerTermsSection } from "../legal/partnerTermsPlain.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import { useSeo } from "../seo/useSeo.js";

/**
 * Termos comerciais do programa de parceiros — corpo editável em Conteúdo do site (chaves public.terms_partners_*).
 */
export default function TermsPartnersPage() {
  const [searchParams] = useSearchParams();
  const printMode = searchParams.get("print") === "1";
  const { content } = useSiteContent();

  useSeo({
    title: "Termos do programa de parceiros — BAZAR DO BIÉ",
    description:
      "Condições gerais do programa de parceiros BAZAR DO BIÉ: comissão de serviço, logística e rastreamento, escrow, credibilização e moderação de catálogo.",
    canonicalPath: "/termos-parceiros",
  });

  useEffect(() => {
    if (!printMode) return;
    const id = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(id);
  }, [printMode]);

  const docDate = (content[PARTNER_TERMS_DOC_REF_KEY] ?? "").trim() || PARTNER_TERMS_DOC_REF_FALLBACK;
  const footerRaw = (content[PARTNER_TERMS_FOOTER_KEY] ?? "").trim();
  const footerNode = footerRaw ? renderPartnerTermsPlain(footerRaw) : <p>{PARTNER_TERMS_FOOTER_FALLBACK}</p>;

  return (
    <div className="ae-shell ae-terms-page">
      <nav className="ae-terms-page__nav no-print" aria-label="Secção">
        <Link to="/" className="ae-muted" style={{ fontSize: 13 }}>
          ← Loja
        </Link>
        <Link to="/quero-vender" className="ae-muted" style={{ fontSize: 13, marginLeft: 12 }}>
          Programa de parceiros
        </Link>
      </nav>

      <header className="ae-terms-page__head no-print">
        <h1 className="ae-terms-page__title">Termos do programa de parceiros</h1>
        <p className="ae-muted" style={{ maxWidth: "42rem", lineHeight: 1.55 }}>
          Condições gerais aplicáveis a <strong>lojas parceiras</strong> no marketplace{" "}
          <strong>BAZAR DO BIÉ</strong>. Vigência segundo a data indicada no documento imprimível; alterações são
          publicadas nesta página e, quando aplicável, comunicadas por canais oficiais.
        </p>
        <div className="ae-terms-page__actions">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
          <Link to="/termos-parceiros?print=1" className="btn" target="_blank" rel="noopener noreferrer">
            Abrir só para impressão
          </Link>
        </div>
      </header>

      <article className="ae-terms-print page-panel" id="ae-terms-print-root">
        <header className="ae-terms-print__letterhead">
          <h1 className="ae-terms-print__doc-title">Termos do programa de parceiros</h1>
          <p className="ae-terms-print__meta">BAZAR DO BIÉ — Marketplace · Referência: {docDate}</p>
        </header>

        {partnerTermsSections().map((spec) => {
          const { title, body } = resolvePartnerTermsSection(spec, content[spec.key]);
          return (
            <section className="ae-terms-print__section" key={spec.key}>
              <h2>{title}</h2>
              {body}
            </section>
          );
        })}

        <footer className="ae-terms-print__footer ae-muted" style={{ fontSize: 12, marginTop: 24 }}>
          {footerNode}
        </footer>
      </article>
    </div>
  );
}
