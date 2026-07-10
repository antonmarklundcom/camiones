import "server-only";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { Role } from "@/lib/auth/roles";

/**
 * Iron-session config. The session is a signed+encrypted httpOnly cookie — no
 * server-side session store to run on Hostinger. SESSION_SECRET must be ≥32
 * chars; in dev a fixed fallback keeps logins working without setup (never
 * used in prod because the fallback is obviously not a secret).
 */
export interface SessionUser {
  id: number;
  name: string | null;
  email: string;
  role: Role;
  /** Dealers are scoped to this seller; NULL for admins. */
  sellerId: number | null;
}

export interface AppSession {
  user?: SessionUser;
}

const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-change-me-please-32+";

function sessionPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET no configurado (≥32 caracteres) — requerido en producción.",
    );
  }
  return DEV_FALLBACK_SECRET;
}

function sessionOptions(): SessionOptions {
  return {
    password: sessionPassword(),
    cookieName: "camiones_session",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  };
}

/** Read (and, for writes, mutate+save) the current session. */
export async function getSession() {
  const store = await cookies();
  return getIronSession<AppSession>(store, sessionOptions());
}
