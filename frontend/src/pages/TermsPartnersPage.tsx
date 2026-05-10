import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSeo } from "../seo/useSeo.js";

/**
 * Termos comerciais do programa de parceiros — texto jurídico simplificado para operação;
 * percentagens de serviço alinham com a configuração da plataforma (ex.: comissão sobre vendas).
 */
export default function TermsPartnersPage() {
  const [searchParams] = useSearchParams();
  const printMode = searchParams.get("print") === "1";

  useSeo({
    title: "Termos do programa de parceiros — BAZAR DO BIÉ",
    description:
      "Condições de adesão, comissão de serviço, moderação, envios e obrigações das lojas parceiras no marketplace BAZAR DO BIÉ.",
    canonicalPath: "/termos-parceiros",
  });

  useEffect(() => {
    if (!printMode) return;
    const id = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(id);
  }, [printMode]);

  const docDate = "Maio de 2026";

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
          Condições gerais para vendedores no marketplace <strong>BAZAR DO BIÉ</strong>. Documento para leitura e arquivo;
          a versão em vigor pode ser actualizada — utilize esta página como referência.
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

        <section className="ae-terms-print__section">
          <h2>1. Natureza do serviço</h2>
          <p>
            O <strong>BAZAR DO BIÉ</strong> é uma plataforma de comércio electrónico que disponibiliza tecnologia,
            visibilidade, meios de pagamento e logística (quando aplicável) em que concorrem vendedores independentes (
            <strong>lojas parceiras</strong>). A plataforma não é, salvo indicação expressa, vendedora dos artigos:
            quem define preços, stock, embalagem e políticas locais da venda é a loja parceira, dentro destes termos e da
            legislação aplicável.
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>2. Adesão e conta comercial</h2>
          <ul>
            <li>O registo público cria sempre uma conta de <strong>comprador</strong>.</li>
            <li>
              A activação do <strong>perfil de parceiro</strong> implica aceitação expressa destes termos no ecrã «Programa
              de parceiros».
            </li>
            <li>
              A <strong>nível 1</strong>, os dados institucionais da loja (nome, localização oficial, contactos) são
              analisados pela equipa. Até à <strong>aprovação</strong>, a loja não é listada publicamente e a criação de
              anúncios pode estar restrita.
            </li>
            <li>
              Cada anúncio pode estar sujeito a <strong>moderação</strong> antes de aparecer na vitrine — garantia de
              conformidade, preços coerentes e imagens adequadas.
            </li>
          </ul>
        </section>

        <section className="ae-terms-print__section">
          <h2>3. Comissão de serviço (taxa da plataforma)</h2>
          <p>
            Pela utilização do marketplace (tecnologia, pagamentos, mediação e, conforme o caso, operações de suporte e
            logística integrada), a plataforma pode aplicar uma <strong>comissão sobre as vendas efectivas</strong>{" "}
            (percentagem sobre o valor da transação liquidada), expressa em <strong>basis points</strong> na configuração
            interna (ex.: 500 bps = 5%). O valor exacto em vigor é definido e ajustável pela administração da plataforma e
            pode ser comunicado no painel ou em extratos; os parceiros devem acompanhar os relatórios financeiros ou
            indicadores disponíveis na sua área comercial.
          </p>
          <p>
            <strong>IVA e impostos:</strong> a facturação, retenções e declarações fiscais relativas à actividade da loja
            são da <strong>responsabilidade do parceiro</strong>, nos termos da lei angolana aplicável. A comissão da
            plataforma pode ser aumentada ou ajustada com pré-aviso razoável por canal oficial (e-mail, aviso no painel ou
            actualização desta página).
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>4. Taxas de envio e logística</h2>
          <ul>
            <li>
              Os <strong>custos de entrega</strong> apresentados ao comprador decorrem das regras de frete (zonas,
              distâncias ou parceiros logísticos) configuradas na plataforma e/ou pela loja.
            </li>
            <li>
              Quando o envio é <strong>operado pela plataforma</strong>, o parceiro deve cumprir os prazos de preparação
              acordados; quando é <strong>operado pela loja</strong>, o parceiro é responsável pela qualidade do
              embalo e pela actualização de estados da encomenda.
            </li>
            <li>
              Taxas adicionais de serviços de terceiros (transportadoras, recolhas) podem aplicar-se segundo contratos ou
              tabelas em vigor, sempre comunicadas ou dedutíveis dos fluxos indicados no painel.
            </li>
          </ul>
        </section>

        <section className="ae-terms-print__section">
          <h2>5. Pagamentos e escrow</h2>
          <p>
            Conforme o método (pagamento à entrega, transferência, pagamento online com reténção, etc.), os valores podem
            transitar por mecanismos de <strong>garantia ao comprador</strong> (escrow) até à confirmação da entrega ou
            decisão de suporte. O parceiro obriga-se a não desencadear conflitos artificiais e a colaborar com a prova de
            envio e recepção.
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>6. Obrigações do parceiro</h2>
          <ul>
            <li>Manter <strong>dados de contacto</strong> e localização correctos.</li>
            <li>
              Cumprir <strong>prazos</strong> de preparação e responder a pedidos de esclarecimento dos compradores e do
              suporte.
            </li>
            <li>
              Vender apenas artigos <strong>legais</strong>, conforme descritos, com stock real e política de devolução
              coerente com a lei e com as regras da plataforma.
            </li>
            <li>
              Não utilizar o catálogo para fraude, duplicação abusiva ou manipulação de avaliações.
            </li>
          </ul>
        </section>

        <section className="ae-terms-print__section">
          <h2>7. Suspensão e rescisão</h2>
          <p>
            A plataforma pode <strong>suspender</strong> anúncios ou lojas em caso de incumprimento grave, indício de
            fraude, pressão sobre compradores ou violação destes termos. Pode ainda encerrar a participação no programa
            de parceiros com comunicação prévia quando tal seja razoavelmente possível.
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>8. Protecção de dados</h2>
          <p>
            Os dados pessoais tratados no âmbito das encomendas devem ser usados apenas para execução do contrato de
            venda e obrigações legais, em linha com a política de privacidade da plataforma e a legislação aplicável em
            Angola.
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>9. Alterações</h2>
          <p>
            O <strong>BAZAR DO BIÉ</strong> pode actualizar estes termos. A versão aplicável é a publicada nesta página,
            com data de referência indicada no cabeçalho do documento. O uso continuado do painel comercial após aviso
            razoável constitui aceitação das alterações, salvo obrigação legal em contrário.
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>10. Contacto</h2>
          <p>
            Para questões sobre estes termos, comissões ou operações: utilize os canais de <strong>suporte</strong>
            indicados no site ou no rodapé da loja pública.
          </p>
        </section>

        <footer className="ae-terms-print__footer ae-muted" style={{ fontSize: 12, marginTop: 24 }}>
          Documento informativo para parceiros. Em caso de divergência com contratos específicos assinados bilateralmente,
          prevalece o acordo escrito específico.
        </footer>
      </article>
    </div>
  );
}
