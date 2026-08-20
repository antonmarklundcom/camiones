/**
 * F10 — one place that decides what an uploaded file may be.
 *
 * Two halves of the same bug: Next's server-action body limit defaults to 1 MB,
 * which rejected ordinary 2–6 MB phone photos before any of our code ran (the
 * 12 MB check in admin/images.ts was dead), while the seller-logo and guide-hero
 * paths buffered whole files into memory with no size or MIME check at all —
 * the 1 MB default was the only thing standing between a dealer account and an
 * OOM. `next.config.ts` now raises the body limit deliberately, so these caps
 * are what actually protects the box.
 *
 * Pure: no server-only, no sharp, no DB — just the policy, so it can be unit
 * tested and reused by any future upload path.
 */

/** Formats accepted at ingest. Everything is re-encoded to WebP afterwards. */
export const ACCEPTED_IMAGE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

/**
 * Per-file caps, in bytes. Listing photos come straight off a phone; logos and
 * hero images are picked deliberately from a desktop and have no business
 * being huge. Keep the sum of a multi-file post under
 * `serverActions.bodySizeLimit` in next.config.ts.
 */
export const MAX_LISTING_PHOTO_BYTES = 12 * 1024 * 1024; // 12 MB
export const MAX_LOGO_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_HERO_BYTES = 8 * 1024 * 1024; // 8 MB

export interface UploadLimits {
  maxBytes: number;
  /** What the file is, for the error message: "El logo", "La imagen"… */
  label: string;
}

export const LOGO_LIMITS: UploadLimits = { maxBytes: MAX_LOGO_BYTES, label: "El logo" };
export const HERO_LIMITS: UploadLimits = { maxBytes: MAX_HERO_BYTES, label: "La imagen de portada" };
export const PHOTO_LIMITS: UploadLimits = { maxBytes: MAX_LISTING_PHOTO_BYTES, label: "La foto" };

export function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** Returns an es-PY error message, or null when the file is acceptable. */
export function validateImageUpload(
  file: { name?: string; size: number; type?: string },
  limits: UploadLimits,
): string | null {
  const what = file.name ? `"${file.name}"` : limits.label.toLowerCase();

  if (!file.size) return `${limits.label} está vacío.`;
  if (file.size > limits.maxBytes) {
    return `${what} supera el límite de ${formatMb(limits.maxBytes)}.`;
  }
  // An empty type means the browser didn't send one; the sharp decode below is
  // then the real gate — it throws on anything that isn't an image.
  if (file.type && !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `${what} no es una imagen válida (JPG, PNG, WebP o AVIF).`;
  }
  return null;
}

/** Throwing form for server actions. */
export function assertImageUpload(
  file: { name?: string; size: number; type?: string },
  limits: UploadLimits,
): void {
  const error = validateImageUpload(file, limits);
  if (error) throw new Error(error);
}
