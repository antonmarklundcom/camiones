"use client";
/**
 * next/image custom loader (next.config.ts → images.loaderFile).
 *
 * R2 public buckets serve stored objects as-is (no on-the-fly resizing), and
 * placeholders live in /public — so the loader is a pass-through. Images are
 * pre-sized WebP at upload time; this keeps sharp and the Next optimizer off
 * the Hostinger box entirely.
 */
export default function r2ImageLoader({ src }: { src: string }): string {
  return src;
}
