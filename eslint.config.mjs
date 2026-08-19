import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

/**
 * Flat config (ESLint 9) wrapping eslint-config-next, which is pinned to the
 * Next 15 line to match `next` itself — the v16 config adds React-Compiler-era
 * rules this codebase is not written against.
 *
 * Runs from the husky pre-push hook, never from CI: this repo spends no GitHub
 * Actions minutes by policy (PLAN.md Batch 0).
 */
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  {
    ignores: [".next/**", "node_modules/**", "drizzle/**", "public/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Import/seed scripts run under tsx and legitimately log progress.
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
