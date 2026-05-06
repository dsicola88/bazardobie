import { useEffect } from "react";

type SeoInput = {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
  robots?: string;
  jsonLd?: Record<string, unknown> | null;
};

const SITE_NAME = "BAZAR DO BIÉ";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function upsertJsonLd(id: string, payload: Record<string, unknown>) {
  let script = document.head.querySelector<HTMLScriptElement>(`script[data-seo-id="${id}"]`);
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.seoId = id;
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

export function useSeo(input: SeoInput) {
  useEffect(() => {
    const base = window.location.origin;
    const canonical = input.canonicalPath
      ? new URL(input.canonicalPath, base).toString()
      : window.location.href;

    document.title = input.title;
    upsertCanonical(canonical);
    upsertMeta("name", "description", input.description);
    upsertMeta("name", "robots", input.robots ?? "index,follow");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:title", input.title);
    upsertMeta("property", "og:description", input.description);
    upsertMeta("property", "og:url", canonical);
    if (input.image) upsertMeta("property", "og:image", new URL(input.image, base).toString());
    upsertMeta("name", "twitter:card", input.image ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", input.title);
    upsertMeta("name", "twitter:description", input.description);
    if (input.image) upsertMeta("name", "twitter:image", new URL(input.image, base).toString());
    if (input.jsonLd) upsertJsonLd("page", input.jsonLd);

    return () => {
      if (!input.jsonLd) return;
      const script = document.head.querySelector<HTMLScriptElement>('script[data-seo-id="page"]');
      if (script) script.remove();
    };
  }, [input.title, input.description, input.canonicalPath, input.image, input.robots, input.jsonLd]);
}
