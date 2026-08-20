"use server";
import { z } from "zod";
import { pushLead } from "@/lib/crm";
import { absoluteUrl, listingPath } from "@/lib/urls";
import type { LeadState } from "@/lib/lead";
import { recordEvent } from "@/lib/analytics/record";

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

/**
 * Contact-form server action: validates the 3 fields and fires the GHL
 * webhook. Leads are NEVER stored in our DB (PLAN.md) — GHL is the CRM of
 * record; without GHL_WEBHOOK_URL the lead logs to console and still
 * succeeds so a config gap never breaks the form.
 */
export async function enviarConsulta(
  listing: {
    publicId: string;
    slug: string;
    title: string;
    priceUsd: number;
    listingId?: number;
    sellerId?: number;
  },
  _prev: LeadState,
  formData: FormData,
): Promise<LeadState> {
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

  const result = await pushLead({
    name: parsed.data.nombre,
    phone: parsed.data.telefono,
    message: parsed.data.mensaje,
    listing: {
      publicId: listing.publicId,
      title: listing.title,
      url: absoluteUrl(listingPath(listing.slug)),
      priceUsd: listing.priceUsd,
    },
  });

  if (result.ok) {
    // I8 — count the lead in first-party analytics. This is a COUNTER, not lead
    // storage: the write-ahead `leads` table is audit F1 (Batch 1) and is still
    // the thing that stops a lead being lost. Do not mistake this for it.
    recordEvent({
      kind: "lead",
      listingId: listing.listingId ?? null,
      sellerId: listing.sellerId ?? null,
      path: listingPath(listing.slug),
    });
  }

  return result.ok
    ? { status: "ok" }
    : { status: "error", message: "No pudimos enviar tu consulta — probá de nuevo o escribinos por WhatsApp." };
}
