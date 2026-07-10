import type { MetadataRoute } from "next";
import { buildSitemapEntries } from "@/lib/sitemap";
import { siteOrigin } from "@/lib/urls";

// Depends on the live DB — render at request time, not at build (Hostinger
// builds before the app can connect). Crawlers fetch this rarely.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const entries = await buildSitemapEntries();
  return entries.map((e) => ({
    url: `${origin}${e.path}`,
    lastModified: e.lastmod,
  }));
}
