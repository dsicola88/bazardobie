import { Fragment } from "react";
import type { ReactNode } from "react";
import type { PartnerTermsSectionSpec } from "./partnerTermsBuiltin.js";

/**
 * Interpreta texto multilinha do painel: parágrafos separados por linha em branco;
 * blocos só com linhas `- item` ou `• item` são listas HTML simples.
 */

export type PartnerTermsParsedOverride =
  | { kind: "empty" }
  | { kind: "custom"; titleOverride?: string; body: ReactNode };

function renderBlock(block: string, key: number): ReactNode {
  const lines = block.split("\n").map((x) => x.trimEnd()).filter(Boolean);
  if (!lines.length) return null;
  const bullets = lines.filter((ln) => /^[-•]\s+/.test(ln));
  if (bullets.length === lines.length) {
    return (
      <ul key={`b-${key}`}>
        {lines.map((ln, i) => (
          <li key={i}>{ln.replace(/^[-•]\s+/, "").trim()}</li>
        ))}
      </ul>
    );
  }
  return (
    <p key={`p-${key}`} style={{ whiteSpace: "pre-wrap" }}>
      {block.trim()}
    </p>
  );
}

export function renderPartnerTermsPlain(raw: string): ReactNode {
  const blocks = raw
    .trim()
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (!blocks.length) return null;
  return (
    <>
      {blocks.map((block, idx) => (
        <Fragment key={idx}>{renderBlock(block, idx)}</Fragment>
      ))}
    </>
  );
}

/** Opcional primeira linha `# Título`: substitui só o `<h2>`. */
export function parsePartnerTermsSectionOverride(
  raw: string | undefined,
  defaultTitle: string
): PartnerTermsParsedOverride {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { kind: "empty" };

  let rest = trimmed;
  let titleOverride: string | undefined;
  if (rest.startsWith("#")) {
    const lineEnd = rest.indexOf("\n");
    const hl = lineEnd === -1 ? rest : rest.slice(0, lineEnd);
    titleOverride = hl.replace(/^#\s*/, "").trim() || undefined;
    rest = lineEnd === -1 ? "" : rest.slice(lineEnd + 1).trim();
  }

  if (!rest) {
    return { kind: "custom", titleOverride: titleOverride ?? defaultTitle, body: null };
  }

  const body = renderPartnerTermsPlain(rest);
  return { kind: "custom", titleOverride, body };
}

/** Resolve título e corpo: campo vazio → texto por defeito; só `# Título` → título editado + corpo por defeito. */
export function resolvePartnerTermsSection(
  spec: PartnerTermsSectionSpec,
  raw: string | undefined
): { title: string; body: ReactNode } {
  const p = parsePartnerTermsSectionOverride(raw, spec.defaultTitle);
  if (p.kind === "empty") return { title: spec.defaultTitle, body: spec.builtin };

  const title = p.titleOverride?.trim() || spec.defaultTitle;
  if (p.body === null) return { title, body: spec.builtin };
  return { title, body: p.body };
}
