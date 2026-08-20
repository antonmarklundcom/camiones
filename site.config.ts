/**
 * INSTANCE CONFIG (audit F17, Batch 4 template seam).
 *
 * This is the ONE file a fork edits to become a different site. Everything
 * here was previously hardcoded across ~12 files — the brand name in the
 * layout, the JSON-LD publisher, the WhatsApp copy, the footer, the OG titles
 * — which meant "make site #2" was a find-and-replace across the tree, and
 * every fix afterwards was N fixes across N forks.
 *
 * Rules for this file:
 *  - No imports from `src/` — it is read by client components, server
 *    components, scripts and tests alike, so it must stay dependency-free.
 *  - Nothing secret. Secrets are env vars; this is public brand/config data.
 *  - Values that differ per ENVIRONMENT (canonical host) still come from env;
 *    values that differ per SITE live here.
 *
 * What is deliberately NOT here yet: the message catalogue (all user-facing
 * copy) and the route folder names. Those are the second half of the template
 * seam — see PLAN.md Batch 4.
 */

export interface SiteConfig {
  /** Brand name as written in titles, JSON-LD and the footer. */
  name: string;
  /** Split rendering for the wordmark: "camiones" + ".com.py". */
  wordmark: { lead: string; accent: string };
  /** Fallback canonical host; NEXT_PUBLIC_CANONICAL_HOST overrides per env. */
  defaultHost: string;
  /** The country this instance sells in — used in H1s and meta copy. */
  country: string;
  /** One-line description for Organization JSON-LD and the footer blurb. */
  description: string;
  /** Contact block in the footer. `null` = the line is not rendered at all. */
  contact: {
    email: string | null;
    address: string | null;
    city: string | null;
  };
  /** Locale + currency conventions. */
  locale: string;
  currency: { primary: string; secondary: string };
}

export const siteConfig: SiteConfig = {
  name: "camiones.com.py",
  wordmark: { lead: "camiones", accent: ".com.py" },
  defaultHost: "camiones.com.py",
  country: "Paraguay",
  description:
    "Portal de camiones y vehículos de trabajo en Paraguay. Encontrá tu camión " +
    "con financiación y atención por WhatsApp.",
  contact: {
    // F30 — an unconfirmed mailbox on every page is a dead-end contact path.
    // NULL until a real mailbox exists; the footer omits the line entirely
    // rather than printing "(a confirmar)".
    email: null,
    address: null,
    city: "Asunción",
  },
  locale: "es-PY",
  currency: { primary: "US$", secondary: "₲" },
};

/** `%s | camiones.com.py` — the root layout's title template. */
export const titleTemplate = `%s | ${siteConfig.name}`;

/**
 * Characters the brand suffix costs a `<title>`. Pages cap their own text so
 * title + suffix stays ≤60 (F29 shipped 78-char titles by forgetting this).
 */
export const TITLE_SUFFIX_LENGTH = ` | ${siteConfig.name}`.length;
