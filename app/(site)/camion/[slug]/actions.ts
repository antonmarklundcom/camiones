"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { idempotencyKey, pushLead } from "@/lib/crm";
import { getListingForLead } from "@/lib/queries";
import { clientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";
import { absoluteUrl, listingPath } from "@/lib/urls";
import type { LeadState } from "@/lib/lead";

/** 5 consultas per IP per 10 minutes — generous for a human, useless to a bot. */
const LEAD_LIMIT = 5;
const LEAD_WINDOW_MS = 10 * 60 * 1000;

const leadSchema = z.object({
  nombre: z.string().trim().min(2, "Contanos tu nombre").max(140),
  telefono: z
    .string()
    .trim()
    .min(6, "Dejanos un teléfono válido")
    .max(30)
    .regex(/^[0-9+\s()-]+$/, "Dejanos un teléfono válido"),
  mensaje: z.string().trim().min(2, "Escribí tu consulta").max(1000),
  // Honeypot: bots fill every field they can see. Humans never touch this one.
  website: z.string().max(0).optional().or(z.literal("")),
});

/**
 * Contact-form server action — STORE, then forward (audit F1).
 *
 * The lead is written to our `leads` table first, so it is ours even if the
 * CRM is down or misconfigured; the VenderCRM call is best-effort and its
 * failure is recorded on the row for a later retry, never shown to the
 * visitor. A visitor who typed their number and got an error page is a lost
 * customer; a `pending` row is a five-minute fix.
 *
 * The bound `publicId` is the ONLY thing trusted from the client, and only as
 * a lookup key: every value forwarded to the CRM is re-read from the database
 * (audit F9), so a forged submission cannot inject an attacker-chosen title or
 * URL into the pipeline.
 */
export async function enviarConsulta(
  bound: { publicId: string },
  _prev: LeadState,
  formData: FormData,
): Promise<LeadState> {
  const parsed = leadSchema.safeParse({
    nombre: formData.get("nombre"),
    telefono: formData.get("telefono"),
    mensaje: formData.get("mensaje"),
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revisá los datos del formulario",
    };
  }

  // Honeypot tripped: report success and post nothing. Telling a bot it was
  // detected only teaches whoever wrote it to fix the bot.
  if (parsed.data.website) return { status: "ok" };

  const { nombre, telefono, mensaje } = parsed.data;
  const h = await headers();

  const limited = rateLimit(`lead:${clientIp(h)}`, LEAD_LIMIT, LEAD_WINDOW_MS);
  if (!limited.allowed) {
    return {
      status: "error",
      message: "Recibimos varias consultas tuyas — esperá unos minutos o escribinos por WhatsApp.",
    };
  }

  // Re-read from the DB: never trust the client-supplied listing (F9).
  const listing = await getListingForLead(bound.publicId);
  if (!listing) {
    return {
      status: "error",
      message: "Este aviso ya no está disponible.",
    };
  }

  const key = idempotencyKey(telefono);
  const pageUrl = absoluteUrl(listingPath(listing.slug));
  const referrer = h.get("referer") ?? undefined;

  // 1. Persist. If this throws, the lead genuinely could not be taken.
  let leadId: number;
  try {
    const [row] = await db
      .insert(leads)
      .values({
        idempotencyKey: key,
        name: nombre,
        phone: telefono,
        message: mensaje,
        listingId: listing.id,
        sellerId: listing.sellerId ?? undefined,
        pageUrl,
        referrer,
        status: "pending",
      })
      .$returningId();
    leadId = row.id;
  } catch (e) {
    // A duplicate key means this exact submission is already stored — the
    // visitor double-clicked. That is a success from their point of view.
    const existing = await db.query.leads
      .findFirst({ where: eq(leads.idempotencyKey, key) })
      .catch(() => undefined);
    if (existing) return { status: "ok" };
    console.error("[lead] no se pudo guardar el lead:", e);
    return {
      status: "error",
      message: "No pudimos enviar tu consulta — probá de nuevo o escribinos por WhatsApp.",
    };
  }

  // 2. Forward, best-effort. The visitor's result does not depend on this.
  const result = await pushLead(
    {
      name: nombre,
      phone: telefono,
      message: mensaje,
      pageUrl,
      referrer,
      fields: {
        listing_public_id: listing.publicId,
        listing_title: listing.title,
        listing_price_usd: Number(listing.priceUsd),
      },
    },
    key,
  );

  await db
    .update(leads)
    .set(
      result.ok
        ? {
            status: "sent",
            attempts: 1,
            sentAt: new Date(),
            crmContactId: result.contactId,
            crmDealId: result.dealId,
          }
        : {
            // Retryable failures stay 'pending' for the retry sweep; permanent
            // ones (bad key, validation) are 'failed' and need a human.
            status: result.retryable ? "pending" : "failed",
            attempts: 1,
            lastError: result.error.slice(0, 500),
          },
    )
    .where(eq(leads.id, leadId))
    .catch((e) => console.error("[lead] no se pudo actualizar el estado:", e));

  return { status: "ok" };
}
