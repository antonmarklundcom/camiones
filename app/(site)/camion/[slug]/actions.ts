"use server";
import { z } from "zod";
import { captureLead } from "@/lib/leads";
import { clientIp } from "@/lib/client-ip";
import { leadLimiter } from "@/lib/rate-limit";
import type { LeadState } from "@/lib/lead";

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
 * Contact-form server action. The lead is written to our DB first and only
 * then pushed to the CRM (F1), so "¡Gracias!" is only shown once the lead is
 * actually safe somewhere.
 *
 * The bound argument is ONLY the listing's publicId: everything the CRM sees
 * about the truck is re-read from the DB inside captureLead (F9), because a
 * bound server-action argument is attacker-forgeable.
 */
export async function enviarConsulta(
  listingPublicId: string,
  _prev: LeadState,
  formData: FormData,
): Promise<LeadState> {
  // Honeypot: a real browser leaves this hidden field empty. Answer exactly as
  // if it worked — a bot that sees an error just fixes its script.
  if (String(formData.get("empresa") ?? "").trim() !== "") {
    return { status: "ok" };
  }

  const ip = await clientIp();
  if (!leadLimiter.check(`lead:${ip}`).ok) {
    return {
      status: "error",
      message: "Recibimos varias consultas desde tu conexión — probá de nuevo en un rato o escribinos por WhatsApp.",
    };
  }

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

  const result = await captureLead({
    name: parsed.data.nombre,
    phone: parsed.data.telefono,
    message: parsed.data.mensaje,
    listingPublicId,
  });

  return result.ok
    ? { status: "ok" }
    : {
        status: "error",
        message: "No pudimos enviar tu consulta — probá de nuevo o escribinos por WhatsApp.",
      };
}
