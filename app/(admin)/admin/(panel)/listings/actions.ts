"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import {
  createListing,
  updateListing,
  setListingStatus,
  deleteListing,
  parseListingForm,
  LISTING_STATUS_VALUES,
  type ListingStatus,
} from "@/lib/admin/listings";
import {
  addListingImages,
  reorderImages,
  deleteImage,
} from "@/lib/admin/images";

export interface ListingFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function firstFieldErrors(
  flat: Record<string, string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (v && v[0]) out[k] = v[0];
  }
  return out;
}

export async function createListingAction(
  _prev: ListingFormState,
  formData: FormData,
): Promise<ListingFormState> {
  const user = await requireUser();
  const parsed = parseListingForm(formData);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      error: "Revisá los campos marcados.",
      fieldErrors: firstFieldErrors(flat),
    };
  }

  let id: number;
  try {
    id = await createListing(user, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el aviso." };
  }
  revalidatePath("/admin/listings");
  redirect(`/admin/listings/${id}?nuevo=1`);
}

export async function updateListingAction(
  id: number,
  _prev: ListingFormState,
  formData: FormData,
): Promise<ListingFormState> {
  const user = await requireUser();
  const parsed = parseListingForm(formData);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      error: "Revisá los campos marcados.",
      fieldErrors: firstFieldErrors(flat),
    };
  }
  try {
    await updateListing(user, id, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar el aviso." };
  }
  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
  redirect("/admin/listings?guardado=1");
}

/** Quick status change from the list view (publish/pause/mark sold…). */
export async function changeStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as ListingStatus;
  if (!id || !LISTING_STATUS_VALUES.includes(status)) return;
  await setListingStatus(user, id, status);
  revalidatePath("/admin/listings");
}

export async function deleteListingAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (!id) return;
  await deleteListing(user, id);
  revalidatePath("/admin/listings");
  redirect("/admin/listings?borrado=1");
}

/* --------------------------------- images --------------------------------- */

export interface ImageActionState {
  error?: string;
  added?: number;
}

export async function uploadImagesAction(
  listingId: number,
  _prev: ImageActionState,
  formData: FormData,
): Promise<ImageActionState> {
  const user = await requireUser();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  try {
    const added = await addListingImages(user, listingId, files);
    revalidatePath(`/admin/listings/${listingId}`);
    return { added };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudieron subir las fotos." };
  }
}

export async function reorderImagesAction(
  listingId: number,
  orderedIds: number[],
): Promise<void> {
  const user = await requireUser();
  await reorderImages(user, listingId, orderedIds);
  revalidatePath(`/admin/listings/${listingId}`);
}

export async function deleteImageAction(
  listingId: number,
  imageId: number,
): Promise<void> {
  const user = await requireUser();
  await deleteImage(user, listingId, imageId);
  revalidatePath(`/admin/listings/${listingId}`);
}
