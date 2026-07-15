"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, requireAdmin } from "@/lib/auth/guard";
import {
  createSeller,
  updateSeller,
  deleteSeller,
  parseSellerForm,
  setSellerLogo,
  removeSellerLogo,
} from "@/lib/admin/sellers";

export interface SellerFormState {
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

export async function createSellerAction(
  _prev: SellerFormState,
  formData: FormData,
): Promise<SellerFormState> {
  await requireAdmin();
  const parsed = parseSellerForm(formData);
  if (!parsed.success) {
    return {
      error: "Revisá los campos marcados.",
      fieldErrors: firstFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }
  let id: number;
  try {
    id = await createSeller(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear la concesionaria." };
  }
  revalidatePath("/admin/sellers");
  redirect(`/admin/sellers/${id}?guardado=1`);
}

export async function updateSellerAction(
  id: number,
  _prev: SellerFormState,
  formData: FormData,
): Promise<SellerFormState> {
  const user = await requireUser();
  const parsed = parseSellerForm(formData);
  if (!parsed.success) {
    return {
      error: "Revisá los campos marcados.",
      fieldErrors: firstFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }
  try {
    await updateSeller(user, id, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
  revalidatePath("/admin/sellers");
  revalidatePath(`/admin/sellers/${id}`);
  redirect("/admin/sellers?guardado=1");
}

export async function deleteSellerAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;
  try {
    await deleteSeller(id);
  } catch (e) {
    redirect(`/admin/sellers?error=${encodeURIComponent(e instanceof Error ? e.message : "error")}`);
  }
  revalidatePath("/admin/sellers");
  redirect("/admin/sellers?borrado=1");
}

/* ---------------------------------- logo ---------------------------------- */

export interface LogoActionState {
  error?: string;
  ok?: boolean;
}

export async function uploadSellerLogoAction(
  id: number,
  _prev: LogoActionState,
  formData: FormData,
): Promise<LogoActionState> {
  const user = await requireUser();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí una imagen." };
  }
  try {
    await setSellerLogo(user, id, file);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo subir el logo." };
  }
  revalidatePath(`/admin/sellers/${id}`);
  return { ok: true };
}

export async function removeSellerLogoAction(id: number): Promise<void> {
  const user = await requireUser();
  await removeSellerLogo(user, id);
  revalidatePath(`/admin/sellers/${id}`);
}
