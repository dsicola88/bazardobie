import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.js";
import { SiteContentProvider } from "./site/SiteContentContext.js";
import { ensureCartSession } from "./api.js";
import App from "./App.js";
import "./styles.css";

class AppErrorBoundary extends Component<{ children: ReactNode }, { msg: string | null }> {
  state: { msg: string | null } = { msg: null };

  static getDerivedStateFromError(err: unknown): { msg: string | null } {
    return { msg: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.msg) {
      return (
        <div
          style={{
            padding: 24,
            maxWidth: 560,
            margin: "48px auto",
            fontFamily: 'system-ui, "Segoe UI", sans-serif',
          }}
        >
          <h1 style={{ fontSize: 20 }}>Não foi possível carregar a aplicação</h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>Detalhe técnico (útil para suporte):</p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 13,
              background: "#f1f5f9",
              padding: 12,
              borderRadius: 8,
            }}
          >
            {this.state.msg}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: "10px 16px", cursor: "pointer", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
          >
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ensureCartSession();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SiteContentProvider>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </SiteContentProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
