"use server";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { listings } from "@/db/schema";
import { deliverLead, storeLead } from "@/lib/crm";
import { absoluteUrl, listingPath } from "@/lib/urls";
import type { LeadState } from "@/lib/lead";
import { recordEvent, referrerHost, visitorHash } from "@/lib/analytics/record";
import {
  HONEYPOT_FIELD,
  LEAD_LIMIT,
  checkRateLimit,
  isHoneypotTripped,
} from "@/lib/rate-limit";

const leadSchema = z.object({
  nombre: z.string().trim().min(2, "Contanos tu nombre").max(140),
  telefono: z
    .string()
    .trim()
    .min(6, "Dejanos un teléfono válido")
    .max(30)
    .regex(/^[0-9+\s()-]+$/, "Dejanos un teléfono válido"),
  mensaje: z.string().trim().min(2, "Escribí tu consulta").max(1000),
});

/** Bots and double-clicks both look like success to the visitor. */
const SUCCESS: LeadState = { status: "ok" };

/**
 * Contact-form server action (audit F1 + F9).
 *
 * The lead is WRITTEN TO OUR DATABASE FIRST and only then forwarded to the
 * CRM. Before Batch 1 this fired a webhook and kept nothing — so an unset
 * `GHL_WEBHOOK_URL` in production dropped every enquiry while showing the
 * buyer "¡Gracias!". The only failure the visitor is now told about is the one
 * that actually loses their message: the database write.
 *
 * F9: honeypot, per-visitor rate limit, and the `listing` argument re-read
 * from the DB — it arrives from the client and is trivially forgeable, so it
 * decides nothing on its own.
 */
export async function enviarConsulta(
  listing: { publicId: string; slug: string },
  _prev: LeadState,
  formData: FormData,
): Promise<LeadState> {
  // Silent drop: a filled hidden field is a bot, and saying so trains it.
  if (isHoneypotTripped(formData.get(HONEYPOT_FIELD))) return SUCCESS;

  const parsed = leadSchema.safeParse({
    nombre: formData.get("nombre"),
    telefono: formData.get("telefono"),
    mensaje: formData.get("mensaje"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revisá los datos del formulario",
    };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip");
  const ua = h.get("user-agent");
  const who = visitorHash(ip, ua) ?? "anon";

  const limited = checkRateLimit(`lead:${who}`, LEAD_LIMIT);
  if (!limited.allowed) {
    return {
      status: "error",
      message:
        "Recibimos varias consultas tuyas hace un momento. Esperá unos minutos " +
        "o escribinos directo por WhatsApp.",
    };
  }

  // F9 — never trust the client's copy of the listing. Title, price and seller
  // all come from the row we look up here.
  const [row] = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      title: listings.title,
      priceUsd: listings.priceUsd,
      sellerId: listings.sellerId,
      status: listings.status,
    })
    .from(listings)
    .where(eq(listings.publicId, listing.publicId.toUpperCase()))
    .limit(1);

  if (!row || row.status !== "published") {
    return {
      status: "error",
      message: "Este aviso ya no está disponible. Mirá otros camiones en /venta.",
    };
  }

  const path = listingPath(row.slug);
  const id = await storeLead({
    name: parsed.data.nombre,
    phone: parsed.data.telefono,
    message: parsed.data.mensaje,
    listingId: row.id,
    sellerId: row.sellerId,
    listingPublicId: listing.publicId.toUpperCase(),
    listingTitle: row.title,
    listingUrl: absoluteUrl(path),
    priceUsd: Number(row.priceUsd),
    pageUrl: absoluteUrl(path),
    referrerHost: referrerHost(h.get("referer")),
    idempotencyKey: idempotencyKey(parsed.data.telefono, listing.publicId),
  });

  if (id == null) {
    // The ONLY case the buyer hears about: we did not keep the message.
    return {
      status: "error",
      message:
        "No pudimos registrar tu consulta — probá de nuevo o escribinos por WhatsApp.",
    };
  }

  recordEvent({ kind: "lead", listingId: row.id, sellerId: row.sellerId, path });

  // Forward now; a failure here leaves the row `pending` for the cron sweep,
  // and the visitor is not made to wait on someone else's CRM.
  void deliverLead(id).catch(() => {});

  return SUCCESS;
}

/**
 * Stable per submission: phone + listing + the current hour. A double-click or
 * a retry after a timeout collapses onto one CRM contact, while the same buyer
 * asking about the same truck tomorrow is a genuinely new lead.
 */
function idempotencyKey(phone: string, publicId: string): string {
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  return createHash("sha256")
    .update(`${phone.replace(/\D/g, "")}|${publicId.toUpperCase()}|${hour}`)
    .digest("hex")
    .slice(0, 64);
}
