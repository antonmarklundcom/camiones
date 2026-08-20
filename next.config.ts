import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Listing photos live on Cloudflare R2 behind the CDN (or /public for the
  // seeded placeholders). R2 public buckets don't transform images, so a
  // pass-through loader serves the stored WebP directly — no sharp on the
  // hosting box, no optimizer traffic.
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  // Shared-hosting friendly: standalone output keeps the deployed footprint small.
  output: "standalone",
  experimental: {
    // F10: Next's default server-action body cap is 1 MB, which silently
    // rejected normal phone photos (2–6 MB) BEFORE our own 12 MB check ran.
    // 15 MB leaves headroom for a multi-photo upload; every upload path caps
    // and MIME-checks each file itself (src/lib/admin/images.ts, uploads.ts).
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
