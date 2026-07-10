import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guard";
import { getSellerOptions } from "@/lib/admin/queries";
import { UserForm } from "@/components/admin/UserForm";
import { createUserAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  await requireAdmin();
  const sellers = await getSellerOptions();

  return (
    <div>
      <Link href="/admin/users" className="text-sm text-ink-soft hover:text-ink">
        ← Volver a usuarios
      </Link>
      <h1 className="mb-6 mt-2 font-heading text-2xl font-bold text-ink">Nuevo usuario</h1>
      <UserForm action={createUserAction} sellers={sellers} submitLabel="Crear usuario" />
    </div>
  );
}
