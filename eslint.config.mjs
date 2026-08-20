/**
 * Flat ESLint config — part of the LOCAL quality gate (husky pre-push).
 * There is deliberately NO GitHub Actions workflow in this repo (zero runner
 * minutes, see CLAUDE.md); `npm run lint` is what the pre-push hook runs.
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "drizzle/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Server actions/scripts legitimately take unused leading args; keep the
      // gate about real problems, not style noise.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Node-side scripts (tsx) aren't part of the Next bundle.
    files: ["scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
];

export default config;
