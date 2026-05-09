import { describe, expect, it } from "vitest";
import { resolveMediaUrlConfigured } from "./media.js";

/**
 * Garante o fluxo Vercel (site) + Railway (API): caminhos /uploads da BD/API
 * devem resolver para o host onde estão os ficheiros (banners, fotos de produto).
 */
describe("resolveMediaUrlConfigured", () => {
  it("Vercel: VITE_API_BASE relativo + VITE_MEDIA_ORIGIN → pré-visualização e listagens", () => {
    const cfg = {
      apiBase: "/api/v1",
      mediaOrigin: "https://bazardobie-production.up.railway.app",
      apiOriginFallback: "",
      pageOrigin: "https://bazardobie.vercel.app",
    };
    expect(resolveMediaUrlConfigured("/uploads/banner-hero.jpg", cfg)).toBe(
      "https://bazardobie-production.up.railway.app/uploads/banner-hero.jpg"
    );
  });

  it("produção: VITE_API_BASE absoluto → origem da API para /uploads", () => {
    const cfg = {
      apiBase: "https://api.loja.ao/api/v1",
      mediaOrigin: "",
      apiOriginFallback: "",
      pageOrigin: "https://loja.ao",
    };
    expect(resolveMediaUrlConfigured("/uploads/produto-1.webp", cfg)).toBe(
      "https://api.loja.ao/uploads/produto-1.webp"
    );
  });

  it("VITE_API_ORIGIN como sinónimo de VITE_MEDIA_ORIGIN", () => {
    const cfg = {
      apiBase: "/api/v1",
      mediaOrigin: "",
      apiOriginFallback: "https://api.outro.com",
      pageOrigin: "https://site.com",
    };
    expect(resolveMediaUrlConfigured("/uploads/x.png", cfg)).toBe("https://api.outro.com/uploads/x.png");
  });

  it("URL R2 completa mantém-se (upload novo)", () => {
    const cfg = {
      apiBase: "/api/v1",
      mediaOrigin: "",
      apiOriginFallback: "",
      pageOrigin: "https://a.com",
    };
    expect(resolveMediaUrlConfigured("https://pub-test.r2.dev/uploads/z.jpg", cfg)).toBe(
      "https://pub-test.r2.dev/uploads/z.jpg"
    );
  });
});
