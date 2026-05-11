import { memo } from "react";
import { listingBadgeClassList, listingBadgeModifier, type ListingBadgeModifier } from "../utils/listingBadgeClass.js";

export type ListingBadgeItem = { id: string; label: string };

function ListingBadgeIcon({ mod }: { mod: ListingBadgeModifier }) {
  const cls = "ae-listing-badge__icon";
  switch (mod) {
    case "ficha_completa":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-5.3-9.2l-2.1 2.1-1.4-1.4-1.4 1.4 2.8 2.8 3.5-3.5-1.4-1.4z"
          />
        </svg>
      );
    case "produto_detalhado":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M5 16L3 5l5.5 1L12 4l3.5 2L21 5l-2 11-7 3-7-3zm2.7-2.62L12 16l4.26-2.62L17.7 7.6l-4.47.89L12 6.18 10.77 8.5 6.3 7.6 7.7 13.38z"
          />
        </svg>
      );
    case "especificacoes_verificadas":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 17l-4-4 1.41-1.41L11 16.17l6.59-6.59L19 11l-8 7z"
          />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>
      );
  }
}

function ListingBadgeInner({ badge, compact = false }: { badge: ListingBadgeItem; compact?: boolean }) {
  const mod = listingBadgeModifier(badge.id);
  return (
    <span className={listingBadgeClassList(badge.id, compact)}>
      <ListingBadgeIcon mod={mod} />
      <span className="ae-listing-badge__text">{badge.label}</span>
    </span>
  );
}

export const ListingBadge = memo(ListingBadgeInner);
