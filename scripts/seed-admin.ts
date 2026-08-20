/**
 * Seed (or rotate) the initial admin user.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/seed-admin.ts
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/seed-admin.ts --rotate
 *
 * F21 — this script used to be a blind upsert, so a casual re-run (or getting
 * it into `seed:all`) silently rotated the live admin password and promoted
 * whoever already owned ADMIN_EMAIL to admin. Both are now explicit:
 *
 *   - creating a NEW admin is the default and always safe;
 *   - touching an EXISTING user requires `--rotate`, which is refused unless
 *     ADMIN_PASSWORD is set (no more "surprise, here's a random password");
 *   - `--rotate` names the role change it is about to make before making it.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";

async function main() {
  const rotate = process.argv.includes("--rotate");
  const email = (process.env.ADMIN_EMAIL ?? "admin@camiones.com.py").trim();

  const [existing] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing && !rotate) {
    console.error(
      `✖ Ya existe un usuario con ${email} (id ${existing.id}, rol ${existing.role}).\n` +
        "  Este script NO lo toca sin permiso explícito.\n" +
        "  Para cambiarle la contraseña y asegurar el rol admin:\n" +
        `    ADMIN_EMAIL=${email} ADMIN_PASSWORD='...' npx tsx scripts/seed-admin.ts --rotate`,
    );
    process.exit(1);
  }

  if (rotate && !existing) {
    console.error(
      `✖ No existe ningún usuario con ${email}, así que no hay nada que rotar.\n` +
        "  Corré el script sin --rotate para crearlo.",
    );
    process.exit(1);
  }

  if (rotate && !process.env.ADMIN_PASSWORD) {
    console.error(
      "✖ --rotate exige ADMIN_PASSWORD explícito.\n" +
        "  Rotar a una contraseña generada al azar es cómo se pierde el acceso.",
    );
    process.exit(1);
  }

  const generated = randomBytes(9).toString("base64url");
  const password = process.env.ADMIN_PASSWORD ?? generated;
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 8 caracteres.");
  }
  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    if (existing.role !== "admin") {
      console.warn(
        `⚠ Promoviendo el usuario ${email} (id ${existing.id}) de ${existing.role} a admin.`,
      );
    }
    await db
      .update(users)
      .set({ passwordHash, role: "admin", sellerId: null })
      .where(eq(users.id, existing.id));
    console.log(`admin rotado (id ${existing.id}): ${email}`);
    process.exit(0);
  }

  await db.insert(users).values({
    name: "Administrador",
    email,
    passwordHash,
    role: "admin",
    sellerId: null,
  });
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  console.log(`admin creado (id ${row.id}): ${email}`);
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
