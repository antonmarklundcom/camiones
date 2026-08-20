import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests only — pure logic (money, URLs, CSV, slugs, policy rules). No
 * Playwright, no DB: the quality gate runs on every push via husky and has to
 * stay fast enough that nobody is tempted to skip it (PLAN.md Batch 0).
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
