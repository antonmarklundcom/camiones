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
};

export default nextConfig;
