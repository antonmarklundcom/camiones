"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth/roles";

interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/listings", label: "Avisos" },
  { href: "/admin/sellers", label: "Concesionarias" },
  { href: "/admin/analytics", label: "Estadísticas" },
  { href: "/admin/guias", label: "Guías", adminOnly: true },
  { href: "/admin/cotizacion", label: "Cotización", adminOnly: true },
  { href: "/admin/users", label: "Usuarios", adminOnly: true },
];

export function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.adminOnly || role === "admin");

  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label="Secciones del panel">
      {items.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-amber-brand text-charcoal-950"
                : "text-white/85 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
