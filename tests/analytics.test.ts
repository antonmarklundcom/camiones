/**
 * First-party analytics — the pure request-shaping bits. The buffered writer
 * and the SQL rollup need a database and are covered by the real-DB checklist
 * in PLAN.md; the suite stays DB-free and sub-second.
 */
import { describe, expect, it } from "vitest";
import { isBot, referrerHost, visitorHash } from "@/lib/analytics/record";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";

describe("isBot", () => {
  it("lets a real Android browser through — the majority device here", () => {
    expect(isBot(CHROME_ANDROID)).toBe(false);
  });

  it("filters obvious crawlers and link previewers", () => {
    for (const ua of [
      "Googlebot/2.1 (+http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "facebookexternalhit/1.1",
      "WhatsApp/2.23",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "HeadlessChrome/120",
    ]) {
      expect(isBot(ua)).toBe(true);
    }
  });

  it("treats a missing user-agent as a bot", () => {
    // Nobody browsing on a phone sends no UA; something automated does.
    expect(isBot(null)).toBe(true);
    expect(isBot("")).toBe(true);
  });
});

describe("visitorHash", () => {
  const day1 = new Date("2026-08-20T09:00:00Z");
  const day2 = new Date("2026-08-21T09:00:00Z");

  it("collapses one person's refreshes within a day", () => {
    expect(visitorHash("1.2.3.4", CHROME_ANDROID, day1)).toBe(
      visitorHash("1.2.3.4", CHROME_ANDROID, new Date("2026-08-20T23:59:00Z")),
    );
  });

  it("rotates daily, so nobody is trackable across days", () => {
    expect(visitorHash("1.2.3.4", CHROME_ANDROID, day1)).not.toBe(
      visitorHash("1.2.3.4", CHROME_ANDROID, day2),
    );
  });

  it("separates different visitors", () => {
    expect(visitorHash("1.2.3.4", CHROME_ANDROID, day1)).not.toBe(
      visitorHash("5.6.7.8", CHROME_ANDROID, day1),
    );
  });

  it("is a fixed-width hash that stores no IP", () => {
    const h = visitorHash("1.2.3.4", CHROME_ANDROID, day1);
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain("1.2.3.4");
  });

  it("copes with missing IP or user-agent", () => {
    expect(visitorHash(null, null, day1)).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("referrerHost", () => {
  it("keeps the host only — never the full referring URL", () => {
    expect(referrerHost("https://www.google.com/search?q=camion+scania")).toBe("google.com");
    expect(referrerHost("https://m.facebook.com/groups/123")).toBe("m.facebook.com");
  });

  it("is null for absent or malformed referrers", () => {
    expect(referrerHost(null)).toBeNull();
    expect(referrerHost("")).toBeNull();
    expect(referrerHost("not a url")).toBeNull();
  });
});
