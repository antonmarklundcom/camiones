import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /buscar is the form-redirect endpoint — never a destination.
        // /admin is the private panel (also noindexed via its own layout).
        // /api is machine-only (the guarded cron route lives there).
        // /wa is the tracked WhatsApp hop — a redirect, never a destination.
        disallow: ["/buscar", "/admin", "/api", "/wa"],
      },
    ],
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
