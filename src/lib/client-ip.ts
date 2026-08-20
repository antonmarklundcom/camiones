import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP for rate-limit keys. Hostinger fronts the app with a
 * proxy, so x-forwarded-for is what we get; the left-most entry is the client
 * (and is spoofable — see the honesty note in rate-limit.ts).
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "desconocido";
}
