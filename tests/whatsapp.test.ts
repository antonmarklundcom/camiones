/**
 * F6: the primary conversion path must never render dead. These pin the
 * "no usable number → null → hide the CTA" contract the pages rely on.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  contactChannels,
  normalizeWaNumber,
  waLink,
  waNumber,
} from "@/lib/whatsapp";

const original = process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
  else process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP = original;
});

describe("normalizeWaNumber", () => {
  it("strips formatting", () => {
    expect(normalizeWaNumber("+595 (981) 123-456")).toBe("595981123456");
  });

  it("rejects empty, short and over-long input", () => {
    expect(normalizeWaNumber(undefined)).toBeNull();
    expect(normalizeWaNumber("")).toBeNull();
    expect(normalizeWaNumber("0981")).toBeNull();
    expect(normalizeWaNumber("1".repeat(16))).toBeNull();
  });

  it("rejects the .env.example placeholder", () => {
    expect(normalizeWaNumber("595000000000")).toBeNull();
    expect(normalizeWaNumber("+595 000 000 000")).toBeNull();
  });

  it("rejects an all-zero number", () => {
    expect(normalizeWaNumber("00000000")).toBeNull();
  });
});

describe("waNumber", () => {
  it("prefers the seller's own number", () => {
    process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP = "595971000000";
    expect(waNumber("595981123456")).toBe("595981123456");
  });

  it("falls back to the site default", () => {
    process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP = "595971111111";
    expect(waNumber(null)).toBe("595971111111");
  });

  it("is null when neither resolves", () => {
    delete process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
    expect(waNumber(null)).toBeNull();
  });

  it("is null when the default is still the placeholder", () => {
    process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP = "595000000000";
    expect(waNumber(null)).toBeNull();
  });
});

describe("waLink", () => {
  it("URL-encodes the prefilled message", () => {
    expect(waLink("595981123456", "Hola, ¿sigue disponible?")).toBe(
      "https://wa.me/595981123456?text=Hola%2C%20%C2%BFsigue%20disponible%3F",
    );
  });

  it("returns null instead of wa.me/?text= when there is no number", () => {
    delete process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
    expect(waLink(null, "Hola")).toBeNull();
  });
});

describe("contactChannels", () => {
  it("builds all three channels from one number", () => {
    const c = contactChannels("595981123456", "(0981) 123 456", "Hola");
    expect(c.wa).toContain("wa.me/595981123456");
    expect(c.tel).toBe("tel:+595981123456");
    expect(c.phoneText).toBe("(0981) 123 456");
  });

  it("falls back to the E.164 form when there is no display number", () => {
    expect(contactChannels("595981123456", null, "Hola").phoneText).toBe(
      "+595981123456",
    );
    expect(contactChannels("595981123456", "   ", "Hola").phoneText).toBe(
      "+595981123456",
    );
  });

  it("hides every channel — including the display number — with no phone", () => {
    delete process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP;
    expect(contactChannels(null, "(0981) 123 456", "Hola")).toEqual({
      wa: null,
      tel: null,
      phoneText: null,
    });
  });
});
