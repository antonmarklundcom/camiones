import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guard";
import { getAdminUser, getSellerOptions } from "@/lib/admin/queries";
import { UserForm } from "@/components/admin/UserForm";
import { updateUserAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) notFound();

  const [user, sellers] = await Promise.all([
    getAdminUser(id),
    getSellerOptions(),
  ]);
  if (!user) notFound();

  return (
    <div>
      <Link href="/admin/users" className="text-sm text-ink-soft hover:text-ink">
        ← Volver a usuarios
      </Link>
      <h1 className="mb-6 mt-2 font-heading text-2xl font-bold text-ink">
        {user.email}
      </h1>
      <UserForm
        action={updateUserAction.bind(null, id)}
        sellers={sellers}
        isEdit
        values={{
          name: user.name,
          email: user.email,
          role: user.role,
          sellerId: user.sellerId,
        }}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
