/**
 * JSON-LD builders — Vehicle+Offer on detail pages, ItemList on grids,
 * Organization on home. Kept in one file so the structured-data contract is
 * reviewable at a glance.
 */
import { FUEL_LABELS, TRANSMISSION_LABELS, categoryByValue } from "@/lib/taxonomy";
import { absoluteUrl, listingPath, siteOrigin } from "@/lib/urls";
import { imageUrl } from "@/lib/r2";
import { siteConfig } from "@site.config";
import type { getListingBySlug, ListingCardData } from "@/lib/queries";

type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListingBySlug>>>;

export function vehicleJsonLd(l: ListingDetail): object {
  const url = absoluteUrl(listingPath(l.slug));
  const imgs = l.images
    .map((i) => imageUrl(i.r2Key))
    .filter((u): u is string => !!u)
    .map((u) => (u.startsWith("/") ? absoluteUrl(u) : u));

  return {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: l.title,
    url,
    image: imgs,
    brand: { "@type": "Brand", name: l.brand.name },
    model: l.model,
    vehicleModelDate: String(l.year),
    bodyType: categoryByValue(l.category).singular,
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: l.km,
      unitCode: "KMT",
    },
    vehicleTransmission: TRANSMISSION_LABELS[l.transmission],
    fuelType: FUEL_LABELS[l.fuel],
    ...(l.capacityKg
      ? {
          payload: {
            "@type": "QuantitativeValue",
            value: l.capacityKg,
            unitCode: "KGM",
          },
        }
      : {}),
    itemCondition:
      l.condition === "nuevo"
        ? "https://schema.org/NewCondition"
        : "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      url,
      price: Number(l.priceUsd),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      itemCondition:
        l.condition === "nuevo"
          ? "https://schema.org/NewCondition"
          : "https://schema.org/UsedCondition",
      seller: {
        "@type": l.seller.type === "dealer" ? "AutoDealer" : "Person",
        name: l.seller.name,
      },
    },
  };
}

export function itemListJsonLd(cards: ListingCardData[], name: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: cards.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(listingPath(c.slug)),
      name: c.title,
    })),
  };
}

export function articleJsonLd(g: {
  slug: string;
  title: string;
  excerpt: string | null;
  heroR2Key: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
}): object {
  const url = absoluteUrl(`/guias/${g.slug}`);
  const hero = imageUrl(g.heroR2Key);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.excerpt ?? undefined,
    url,
    mainEntityOfPage: url,
    ...(hero ? { image: [hero.startsWith("/") ? absoluteUrl(hero) : hero] } : {}),
    datePublished: g.publishedAt ? new Date(g.publishedAt).toISOString() : undefined,
    dateModified: new Date(g.updatedAt).toISOString(),
    author: { "@type": "Organization", name: siteConfig.name },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg") },
    },
  };
}

export function organizationJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteOrigin(),
    logo: absoluteUrl("/icon.svg"),
    description: siteConfig.description,
  };
}
