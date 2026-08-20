/**
 * Vitest covers the pure logic that silently breaks money, URLs and imports:
 * cuota.ts, urls.ts, venta-params.ts, csv.ts, slug.ts. No DB, no DOM, no
 * Playwright — the suite must stay fast enough to run in the pre-push hook.
 */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@app": fileURLToPath(new URL("./app", import.meta.url)),
      "@site.config": fileURLToPath(new URL("./site.config.ts", import.meta.url)),
    },
  },
});
