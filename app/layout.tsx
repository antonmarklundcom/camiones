import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { siteOrigin } from "@/lib/urls";
import "./globals.css";
import { siteConfig, titleTemplate } from "@site.config";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: `Camiones nuevos y usados en ${siteConfig.country} | ${siteConfig.name}`,
    template: titleTemplate,
  },
  description:
    "Encontrá tu camión en Paraguay: camiones, tractocamiones y utilitarios nuevos y usados. Precios en US$ y ₲, financiación y atención por WhatsApp.",
  openGraph: {
    siteName: siteConfig.name,
    locale: siteConfig.locale.replace("-", "_"),
    type: "website",
    // Site-wide fallback: WhatsApp is the primary share channel here and
    // renders previews imageless without one. Pages with their own image
    // (listings, guides) override this.
    images: [{ url: "/og-default.png", width: 1200, height: 630 }],
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
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
