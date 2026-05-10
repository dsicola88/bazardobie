import { Link } from "react-router-dom";
import { useSeo } from "../seo/useSeo.js";

/**
 * Política de privacidade — modelo jurídico deve ser revisto por advogado conforme operação real e jurisdição.
 */
export default function PrivacyPage() {
  useSeo({
    title: "Política de privacidade — BAZAR DO BIÉ",
    description:
      "Como o BAZAR DO BIÉ trata dados pessoais: finalidades, conservação, cookies, direitos dos utilizadores e contactos.",
    canonicalPath: "/privacidade",
  });

  return (
    <div className="ae-shell ae-terms-page">
      <nav className="ae-terms-page__nav no-print" aria-label="Secção">
        <Link to="/" className="ae-muted" style={{ fontSize: 13 }}>
          ← Loja
        </Link>
      </nav>

      <header className="ae-terms-page__head no-print">
        <h1 className="ae-terms-page__title">Política de privacidade</h1>
        <p className="ae-muted" style={{ maxWidth: "42rem", lineHeight: 1.55 }}>
          Esta página descreve de forma clara como a plataforma <strong>BAZAR DO BIÉ</strong> utiliza dados pessoais
          quando navega, regista conta, compra ou vende. Reserva‑nos o direito de actualizar este texto; a versão em
          vigor é sempre a publicada aqui com data de referência no rodapé do documento.
        </p>
      </header>

      <article className="ae-terms-print page-panel" style={{ padding: "1.25rem 1.5rem" }}>
        <p className="ae-muted" style={{ fontSize: 12, marginTop: 0 }}>
          Última actualização: {new Intl.DateTimeFormat("pt-AO", { dateStyle: "long" }).format(new Date())}.
        </p>

        <section className="ae-terms-print__section">
          <h2>1. Responsável pelo tratamento</h2>
          <p>
            Os dados processados através do website e da API do marketplace são tratados pela entidade que opera o{" "}
            <strong>BAZAR DO BIÉ</strong>, na qualidade de responsável pelo tratamento (contactos operacionais —
            incluindo apoio e reclamações — encontram‑se indicados no site e no rodapé público).
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>2. Que dados recolhemos</h2>
          <p>Dependendo das funcionalidades que utiliza, podemos processar, entre outros:</p>
          <ul>
            <li>
              <strong>Dados de conta e perfil:</strong> nome, e‑mail, telefone, palavra‑passe (armazenada de forma
              protegida), morada ou dados logísticos necessários à entrega.
            </li>
            <li>
              <strong>Dados comerciais:</strong> encomendas, mensagens na área de encomenda, avaliações, favoritos,
              preferências de navegação relevantes para o serviço.
            </li>
            <li>
              <strong>Dados de vendedor:</strong> identificação da loja, documentação ou elementos enviados no âmbito
              da credibilização e cumprimento de obrigações contractuais.
            </li>
            <li>
              <strong>Dados técnicos:</strong> registos de segurança, endereço IP, tipo de navegador, datas de acesso —
              para segurança, diagnóstico e cumprimento legal.
            </li>
          </ul>
        </section>

        <section className="ae-terms-print__section">
          <h2>3. Finalidades e bases legais</h2>
          <p>Tratamos dados para:</p>
          <ul>
            <li>Prestação do serviço de marketplace (conta, carrinho, checkout, pagamentos e comunicações operacionais);</li>
            <li>Apoio ao cliente e resolução de disputas;</li>
            <li>Cumprimento de obrigações legais (ex.: documentação fiscal e registos obrigatórios);</li>
            <li>Segurança da plataforma, prevenção de fraude e abuso;</li>
            <li>Melhoria técnica e estatísticas agregadas, quando aplicável.</li>
          </ul>
        </section>

        <section className="ae-terms-print__section">
          <h2>4. Conservação</h2>
          <p>
            Conservamos dados apenas pelo tempo necessário às finalidades acima e aos prazos legais. Certos registos
            podem ser mantidos por períodos mais longos quando a lei ou litígios legítimos o exijam.
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>5. Partilha com terceiros</h2>
          <p>
            Podemos subcontratar alojamento, redes de distribuição de conteúdo (CDN), fornecedores de e‑mail,
            processadores de pagamento ou transportadores — apenas na medida necessária à execução do serviço, sob
            obrigações contratuais de confidencialidade e segurança. Não vendemos listas de contactos.
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>6. Transferências internacionais</h2>
          <p>
            Se utilizar infra‑estruturas fora do seu país, adoptamos salvaguardas adequadas (incluindo cláusulas
            contratuais tipo ou decisões de adequação, quando aplicável).
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>7. Cookies e tecnologias semelhantes</h2>
          <p>
            Podemos usar cookies e armazenamento local estritamente necessários ao funcionamento (sessão, preferências,
            segurança). Cookies opcionais de mediência ou marketing, se existirem, serão indicados num banner ou
            definições quando activados.
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>8. Os seus direitos</h2>
          <p>
            Nos termos da legislação aplicável, poderá solicitar acesso, rectificação, apagamento, limitação do
            tratamento, portabilidade ou oposição, mediante pedido aos contactos oficiais do site. Tem igualmente o
            direito de apresentar reclamação à autoridade de protecção de dados competente.
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>9. Segurança</h2>
          <p>
            Aplicamos medidas técnicas e organizativas razoáveis para proteger dados contra acesso não autorizado,
            alteração ou destruição. Nenhum sistema é totalmente isento de risco; recomendamos que utilize
            palavras‑passe fortes e não partilhe credenciais.
          </p>
        </section>

        <section className="ae-terms-print__section">
          <h2>10. Menores</h2>
          <p>O serviço não se destina a menores sem autorização parental; não solicitamos dados de menores de forma activa.</p>
        </section>

        <section className="ae-terms-print__section">
          <h2>11. Alterações</h2>
          <p>
            Alterações substanciais serão comunicadas por meios razoáveis (por exemplo, aviso no site ou por e‑mail).
            O uso continuado após a entrada em vigor pode constituir aceitação da nova política, conforme aplicável.
          </p>
        </section>

        <footer className="ae-terms-print__footer ae-muted" style={{ fontSize: 12, marginTop: 24 }}>
          Para informações sobre o programa comercial de lojas parceiras, consulte também{" "}
          <Link to="/termos-parceiros">Termos do programa de parceiros</Link>.
        </footer>
      </article>
    </div>
  );
}
