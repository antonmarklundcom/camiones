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
  // F10: Next defaults server actions to a 1 MB body, which silently rejected
  // ordinary 2–6 MB phone photos with an opaque error before our own 12 MB
  // check ever ran. Raised deliberately; the real protection is the per-file
  // cap + MIME check in src/lib/uploads.ts, which every upload path calls.
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
  // Shared-hosting friendly: standalone output keeps the deployed footprint small.
  output: "standalone",
};

export default nextConfig;
