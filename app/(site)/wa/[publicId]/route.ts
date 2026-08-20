/**
 * I8 — WhatsApp click tracking.
 *
 * `/wa/<publicId>` logs a `wa_click` and then 302s to the real `wa.me` link.
 * The WhatsApp tap is the ONLY conversion this site has, and until now it was
 * completely unmeasured — "X contactos este mes" is also the entire dealer
 * sales pitch, so it needs to be a number we can actually show them.
 *
 * The redirect target is built from the DB, never from the query string: an
 * open redirect on a truck listing site would be a phishing gift.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { listings, sellers } from "@/db/schema";
import { recordRequestEvent } from "@/lib/analytics/request";
import { waLink, waListingText } from "@/lib/whatsapp";
import { listingPath } from "@/lib/urls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await ctx.params;

  const [row] = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      title: listings.title,
      status: listings.status,
      sellerId: listings.sellerId,
      phone: sellers.phoneWhatsapp,
    })
    .from(listings)
    .innerJoin(sellers, eq(listings.sellerId, sellers.id))
    .where(eq(listings.publicId, publicId.toUpperCase()))
    .limit(1);

  if (!row || row.status !== "published") {
    return NextResponse.redirect(new URL("/venta", requestOrigin()), 302);
  }

  // F6 — a seller with no number and no configured fallback has no WhatsApp
  // link to send anyone to. Bounce back to the listing rather than to
  // wa.me/?text=… , which is a WhatsApp error page.
  const target = waLink(row.phone, waListingText(row.title));
  if (!target) {
    return NextResponse.redirect(new URL(listingPath(row.slug), requestOrigin()), 302);
  }

  await recordRequestEvent({
    kind: "wa_click",
    listingId: row.id,
    sellerId: row.sellerId,
    path: listingPath(row.slug),
  });

  const res = NextResponse.redirect(target, 302);
  // This URL is a tracking hop, never a destination — keep it out of caches
  // and out of the index.
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

function requestOrigin(): string {
  const host = process.env.NEXT_PUBLIC_CANONICAL_HOST;
  return host ? `https://${host}` : "http://localhost:3000";
}
