/* eslint-disable @next/next/no-img-element -- R2 is a plain public bucket
   with no transform API: images are re-encoded to sized WebP at ingest, so
   next/image would only add an optimizer hop. Deliberate, see CLAUDE.md. */
"use client";
import { useState } from "react";

export interface GalleryImage {
  url: string;
  alt: string;
}

/**
 * Detail-page gallery. Plain <img> on purpose: images are pre-sized WebP from
 * R2/public, the main image is the LCP element (fetchpriority=high) and
 * thumbnails lazy-load — no client library, no optimizer round-trip.
 */
export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [idx, setIdx] = useState(0);
  const main = images[idx] ?? images[0];

  if (!main) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-charcoal-100 text-ink-soft">
        Sin fotos
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl bg-charcoal-100">
        <img
          src={main.url}
          alt={main.alt || title}
          width={800}
          height={600}
          fetchPriority="high"
          className="aspect-[4/3] w-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Fotos">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Foto ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`shrink-0 overflow-hidden rounded-lg border-2 ${
                i === idx ? "border-amber-brand" : "border-transparent"
              }`}
            >
              <img
                src={img.url}
                alt=""
                width={112}
                height={84}
                loading="lazy"
                className="aspect-[4/3] w-24 object-cover sm:w-28"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
