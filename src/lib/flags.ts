/**
 * Feature flags. The Decisions Log locks the set to exactly five —
 * `financing`, `dualCurrency`, `guides`, `contactChannels`, `verifiedSellers` —
 * and resists more. Batch 4 (template seam) moves them into `site.config.ts`
 * alongside SITE_NAME/CANONICAL_HOST; until then only the one Batch 3 needs
 * lives here, so the two batches don't fight over the same file.
 *
 * Client-safe: no "server-only", no DB. NEXT_PUBLIC_* vars are inlined at build
 * time, so flipping a flag needs a redeploy — deliberate for a kill switch.
 */
function envFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === "") return fallback;
  return ["1", "true", "on", "yes", "si", "sí"].includes(raw.trim().toLowerCase());
}

/**
 * `financing` — DEFAULT OFF, and it stays off until verified real rates
 * replace the "(PLACEHOLDER)" programs. Off means the cuota calculator, the
 * card cuota line and the financing copy do not render at all. Note this is
 * belt AND braces: `usablePrograms()` in cuota.ts drops placeholder programs
 * regardless of the flag, so turning the flag on with fake rates still renders
 * nothing.
 */
export const FEATURE_FINANCING = envFlag(
  process.env.NEXT_PUBLIC_FEATURE_FINANCING,
  false,
);
