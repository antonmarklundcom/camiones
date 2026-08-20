/**
 * Seed (or rotate) the initial admin user.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/seed-admin.ts
 *   ... npx tsx scripts/seed-admin.ts --rotate     # overwrite an existing user
 *
 * F21: this used to upsert unconditionally, so a casual re-run (or being
 * folded into a seed-all) silently REPLACED the admin password with a fresh
 * random one — a lockout you only discover at the login screen. It now refuses
 * to touch an existing user unless `--rotate` is passed, and never promotes an
 * existing non-admin account by accident.
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
    console.log(`El usuario ${email} ya existe (id ${existing.id}, rol ${existing.role}).`);
    console.log("No se tocó nada. Para cambiar la contraseña:");
    console.log("  ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run seed:admin -- --rotate");
    process.exit(0);
  }

  const generated = randomBytes(9).toString("base64url");
  const password = process.env.ADMIN_PASSWORD ?? generated;
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 8 caracteres.");
  }
  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    if (existing.role !== "admin") {
      // Rotating is a password operation; silently promoting a dealer account
      // to admin is a privilege change nobody asked for.
      throw new Error(
        `${email} existe con rol "${existing.role}". Cambiá el rol desde /admin/users, no desde este script.`,
      );
    }
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, existing.id));
    console.log(`contraseña rotada para ${email} (id ${existing.id}).`);
  } else {
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
  }

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
