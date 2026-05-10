import type { ReactNode } from "react";

export type PartnerTermsSectionSpec = {
  /** Chave persistida em `SiteSetting`. */
  key: string;
  /** Cabeçalho por defeito (Secção «n.» …). Substituível com primeira linha `# Novo título`. */
  defaultTitle: string;
  /** Conteúdo por defeito quando o campo está vazio. */
  builtin: ReactNode;
};

export const PARTNER_TERMS_DOC_REF_KEY = "public.terms_partners_doc_ref";
export const PARTNER_TERMS_FOOTER_KEY = "public.terms_partners_footer_note";

/** Texto quando a chave está vazio / não preenchido. */
export const PARTNER_TERMS_DOC_REF_FALLBACK = "Maio de 2026";

/** Rodapé do documento (imprimível). */
export const PARTNER_TERMS_FOOTER_FALLBACK =
  "Documento de condições gerais para fins informativos e de arquivo interno do parceiro. Em caso de conflito com acordo escrito bilateral específico entre as partes, prevalece esse acordo na medida em que não viole disposições imperativas de lei.";

export function partnerTermsSections(): PartnerTermsSectionSpec[] {
  return PARTNER_TERM_SECTION_SPECS;
}

const PARTNER_TERM_SECTION_SPECS: PartnerTermsSectionSpec[] = [
  {
    key: "public.terms_partners_s01",
    defaultTitle: "1. Âmbito e natureza do serviço",
    builtin: (
      <>
        <p>
          O <strong>BAZAR DO BIÉ</strong> disponibiliza software, infra-estrutura de marketplace, meios de pagamento
          integrados e, quando aplicável, suporte a circuitos logísticos, permitindo que <strong>lojas parceiras</strong>{" "}
          ofereçam artigos a compradores finais. Salvo indicação expressa em contrário na plataforma, a relação de compra e
          venda dos bens prende-se entre o comprador e a loja parceira; esta responde por preços, stock, descrição dos
          artigos, embalagem, informação prestada e execução da encomenda, nos termos da legislação aplicável.
        </p>
        <p>
          Comissão de serviço, logística e rastreamento, reténção de fundos em pagamento electrónico, moderação de catálogo
          e programas de credibilização regulam-se nas secções seguintes. O parceiro obriga-se a dados exactos, a cumprimento
          dos prazos operacionais e a colaboração com a equipa quando a verificação ou o suporte o exigirem.
        </p>
      </>
    ),
  },
  {
    key: "public.terms_partners_s02",
    defaultTitle: "2. Adesão e conta comercial",
    builtin: (
      <ul>
        <li>O registo público cria sempre uma conta de <strong>comprador</strong>.</li>
        <li>
          A activação do <strong>perfil de parceiro</strong> implica aceitação expressa destes termos no ecrã «Programa de
          parceiros».
        </li>
        <li>
          No <strong>nível 1</strong> da loja, os dados institucionais (nome, localização em catálogo oficial, contactos)
          são revistos pela equipa antes da listagem completa ao público; até à <strong>aprovação</strong>, a criação e
          publicação de anúncios pode estar restrita.
        </li>
        <li>
          O catálogo está sujeito a <strong>moderação</strong>: anúncios podem ser revistos antes ou após publicação, segundo
          políticas internas (conformidade legal, coerência de oferta, qualidade de conteúdo). Itens ou mídias não conformes
          podem ser recusados, ocultados ou devolvidos para correcção.
        </li>
      </ul>
    ),
  },
  {
    key: "public.terms_partners_s03",
    defaultTitle: "3. Comissão de serviço (taxa da plataforma)",
    builtin: (
      <>
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
      </>
    ),
  },
  {
    key: "public.terms_partners_s04",
    defaultTitle: "4. Taxas de envio, logística e rastreamento",
    builtin: (
      <ul>
        <li>
          Os <strong>custos de entrega</strong> apresentados ao comprador decorrem das regras de frete (zonas, distâncias ou
          parceiros logísticos) configuradas na plataforma e/ou pela loja.
        </li>
        <li>
          Quando o envio é <strong>operado pela plataforma</strong>, o parceiro deve cumprir os prazos de preparação
          acordados; quando é <strong>operado pela loja</strong>, responde pela embalagem e pela{" "}
          <strong>actualização coerente</strong> do estado da encomenda no painel até entrega efectiva ao comprador.
        </li>
        <li>
          A plataforma regista, quando aplicável ao método de envio e de pagamento, dados de expediente (transportador,
          código de seguimento, URL de rastreamento) de forma a conferir ao comprador{" "}
          <strong>visibilidade alinhada</strong> ao ciclo do pedido, desde que o parceiro os introduza e mantenha actualizados.
        </li>
        <li>
          Taxas adicionais de serviços de terceiros (transportadoras, recolhas) podem aplicar-se segundo tabelas em vigor,
          sempre coerentes com o que aparece ao comprador antes de fechar o pedido.
        </li>
      </ul>
    ),
  },
  {
    key: "public.terms_partners_s05",
    defaultTitle: "5. Pagamentos electrónicos, escrow e disputas",
    builtin: (
      <>
        <p>
          Os procedimentos variam consoante o <strong>método de pagamento</strong>. Em <strong>pagamento online</strong>,{" "}
          após liquidação no gateway configurado pela plataforma, os valores podem permanecer em{" "}
          <strong>reténção (escrow)</strong>, com registo contabilístico interno (ledger), até confirmação pelo
          comprador, termo de prazo para confirmação
          automática quando configurado, ou desfecho de <strong>disputa</strong> tratada pela equipa nos instrumentos de
          gestão da plataforma.
        </p>
        <p>
          Quando, pela natureza do método, a reténção não se aplica (por exemplo certos fluxos de pagamento à entrega), o
          parceiro mantém o dever de boa fé e de exactidão nas actualizações de estado perante o comprador. É proibido
          obstruir deliberadamente o tratamento de reclamações fundadas.
        </p>
      </>
    ),
  },
  {
    key: "public.terms_partners_s06",
    defaultTitle: "6. Credibilização, visibilidade e apresentação no catálogo",
    builtin: (
      <>
        <p>
          A plataforma disponibiliza <strong>níveis voluntários de credibilização</strong>, sujeitos a análise documental
          interna. Após aprovação, podem atribuir-se indicações reconhecíveis na vitrine (designações do tipo «VERIFICADO» ou
          «PREMIUM»), conforme o processo descrito na área reservada ao parceiro. Documentos de identificação, dados fiscais
          ou bancários não são apresentados integralmente ao público; apenas elementos compatíveis com privacidade,
          veracidade comercial e requisitos legais.
        </p>
        <p>
          A ordenação em resultados de pesquisa e os blocos informativos na ficha de produto podem reflectir o estado de
          conformidade e de credibilização da loja, com vista a clareza para o comprador e apresentação consistente em
          telemóvel e computador.
        </p>
      </>
    ),
  },
  {
    key: "public.terms_partners_s07",
    defaultTitle: "7. Obrigações do parceiro",
    builtin: (
      <ul>
        <li>
          Manter <strong>dados de contacto</strong> e localização correctos.
        </li>
        <li>
          Cumprir <strong>prazos</strong> de preparação e responder a pedidos de esclarecimento dos compradores e do suporte.
        </li>
        <li>
          Vender apenas artigos <strong>legais</strong>, conforme descritos, com stock real e política de devolução coerente
          com a lei e com as regras da plataforma.
        </li>
        <li>Não utilizar o catálogo para fraude, duplicação abusiva ou manipulação de avaliações.</li>
      </ul>
    ),
  },
  {
    key: "public.terms_partners_s08",
    defaultTitle: "8. Suspensão e rescisão",
    builtin: (
      <p>
        A plataforma pode <strong>suspender</strong> anúncios ou lojas em caso de incumprimento grave, indício de fraude,
        pressão sobre compradores ou violação destes termos. Pode ainda encerrar a participação no programa de parceiros com
        comunicação prévia quando tal seja razoavelmente possível.
      </p>
    ),
  },
  {
    key: "public.terms_partners_s09",
    defaultTitle: "9. Protecção de dados",
    builtin: (
      <p>
        Os dados pessoais tratados no âmbito das encomendas devem ser usados apenas para execução do contrato de venda e
        obrigações legais, em linha com a política de privacidade da plataforma e a legislação aplicável em Angola.
      </p>
    ),
  },
  {
    key: "public.terms_partners_s10",
    defaultTitle: "10. Alterações",
    builtin: (
      <p>
        O <strong>BAZAR DO BIÉ</strong> pode actualizar estes termos. A versão aplicável é a publicada nesta página, com data
        de referência indicada no cabeçalho do documento. O uso continuado do painel comercial após aviso razoável constitui
        aceitação das alterações, salvo obrigação legal em contrário.
      </p>
    ),
  },
  {
    key: "public.terms_partners_s11",
    defaultTitle: "11. Contacto",
    builtin: (
      <p>
        Para questões sobre estes termos, comissões ou operações: utilize os canais de <strong>suporte</strong> indicados
        no site ou no rodapé da loja pública.
      </p>
    ),
  },
];
