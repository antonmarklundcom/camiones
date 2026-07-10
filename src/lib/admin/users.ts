import "server-only";
import { z } from "zod";
import { and, eq, ne, count } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { ROLES } from "@/lib/auth/roles";

/**
 * User admin — admin-only (guarded at the action layer). Dealers get exactly
 * one seller via sellerId; admins have sellerId NULL. A last-admin safeguard
 * prevents locking everyone out.
 */
export const userCreateSchema = z
  .object({
    name: z.string().trim().max(140).optional(),
    email: z.string().trim().email("Email inválido").max(190),
    password: z.string().min(8, "La contraseña debe tener 8+ caracteres").max(200),
    role: z.enum(ROLES),
    sellerId: z.coerce.number().int().positive().optional(),
  })
  .refine((v) => v.role !== "dealer" || !!v.sellerId, {
    message: "Un usuario concesionaria necesita una concesionaria asignada.",
    path: ["sellerId"],
  });

export const userUpdateSchema = z
  .object({
    name: z.string().trim().max(140).optional(),
    email: z.string().trim().email("Email inválido").max(190),
    // Blank = keep current password.
    password: z
      .string()
      .max(200)
      .optional()
      .refine((v) => !v || v.length >= 8, {
        message: "La contraseña debe tener 8+ caracteres",
      }),
    role: z.enum(ROLES),
    sellerId: z.coerce.number().int().positive().optional(),
  })
  .refine((v) => v.role !== "dealer" || !!v.sellerId, {
    message: "Un usuario concesionaria necesita una concesionaria asignada.",
    path: ["sellerId"],
  });

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

function formObject(formData: FormData) {
  const val = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? undefined : v;
  };
  return {
    name: val("name"),
    email: val("email"),
    password: val("password"),
    role: val("role"),
    sellerId: val("sellerId"),
  };
}

export function parseUserCreateForm(formData: FormData) {
  return userCreateSchema.safeParse(formObject(formData));
}
export function parseUserUpdateForm(formData: FormData) {
  return userUpdateSchema.safeParse(formObject(formData));
}

async function emailTaken(email: string, exceptId?: number): Promise<boolean> {
  const conds = [eq(users.email, email)];
  if (exceptId) conds.push(ne(users.id, exceptId));
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(...conds))
    .limit(1);
  return !!row;
}

async function otherAdminExists(exceptId: number): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), ne(users.id, exceptId)));
  return (row?.n ?? 0) > 0;
}

export async function createUser(input: UserCreateInput): Promise<number> {
  if (await emailTaken(input.email)) {
    throw new Error("Ya existe un usuario con ese email.");
  }
  const passwordHash = await hashPassword(input.password);
  await db.insert(users).values({
    name: input.name || null,
    email: input.email,
    passwordHash,
    role: input.role,
    sellerId: input.role === "dealer" ? input.sellerId : null,
  });
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  return row.id;
}

export async function updateUser(
  id: number,
  input: UserUpdateInput,
): Promise<void> {
  const [current] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!current) throw new Error("El usuario no existe.");
  if (await emailTaken(input.email, id)) {
    throw new Error("Ya existe otro usuario con ese email.");
  }
  // Don't let the last admin demote themselves out of admin.
  if (
    current.role === "admin" &&
    input.role !== "admin" &&
    !(await otherAdminExists(id))
  ) {
    throw new Error("No podés quitar el último administrador del sistema.");
  }

  const set: Record<string, unknown> = {
    name: input.name || null,
    email: input.email,
    role: input.role,
    sellerId: input.role === "dealer" ? input.sellerId : null,
  };
  if (input.password) set.passwordHash = await hashPassword(input.password);

  await db.update(users).set(set).where(eq(users.id, id));
}

export async function deleteUser(id: number, currentUserId: number): Promise<void> {
  if (id === currentUserId) {
    throw new Error("No podés borrar tu propio usuario.");
  }
  const [target] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) return;
  if (target.role === "admin" && !(await otherAdminExists(id))) {
    throw new Error("No podés borrar el último administrador del sistema.");
  }
  await db.delete(users).where(eq(users.id, id));
}
