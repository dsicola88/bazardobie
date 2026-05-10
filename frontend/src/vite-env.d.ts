/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  /** "true" para mostrar pagamento electrónico (fluxo MOCK) em builds de produção */
  readonly VITE_SHOW_ONLINE_PAYMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
