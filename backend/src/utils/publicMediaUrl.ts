import { env } from "../config/env.js";
import { resolvePublicMediaUrl } from "./mediaUrlCore.js";

export { resolvePublicMediaUrl };

/**
 * Expõe caminhos `/uploads/…` armazenados na BD como URL absoluta da API (`PUBLIC_BASE_URL`).
 * Assim o frontend (ex.: Vercel) carrega imagens sem depender de `VITE_MEDIA_ORIGIN`.
 * URLs `https://` (R2, CDN) e caminhos `/demo/…` permanecem inalterados.
 */
export function publicMediaUrl(stored: string | null | undefined): string {
  return resolvePublicMediaUrl(stored, env.PUBLIC_BASE_URL);
}

type ProductLike = {
  images?: { url: string }[];
  variants?: { imageUrl: string | null }[] | null;
  reviews?: Array<{
    photoUrls?: string[];
    user?: { avatarUrl: string | null } | null;
  }> | null;
};

/** Mapeia URLs de media num produto (resposta JSON). */
export function mapProductMediaForApi<T extends ProductLike>(p: T): T {
  return {
    ...p,
    ...(p.images && {
      images: p.images.map((img) => ({ ...img, url: publicMediaUrl(img.url) })),
    }),
    ...(p.variants && {
      variants: p.variants.map((v) => ({
        ...v,
        imageUrl:
          v.imageUrl != null && String(v.imageUrl).trim() !== ""
            ? publicMediaUrl(v.imageUrl)
            : v.imageUrl,
      })),
    }),
    ...(p.reviews && {
      reviews: p.reviews.map((r) => ({
        ...r,
        photoUrls: Array.isArray(r.photoUrls)
          ? r.photoUrls.map((u) => (typeof u === "string" ? publicMediaUrl(u) : u))
          : r.photoUrls,
        ...(r.user && {
          user: {
            ...r.user,
            avatarUrl: r.user.avatarUrl ? publicMediaUrl(r.user.avatarUrl) : r.user.avatarUrl,
          },
        }),
      })),
    }),
  };
}

type CartItemLike = {
  product?: (ProductLike & { shop?: { logoUrl?: string | null } | null }) | null;
  variant?: { imageUrl?: string | null } | null;
};

export function mapNestedProductMediaForApi(product: NonNullable<CartItemLike["product"]>) {
  const pm = mapProductMediaForApi(product);
  if (!pm.shop) return pm;
  return {
    ...pm,
    shop: {
      ...pm.shop,
      logoUrl: pm.shop.logoUrl ? publicMediaUrl(pm.shop.logoUrl) : pm.shop.logoUrl,
    },
  };
}

type CartLike = { items?: CartItemLike[] };

export function mapCartMediaForApi<C extends CartLike | null>(cart: C): C {
  if (!cart?.items) return cart;
  return {
    ...cart,
    items: cart.items.map((it) => ({
      ...it,
      ...(it.product && { product: mapNestedProductMediaForApi(it.product) }),
      ...(it.variant && {
        variant: {
          ...it.variant,
          imageUrl:
            it.variant.imageUrl != null && String(it.variant.imageUrl).trim() !== ""
              ? publicMediaUrl(it.variant.imageUrl)
              : it.variant.imageUrl,
        },
      }),
    })),
  };
}

export function mapCartItemMediaForApi(item: CartItemLike): CartItemLike {
  return {
    ...item,
    ...(item.product && { product: mapNestedProductMediaForApi(item.product) }),
    ...(item.variant && {
      variant: {
        ...item.variant,
        imageUrl:
          item.variant.imageUrl != null && String(item.variant.imageUrl).trim() !== ""
            ? publicMediaUrl(item.variant.imageUrl)
            : item.variant.imageUrl,
      },
    }),
  };
}

/** Linha de pedido (lista/detalhe) com produto, variante e loja. */
export function mapOrderItemRowMedia<I extends {
  product?: ProductLike | null;
  variant?: { imageUrl?: string | null } | null;
  shop?: { logoUrl?: string | null } | null;
}>(it: I): I {
  return {
    ...it,
    ...(it.product && {
      product: mapProductMediaForApi(it.product as unknown as ProductLike),
    }),
    ...(it.variant && {
      variant: {
        ...it.variant,
        imageUrl:
          it.variant.imageUrl != null && String(it.variant.imageUrl).trim() !== ""
            ? publicMediaUrl(it.variant.imageUrl)
            : it.variant.imageUrl,
      },
    }),
    ...(it.shop && {
      shop: {
        ...it.shop,
        logoUrl: it.shop.logoUrl ? publicMediaUrl(it.shop.logoUrl) : it.shop.logoUrl,
      },
    }),
  };
}

export function mapOrderWithItemsMedia<O extends { items: unknown[] }>(order: O): O {
  return {
    ...order,
    items: order.items.map((it) => mapOrderItemRowMedia(it as Parameters<typeof mapOrderItemRowMedia>[0])) as O["items"],
  };
}
