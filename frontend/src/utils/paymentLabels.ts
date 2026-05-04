/** Estado do gateway nos pedidos (`gatewayPayStatus`). */
export function etiquetaGateway(status: string): string {
  switch (status) {
    case "NAO_APLICA":
      return "—";
    case "AGUARDANDO_PAGAMENTO":
      return "À espera de liquidação";
    case "PROCESSANDO":
      return "Em processamento bancário";
    case "PAGO":
      return "Liquidado electrónicamente";
    case "FALHOU":
      return "Pagamento falhou";
    default:
      return status;
  }
}

/** Método de pagamento da encomenda. */
export function etiquetaPagamento(method: string): string {
  switch (method) {
    case "COD":
      return "Pagamento à entrega";
    case "TRANSFERENCIA":
      return "Transferência bancária";
    case "PAGAMENTO_ONLINE":
      return "Pagamento electrónico";
    default:
      return method;
  }
}

/** Estado do escrow (`EscrowState`) — texto para o comprador. */
export function etiquetaEscrowEstado(state: string): string {
  switch (state) {
    case "NOT_APPLICABLE":
      return "Não aplicável (sem pagamento online retido)";
    case "AWAITING_FUNDS":
      return "À espera que o pagamento entre na conta da plataforma";
    case "HELD":
      return "Valor retido em segurança até confirmar receção ou prazo automático";
    case "PENDING_BUYER_CONFIRM":
      return "Aguarda a sua confirmação de que recebeu os artigos em conformidade";
    case "RELEASED":
      return "Valor libertado ao parceiro, conforme regras da encomenda";
    case "REFUNDED":
      return "Reembolso registado ao comprador";
    default:
      return state.replace(/_/g, " ");
  }
}

export function etiquetaMotivoLibertacaoEscrow(reason: string): string {
  switch (reason) {
    case "BUYER_CONFIRMED":
      return "Confirmou a receção";
    case "AUTO_CONFIRM_TIMEOUT":
      return "Prazo automático sem disputa";
    case "DISPUTE_FULL_REFUND":
      return "Decisão de disputa — reembolso total";
    case "DISPUTE_PARTIAL_SETTLEMENT":
      return "Decisão de disputa — acordo parcial";
    default:
      return reason.replace(/_/g, " ");
  }
}

export function etiquetaMovimentoLedger(kind: string): string {
  switch (kind) {
    case "ESCROW_HOLD":
      return "Retenção em segurança";
    case "RELEASE_TO_SHOP":
      return "Libertação à loja";
    case "REFUND_TO_BUYER":
      return "Reembolso ao comprador";
    default:
      return kind.replace(/_/g, " ");
  }
}

export function etiquetaEstadoDisputa(status: string): string {
  switch (status) {
    case "OPEN":
      return "Aberta";
    case "CLOSED_REJECTED":
      return "Encerrada — sem reembolso";
    case "CLOSED_FULL_REFUND":
      return "Encerrada — reembolso total";
    case "CLOSED_PARTIAL_REFUND":
      return "Encerrada — reembolso parcial";
    default:
      return status.replace(/_/g, " ");
  }
}
