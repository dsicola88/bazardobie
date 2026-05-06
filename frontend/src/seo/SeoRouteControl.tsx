import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NOINDEX_PREFIXES = ["/admin", "/vendor", "/logistica"];
const NOINDEX_EXACT = ["/checkout", "/orders", "/notifications", "/favorites", "/cart", "/login", "/reset-password"];

export function SeoRouteControl() {
  const { pathname } = useLocation();
  const shouldNoIndex =
    NOINDEX_PREFIXES.some((p) => pathname.startsWith(p)) || NOINDEX_EXACT.some((p) => pathname === p);

  useEffect(() => {
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", shouldNoIndex ? "noindex,nofollow" : "index,follow");
  }, [shouldNoIndex]);

  return null;
}
