import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests only — the money/URL/CSV logic that is expensive to get wrong and
 * cheap to test. No DB, no browser, no Playwright: this suite runs inside the
 * husky pre-push hook, so it has to stay fast (see PLAN.md Batch 0).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@app": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
});
