import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { siteOrigin } from "@/lib/urls";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: "Camiones nuevos y usados en Paraguay | camiones.com.py",
    template: "%s | camiones.com.py",
  },
  description:
    "Encontrá tu camión en Paraguay: camiones, tractocamiones y utilitarios nuevos y usados. Precios en US$ y ₲, financiación y atención por WhatsApp.",
  openGraph: {
    siteName: "camiones.com.py",
    locale: "es_PY",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#15171b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-PY" className={archivo.variable}>
      <body className="min-h-screen antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <WhatsAppFloat />
      </body>
    </html>
  );
}
