import { describe, expect, it } from "vitest";
import {
  assertImageUpload,
  formatMb,
  HERO_LIMITS,
  LOGO_LIMITS,
  MAX_LISTING_PHOTO_BYTES,
  PHOTO_LIMITS,
  validateImageUpload,
} from "@/lib/uploads";

const mb = (n: number) => n * 1024 * 1024;

describe("F10 — upload caps", () => {
  it("accepts an ordinary phone photo", () => {
    // The whole point of F10: 2–6 MB photos must get through.
    expect(
      validateImageUpload({ name: "IMG_1.jpg", size: mb(5), type: "image/jpeg" }, PHOTO_LIMITS),
    ).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(
      validateImageUpload({ name: "x.jpg", size: 0, type: "image/jpeg" }, PHOTO_LIMITS),
    ).toMatch(/vac[íi]o/);
  });

  it("rejects a file over the per-path cap", () => {
    expect(
      validateImageUpload({ name: "huge.png", size: mb(20), type: "image/png" }, PHOTO_LIMITS),
    ).toMatch(/12 MB/);
  });

  it("caps logos tighter than listing photos", () => {
    expect(LOGO_LIMITS.maxBytes).toBeLessThan(MAX_LISTING_PHOTO_BYTES);
    expect(
      validateImageUpload({ name: "logo.png", size: mb(6), type: "image/png" }, LOGO_LIMITS),
    ).toMatch(/4 MB/);
    expect(
      validateImageUpload({ name: "logo.png", size: mb(2), type: "image/png" }, LOGO_LIMITS),
    ).toBeNull();
  });

  it("caps hero images between the two", () => {
    expect(
      validateImageUpload({ name: "hero.webp", size: mb(9), type: "image/webp" }, HERO_LIMITS),
    ).toMatch(/8 MB/);
  });

  it("rejects a non-image MIME type", () => {
    expect(
      validateImageUpload({ name: "payload.pdf", size: mb(1), type: "application/pdf" }, PHOTO_LIMITS),
    ).toMatch(/no es una imagen/);
  });

  it("lets a missing MIME type through to the sharp decode", () => {
    expect(validateImageUpload({ name: "x", size: mb(1), type: "" }, PHOTO_LIMITS)).toBeNull();
  });

  it("names the file when it can, the field otherwise", () => {
    expect(validateImageUpload({ size: mb(20), type: "image/png" }, LOGO_LIMITS)).toMatch(
      /el logo/,
    );
  });

  it("throws from the assert form", () => {
    expect(() => assertImageUpload({ name: "h.png", size: mb(50) }, PHOTO_LIMITS)).toThrow();
    expect(() => assertImageUpload({ name: "ok.png", size: mb(1) }, PHOTO_LIMITS)).not.toThrow();
  });

  it("formats megabytes without decimals", () => {
    expect(formatMb(mb(12))).toBe("12 MB");
  });
});
