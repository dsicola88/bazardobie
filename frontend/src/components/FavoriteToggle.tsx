import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type FavRow = { productId: string; variantId: string | null };

type Props = {
  productId: string;
  /** Variante seleccionada quando o produto tem variantes */
  variantId: string | null;
  needVariant: boolean;
};

export function FavoriteToggle({ productId, variantId, needVariant }: Props) {
  const { token, user } = useAuth();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const canUse = Boolean(token && user?.role === "CLIENTE");

  useEffect(() => {
    if (!canUse || !token) return;
    let cancelled = false;
    void apiFetch<FavRow[]>("/favorites", { token })
      .then((rows) => {
        if (cancelled) return;
        const match = rows.some((f) => {
          if (f.productId !== productId) return false;
          if (needVariant) return variantId != null && f.variantId === variantId;
          return f.variantId == null;
        });
        setActive(match);
      })
      .catch(() => {
        if (!cancelled) setActive(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canUse, token, productId, variantId, needVariant]);

  async function toggle() {
    setHint(null);
    if (!token || !canUse) return;
    if (needVariant && !variantId) {
      setHint("Seleccione uma variante antes de guardar na lista de interesse.");
      return;
    }
    setBusy(true);
    try {
      if (active) {
        const qs = new URLSearchParams({ productId });
        if (needVariant && variantId) qs.set("variantId", variantId);
        await apiFetch(`/favorites?${qs}`, { method: "DELETE", token });
        setActive(false);
      } else {
        await apiFetch("/favorites", {
          method: "POST",
          token,
          body: JSON.stringify({
            productId,
            ...(needVariant && variantId ? { variantId } : {}),
          }),
        });
        setActive(true);
      }
      window.dispatchEvent(new Event("favorites-updated"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Não foi possível actualizar a lista.";
      setHint(msg.includes("Já está") ? "Este artigo já consta da sua lista de interesse." : msg);
    } finally {
      setBusy(false);
    }
  }

  if (!canUse) return null;

  return (
    <div className="ae-fav-toggle">
      <button
        type="button"
        className={`ae-fav-toggle__btn ${active ? "ae-fav-toggle__btn--on" : ""}`}
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={active}
        aria-label={active ? "Remover da lista de interesse" : "Guardar na lista de interesse"}
      >
        <svg className="ae-fav-toggle__ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <path
            fill="currentColor"
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
        <span className="ae-fav-toggle__txt">{active ? "Na lista de interesse" : "Guardar na lista"}</span>
      </button>
      {hint ? (
        <p className="ae-fav-toggle__hint" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
