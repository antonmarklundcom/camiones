"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { headers } from "next/headers";
import { LOGIN_LIMIT, checkRateLimit } from "@/lib/rate-limit";

export interface LoginState {
  error?: string;
}

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const invalid: LoginState = { error: "Email o contraseña incorrectos." };

  // F9 — brute force had nothing in its way. Keyed on IP *and* the submitted
  // email, so one attacker cannot lock a legitimate admin out of their own
  // account by spraying their address from elsewhere.
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const email = parsed.success ? parsed.data.email.toLowerCase() : "invalid";
  for (const key of [`login:ip:${ip}`, `login:user:${email}`]) {
    if (!checkRateLimit(key, LOGIN_LIMIT).allowed) {
      return { error: "Demasiados intentos. Esperá unos minutos y probá de nuevo." };
    }
  }

  if (!parsed.success) return invalid;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  // Constant-ish path: always run a verify to avoid leaking which emails exist.
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinva";
  const ok = await verifyPassword(parsed.data.password, hash);
  if (!user || !user.passwordHash || !ok) return invalid;

  const session = await getSession();
  session.user = {
    id: user.id,
    name: user.name,
    email: user.email!,
    role: user.role,
    sellerId: user.sellerId ?? null,
  };
  await session.save();
  redirect("/admin");
}
