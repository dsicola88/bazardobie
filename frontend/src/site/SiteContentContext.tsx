import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "../api.js";
import { SITE_CONTENT_DEFAULTS, mergeSiteContent } from "./siteContent.js";

type Ctx = {
  content: Record<string, string>;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SiteCtx = createContext<Ctx | null>(null);

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Record<string, string>>(SITE_CONTENT_DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const bundle = await apiFetch<Record<string, string>>("/site-content");
      setContent(mergeSiteContent(bundle));
    } catch {
      setContent(SITE_CONTENT_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ content, loading, refresh }), [content, loading, refresh]);

  return <SiteCtx.Provider value={value}>{children}</SiteCtx.Provider>;
}

export function useSiteContent() {
  const c = useContext(SiteCtx);
  if (!c) throw new Error("SiteContentProvider em falta");
  return c;
}

export function useSiteText(key: string): string {
  const { content } = useSiteContent();
  return content[key] ?? SITE_CONTENT_DEFAULTS[key] ?? "";
}
