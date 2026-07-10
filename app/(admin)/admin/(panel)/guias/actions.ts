"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guard";
import {
  createContent,
  updateContent,
  setContentStatus,
  deleteContent,
  setContentHero,
  removeContentHero,
  parseContentForm,
} from "@/lib/content/mutations";

export interface ContentFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function firstFieldErrors(
  flat: Record<string, string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) if (v && v[0]) out[k] = v[0];
  return out;
}

export async function createContentAction(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const admin = await requireAdmin();
  const parsed = parseContentForm(formData);
  if (!parsed.success) {
    return {
      error: "Revisá los campos marcados.",
      fieldErrors: firstFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }
  let id: number;
  try {
    id = await createContent(admin, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear la página." };
  }
  revalidatePath("/admin/guias");
  redirect(`/admin/guias/${id}?nuevo=1`);
}

export async function updateContentAction(
  id: number,
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const admin = await requireAdmin();
  const parsed = parseContentForm(formData);
  if (!parsed.success) {
    return {
      error: "Revisá los campos marcados.",
      fieldErrors: firstFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }
  try {
    await updateContent(admin, id, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
  revalidatePath("/admin/guias");
  revalidatePath(`/admin/guias/${id}`);
  redirect("/admin/guias?guardado=1");
}

export async function changeContentStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status"));
  if (!id || (status !== "draft" && status !== "published")) return;
  await setContentStatus(admin, id, status);
  revalidatePath("/admin/guias");
}

export async function deleteContentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;
  await deleteContent(id);
  revalidatePath("/admin/guias");
  redirect("/admin/guias?borrado=1");
}

/* ---------------------------------- hero ---------------------------------- */

export interface HeroActionState {
  error?: string;
  ok?: boolean;
}

export async function uploadHeroAction(
  id: number,
  _prev: HeroActionState,
  formData: FormData,
): Promise<HeroActionState> {
  const admin = await requireAdmin();
  const file = formData.get("hero");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí una imagen." };
  }
  try {
    await setContentHero(admin, id, file);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo subir la imagen." };
  }
  revalidatePath(`/admin/guias/${id}`);
  return { ok: true };
}

export async function removeHeroAction(id: number): Promise<void> {
  const admin = await requireAdmin();
  await removeContentHero(admin, id);
  revalidatePath(`/admin/guias/${id}`);
}
