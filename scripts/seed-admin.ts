/**
 * Seed (or reset) the initial admin user. Idempotent: upserts by email.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/seed-admin.ts
 *
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD from the environment; falls back to
 * admin@camiones.com.py / a printed random password when unset. Rotate these
 * credentials right after the first login (PLAN.md Phase 3).
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@camiones.com.py").trim();
  const generated = randomBytes(9).toString("base64url");
  const password = process.env.ADMIN_PASSWORD ?? generated;
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 8 caracteres.");
  }
  const passwordHash = await bcrypt.hash(password, 10);

  await db
    .insert(users)
    .values({ name: "Administrador", email, passwordHash, role: "admin", sellerId: null })
    .onDuplicateKeyUpdate({ set: { passwordHash, role: "admin" } });

  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  console.log(`admin listo (id ${row.id}): ${email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`contraseña generada: ${password}`);
    console.log("↑ guardala y cambiala tras el primer login.");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
