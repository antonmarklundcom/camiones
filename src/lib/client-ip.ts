/**
 * Client IP for rate-limit keys. Hostinger fronts the Node app with a proxy,
 * so the socket address is always the proxy's — the forwarded headers are the
 * only signal. They are spoofable by anyone talking to the app directly, which
 * is why this is used ONLY for abuse throttling, never for auth decisions.
 */
export function clientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}
