import { afterEach, describe, expect, it } from "vitest";
import { telLink, waLink, waNumber } from "@/lib/whatsapp";

const original = process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
  else process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP = original;
});

describe("waNumber", () => {
  it("strips formatting from a seller number", () => {
    expect(waNumber("+595 981 123-456")).toBe("595981123456");
  });

  it("returns null when there is no number anywhere", () => {
    delete process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
    expect(waNumber(null)).toBeNull();
  });

  it("rejects the .env.example placeholder — real buyers must never reach it", () => {
    process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP = "595000000000";
    expect(waNumber(null)).toBeNull();
  });

  it("rejects implausibly short numbers", () => {
    expect(waNumber("0981")).toBeNull();
  });

  it("falls back to the env number when the seller has none", () => {
    process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP = "595981555444";
    expect(waNumber(null)).toBe("595981555444");
  });

  it("prefers the seller's own number over the fallback", () => {
    process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP = "595981555444";
    expect(waNumber("595971222333")).toBe("595971222333");
  });
});

describe("waLink / telLink", () => {
  it("build links when a number resolves", () => {
    expect(waLink("595981123456", "Hola")).toBe(
      "https://wa.me/595981123456?text=Hola",
    );
    expect(telLink("595981123456")).toBe("tel:+595981123456");
  });

  it("return null instead of a dead wa.me/ or tel:+ link", () => {
    delete process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
    expect(waLink(null, "Hola")).toBeNull();
    expect(telLink(null)).toBeNull();
  });

  it("URL-encodes the prefilled message", () => {
    expect(waLink("595981123456", "Hola, ¿sigue disponible?")).toContain(
      "%C2%BFsigue%20disponible%3F",
    );
  });
});
