import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /buscar is the form-redirect endpoint — never a destination.
        disallow: ["/buscar"],
      },
    ],
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
