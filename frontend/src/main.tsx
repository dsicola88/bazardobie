import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.js";
import { SiteContentProvider } from "./site/SiteContentContext.js";
import { ensureCartSession } from "./api.js";
import App from "./App.js";
import "./styles.css";

ensureCartSession();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SiteContentProvider>
          <App />
        </SiteContentProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
