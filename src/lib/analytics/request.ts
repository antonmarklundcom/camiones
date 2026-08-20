/**
 * Turn an incoming request's headers into an event, and drop the ones that
 * aren't a person. Split from record.ts so the buffering logic stays testable
 * without next/headers.
 */
import { headers } from "next/headers";
import { isBot, recordEvent, referrerHost, visitorHash, type EventInput } from "@/lib/analytics/record";

/**
 * Record a page view (or any event) for the CURRENT request. Never awaited by
 * the caller's render path — the whole point is that a page view costs a push
 * onto an array.
 */
export async function recordRequestEvent(
  input: Omit<EventInput, "referrerHost" | "visitorHash">,
): Promise<void> {
  const h = await headers();
  const ua = h.get("user-agent");
  if (isBot(ua)) return;

  recordEvent({
    ...input,
    referrerHost: referrerHost(h.get("referer")),
    // x-forwarded-for is a list; the client is the first entry.
    visitorHash: visitorHash(
      (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip"),
      ua,
    ),
  });
}
