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
    // Next defaults its build workers to os.cpus().length - 1, which on
    // Hostinger's shared box is the physical core count of the host, not
    // this account's share. Each worker is a Node process, counted against
    // the account-wide 200 "Max Processes" cap shared by 9 apps. One worker
    // keeps a deploy from tipping the account over the cap. Same fix as
    // vendercrm PR #84, propia.node PR #81, trabajo PR #82.
    cpus: 1,
  },
  // Shared-hosting friendly: standalone output keeps the deployed footprint small.
  output: "standalone",
};

export default nextConfig;
