import { describe, expect, it } from "vitest";
import { buildPayload, idempotencyKey } from "@/lib/crm";

describe("idempotencyKey", () => {
  const at = new Date("2026-08-19T14:30:00Z");

  it("is stable for the same phone within the same hour", () => {
    expect(idempotencyKey("0981 123 456", at)).toBe(
      idempotencyKey("0981 123 456", new Date("2026-08-19T14:59:59Z")),
    );
  });

  it("ignores formatting differences in the phone", () => {
    expect(idempotencyKey("0981 123 456", at)).toBe(
      idempotencyKey("(0981) 123-456", at),
    );
  });

  it("changes in the next hour, so the same person can enquire again", () => {
    expect(idempotencyKey("0981123456", at)).not.toBe(
      idempotencyKey("0981123456", new Date("2026-08-19T15:00:00Z")),
    );
  });

  it("differs between phone numbers", () => {
    expect(idempotencyKey("0981123456", at)).not.toBe(
      idempotencyKey("0982123456", at),
    );
  });

  it("stays inside the CRM's 8–100 character limit", () => {
    const key = idempotencyKey("0981123456", at);
    expect(key.length).toBeGreaterThanOrEqual(8);
    expect(key.length).toBeLessThanOrEqual(100);
  });
});

describe("buildPayload", () => {
  const lead = { name: "Ana", phone: "0981123456", message: "¿Sigue disponible?" };

  it("sends the required identity fields", () => {
    const p = buildPayload(lead, "key-12345678");
    expect(p.phone).toBe("0981123456");
    expect(p.idempotency_key).toBe("key-12345678");
    expect(p.source).toBe("site:camiones");
  });

  it("omits optional fields rather than sending empty strings", () => {
    const p = buildPayload(lead, "key-12345678");
    expect(p).not.toHaveProperty("page_url");
    expect(p).not.toHaveProperty("utm_source");
    expect(p).not.toHaveProperty("fields");
  });

  it("includes optional fields when present", () => {
    const p = buildPayload(
      { ...lead, pageUrl: "https://camiones.com.py/camion/x", utmSource: "google" },
      "key-12345678",
    );
    expect(p.page_url).toBe("https://camiones.com.py/camion/x");
    expect(p.utm_source).toBe("google");
  });

  it("passes listing context through `fields`", () => {
    const p = buildPayload({ ...lead, fields: { listing_public_id: "AB12CD34" } }, "k1234567");
    expect(p.fields).toEqual({ listing_public_id: "AB12CD34" });
  });

  it("never sends routing fields — pipeline/stage/owner live in the CRM", () => {
    const p = buildPayload(lead, "key-12345678");
    for (const forbidden of ["pipeline", "stage", "owner", "tag"]) {
      expect(p).not.toHaveProperty(forbidden);
    }
  });
});
