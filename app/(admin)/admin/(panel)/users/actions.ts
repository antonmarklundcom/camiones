"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guard";
import {
  createUser,
  updateUser,
  deleteUser,
  parseUserCreateForm,
  parseUserUpdateForm,
} from "@/lib/admin/users";

export interface UserFormState {
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

export async function createUserAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requireAdmin();
  const parsed = parseUserCreateForm(formData);
  if (!parsed.success) {
    return {
      error: "Revisá los campos marcados.",
      fieldErrors: firstFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }
  try {
    await createUser(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el usuario." };
  }
  revalidatePath("/admin/users");
  redirect("/admin/users?guardado=1");
}

export async function updateUserAction(
  id: number,
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requireAdmin();
  const parsed = parseUserUpdateForm(formData);
  if (!parsed.success) {
    return {
      error: "Revisá los campos marcados.",
      fieldErrors: firstFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }
  try {
    await updateUser(id, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
  revalidatePath("/admin/users");
  redirect("/admin/users?guardado=1");
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;
  try {
    await deleteUser(id, admin.id);
  } catch (e) {
    redirect(`/admin/users?error=${encodeURIComponent(e instanceof Error ? e.message : "error")}`);
  }
  revalidatePath("/admin/users");
  redirect("/admin/users?borrado=1");
}
