/** Client-safe content constants (no server-only, no DB) — shared by forms + UI. */
import type { ContentKind } from "@/db/schema";

export const CONTENT_KIND_VALUES = ["guia", "marca", "categoria"] as const;

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  guia: "Guía",
  marca: "Página de marca",
  categoria: "Intro de categoría",
};

export const CONTENT_STATUS_LABELS = {
  draft: "Borrador",
  published: "Publicada",
} as const;
