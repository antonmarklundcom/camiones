import "server-only";

/**
 * Shared upload guards (F10). Every path that buffers a whole file into memory
 * on shared hosting goes through these — listing photos, seller logos and
 * guide heroes alike — so a raised serverActions body limit can't be turned
 * into a memory-exhaustion lever.
 */

/** Per-file cap for listing photos (multi-file upload). */
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
/** Logos and guide heroes are single-file and never need to be this big. */
export const MAX_SINGLE_IMAGE_BYTES = 8 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

function mb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

/** Throws a user-facing (es-PY) error when the file is too big or not an image. */
export function assertUploadable(file: File, maxBytes: number): void {
  if (!file || file.size === 0) {
    throw new Error("El archivo está vacío.");
  }
  if (file.size > maxBytes) {
    throw new Error(`"${file.name}" supera el límite de ${mb(maxBytes)} MB.`);
  }
  if (file.type && !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`"${file.name}" no es una imagen válida (JPG, PNG o WebP).`);
  }
}
