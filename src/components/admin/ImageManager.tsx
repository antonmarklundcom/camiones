"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  uploadImagesAction,
  reorderImagesAction,
  deleteImageAction,
  type ImageActionState,
} from "@app/(admin)/admin/(panel)/listings/actions";

export interface AdminImage {
  id: number;
  url: string | null;
  alt: string | null;
}

interface Props {
  listingId: number;
  images: AdminImage[];
}

export function ImageManager({ listingId, images }: Props) {
  const [items, setItems] = useState<AdminImage[]>(images);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Re-sync when the server revalidates after upload/delete.
  useEffect(() => setItems(images), [images]);

  const [uploadState, uploadAction, uploading] = useActionState<
    ImageActionState,
    FormData
  >(uploadImagesAction.bind(null, listingId), {});

  useEffect(() => {
    if (uploadState.added) formRef.current?.reset();
  }, [uploadState.added]);

  function persistOrder(next: AdminImage[]) {
    setItems(next);
    startTransition(async () => {
      await reorderImagesAction(
        listingId,
        next.map((i) => i.id),
      );
    });
  }

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    persistOrder(next);
  }

  function remove(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      await deleteImageAction(listingId, id);
    });
  }

  return (
    <section className="rounded-xl border border-charcoal-100 bg-white p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold text-ink">Fotos</h2>
        {(isPending || uploading) && (
          <span className="text-xs text-ink-soft">Guardando…</span>
        )}
      </div>
      <p className="mb-4 text-sm text-ink-soft">
        La primera foto es la portada. Arrastrá para reordenar. Se convierten a
        WebP automáticamente.
      </p>

      {items.length > 0 ? (
        <ul className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((img, index) => (
            <li
              key={img.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
              className={`group relative aspect-[4/3] cursor-move overflow-hidden rounded-lg border ${
                dragIndex === index ? "border-amber-brand" : "border-charcoal-100"
              } bg-charcoal-100`}
            >
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.url}
                  alt={img.alt ?? ""}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                <span className="flex h-full items-center justify-center text-xs text-ink-soft">
                  sin vista previa
                </span>
              )}
              {index === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded bg-amber-brand px-1.5 py-0.5 text-[10px] font-bold text-charcoal-950">
                  Portada
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(img.id)}
                aria-label="Quitar foto"
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 rounded-lg border border-dashed border-charcoal-100 px-4 py-8 text-center text-sm text-ink-soft">
          Todavía no hay fotos. Subí las primeras abajo.
        </p>
      )}

      <form ref={formRef} action={uploadAction} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="files"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          required
          className="text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-charcoal-100 file:px-4 file:py-2 file:font-heading file:font-bold file:text-ink hover:file:bg-charcoal-100/70"
        />
        <button
          type="submit"
          disabled={uploading}
          className="inline-flex h-10 items-center rounded-lg bg-amber-brand px-4 font-heading font-bold text-charcoal-950 hover:bg-amber-deep disabled:opacity-60"
        >
          {uploading ? "Subiendo…" : "Subir fotos"}
        </button>
      </form>
      {uploadState.error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {uploadState.error}
        </p>
      )}
    </section>
  );
}
