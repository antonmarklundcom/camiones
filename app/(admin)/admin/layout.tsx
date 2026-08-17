import type { Metadata } from "next";

/**
 * Metadata-only wrapper for the whole /admin tree (panel AND login). Keeps the
 * private surface out of the index as a belt-and-braces pair with the robots.ts
 * disallow — /admin/login is a client component and can't export metadata
 * itself, so the noindex has to live here.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
