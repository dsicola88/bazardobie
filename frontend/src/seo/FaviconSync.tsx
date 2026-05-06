import { useEffect } from "react";
import { useSiteContent } from "../site/SiteContentContext.js";
import { resolveMediaUrl } from "../utils/media.js";

function upsertFavicon(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "icon";
    document.head.appendChild(el);
  }
  el.href = href;
}

export function FaviconSync() {
  const { content } = useSiteContent();

  useEffect(() => {
    const raw = (content["public.favicon_url"] ?? "").trim();
    if (!raw) return;
    const href = resolveMediaUrl(raw);
    if (!href) return;
    upsertFavicon(href);
  }, [content]);

  return null;
}
