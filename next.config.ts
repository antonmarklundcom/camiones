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
  experimental: {
    // Next's default is 1 MB, which silently rejected normal phone photos
    // (2–6 MB) before our own 12 MB check in images.ts could run — audit F10.
    // Raise deliberately, and keep per-file caps in the upload handlers.
    serverActions: { bodySizeLimit: "15mb" },
  },
  // Shared-hosting friendly: standalone output keeps the deployed footprint small.
  output: "standalone",
};

export default nextConfig;
