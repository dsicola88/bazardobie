import { describe, expect, it } from "vitest";
import { resolvePublicMediaUrl } from "../src/utils/mediaUrlCore.js";

/**
 * Contrato usado ao criar/editar banners e produtos: caminhos /uploads na BD
 * devem transformar-se em URL absoluta da API (PUBLIC_BASE_URL na Railway).
 */
describe("resolvePublicMediaUrl (banner + produto — resposta API)", () => {
  it("prefixa /uploads com a origem pública da API", () => {
    expect(resolvePublicMediaUrl("/uploads/banner-hero.jpg", "https://api.example.com")).toBe(
      "https://api.example.com/uploads/banner-hero.jpg"
    );
  });

  it("remove barra final de PUBLIC_BASE_URL", () => {
    expect(resolvePublicMediaUrl("/uploads/f.png", "https://railway.app/")).toBe(
      "https://railway.app/uploads/f.png"
    );
  });

  it("mantém URLs https (R2 após upload, Unsplash, etc.)", () => {
    expect(
      resolvePublicMediaUrl("https://pub-xxx.r2.dev/uploads/a.webp", "https://api.com")
    ).toBe("https://pub-xxx.r2.dev/uploads/a.webp");
  });

  it("não reescreve /demo (ficheiros estáticos do frontend)", () => {
    expect(resolvePublicMediaUrl("/demo/placeholder.svg", "https://api.com")).toBe(
      "/demo/placeholder.svg"
    );
  });
});
