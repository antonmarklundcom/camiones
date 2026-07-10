import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";

/**
 * Public-site chrome (header, footer, floating WhatsApp button). Lives in the
 * `(site)` route group so the `/admin` panel — a sibling group — renders its
 * own chrome without the public nav or WhatsApp CTA bleeding in.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <WhatsAppFloat />
    </>
  );
}
