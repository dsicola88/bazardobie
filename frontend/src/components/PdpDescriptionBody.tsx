import { memo, useMemo } from "react";

/** Linhas-tipo lista: check, bullets, numeradas e alguns emoji habituais em anúncios. */
const LIST_LINE =
  /^\s*(?:[\u2705\u2714\u2713\u2728\u2B50\u26AA]|\u{1F539}|\u{1F4E6}|\u{1F69A}|\u{1F4CE}|[\u2022\u25CF\u2013\-*]|\d+[\.)])\s*(.*)$/u;

function parseBlocks(text: string): Array<{ type: "p" | "ul"; body: string[] }> {
  const raw = text.trim();
  if (!raw) return [];
  const chunks = raw.split(/\n{2,}/);
  const out: Array<{ type: "p" | "ul"; body: string[] }> = [];
  for (const chunk of chunks) {
    const lines = chunk.split(/\n/).map((l) => l.trimEnd());
    const nonempty = lines.map((l) => l.trim()).filter(Boolean);
    if (nonempty.length === 0) continue;
    const listLike =
      nonempty.length >= 2 && nonempty.every((l) => LIST_LINE.test(l) || /^[-*•]\s+\S/.test(l));
    if (listLike) {
      const items = nonempty.map((l) => {
        const m = l.match(LIST_LINE);
        if (m?.[1]) return m[1].trim();
        return l.replace(/^[-*•]\s+/, "").replace(/^\d+[\.)]\s+/, "").trim();
      });
      out.push({ type: "ul", body: items });
    } else {
      out.push({ type: "p", body: [lines.join("\n").trim()] });
    }
  }
  return out;
}

function PdpDescriptionBodyInner({ text }: { text: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  if (blocks.length === 0) return <p className="ae-muted ae-pdp-prose__empty">Sem descrição detalhada neste momento.</p>;
  return (
    <div className="ae-pdp-prose">
      {blocks.map((b, i) =>
        b.type === "ul" ? (
          <ul key={i} className="ae-pdp-prose__ul">
            {b.body.map((item, j) => (
              <li key={j} className="ae-pdp-prose__li">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="ae-pdp-prose__p">
            {b.body[0]}
          </p>
        ),
      )}
    </div>
  );
}

export const PdpDescriptionBody = memo(PdpDescriptionBodyInner);
