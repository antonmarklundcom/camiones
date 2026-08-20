/**
 * F17 — the instance seam. A fork edits site.config.ts and becomes a different
 * site; anything still hardcoded is a bug that multiplies across forks.
 */
import { describe, expect, it } from "vitest";
import { siteConfig, titleTemplate, TITLE_SUFFIX_LENGTH } from "@site.config";
import { ventaH1 } from "@/lib/urls";
import { WA_GENERIC_TEXT, waListingText } from "@/lib/whatsapp";

describe("siteConfig", () => {
  it("carries the brand identity in one place", () => {
    expect(siteConfig.name).toBe("camiones.com.py");
    expect(siteConfig.wordmark.lead + siteConfig.wordmark.accent).toBe(siteConfig.name);
  });

  it("keeps the title template consistent with the name", () => {
    expect(titleTemplate).toBe(`%s | ${siteConfig.name}`);
    expect(TITLE_SUFFIX_LENGTH).toBe(` | ${siteConfig.name}`.length);
  });

  it("omits contact lines that are not real yet (F30)", () => {
    // Null, not "contacto@… (a confirmar)": the footer drops the line entirely.
    expect(siteConfig.contact.email).toBeNull();
  });
});

describe("copy is driven by the config, not hardcoded", () => {
  it("uses the configured country in the default H1", () => {
    expect(ventaH1({})).toContain(siteConfig.country);
  });

  it("uses the configured brand in WhatsApp prefills", () => {
    expect(WA_GENERIC_TEXT).toContain(siteConfig.name);
    expect(waListingText("Scania R500 2021")).toContain(siteConfig.name);
  });
});
