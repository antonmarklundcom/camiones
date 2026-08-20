/**
 * F6 — a CTA that opens a WhatsApp error page, or dials "+", is worse than no
 * CTA. These pin which numbers count as real.
 */
import { describe, expect, it, afterEach } from "vitest";
import { hasWhatsApp, telLink, waLink, waNumber } from "@/lib/whatsapp";

const originalEnv = process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
afterEach(() => {
  if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
  else process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP = originalEnv;
});

describe("waNumber", () => {
  it("keeps a real number, digits only", () => {
    expect(waNumber("+595 981 123-456")).toBe("595981123456");
  });

  it("rejects the placeholder shipped in .env.example", () => {
    expect(waNumber("595000000000")).toBe("");
  });

  it("rejects all-zero and too-short numbers", () => {
    expect(waNumber("0")).toBe("");
    expect(waNumber("00000")).toBe("");
    expect(waNumber("5950000")).toBe("");
    expect(waNumber("12345")).toBe("");
  });

  it("treats empty, null and undefined as absent", () => {
    delete process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
    expect(waNumber(null)).toBe("");
    expect(waNumber(undefined)).toBe("");
    expect(waNumber("")).toBe("");
  });

  it("falls back to the site number only when it is real", () => {
    process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP = "595981999888";
    expect(waNumber(null)).toBe("595981999888");
    process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP = "595000000000";
    expect(waNumber(null)).toBe("");
  });
});

describe("waLink / telLink / hasWhatsApp", () => {
  it("build links for a real number", () => {
    expect(waLink("595981123456", "Hola")).toBe("https://wa.me/595981123456?text=Hola");
    expect(telLink("595981123456")).toBe("tel:+595981123456");
    expect(hasWhatsApp("595981123456")).toBe(true);
  });

  it("return null rather than a broken link when there is no number", () => {
    delete process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
    // The old code produced "https://wa.me/?text=..." (a WhatsApp error page)
    // and "tel:+" (dials nothing).
    expect(waLink(null, "Hola")).toBeNull();
    expect(telLink(null)).toBeNull();
    expect(hasWhatsApp(null)).toBe(false);
  });

  it("URL-encodes the prefilled message", () => {
    expect(waLink("595981123456", "Hola, ¿sigue disponible?")).toContain(
      encodeURIComponent("Hola, ¿sigue disponible?"),
    );
  });
});
