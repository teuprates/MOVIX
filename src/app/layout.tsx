import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { Toaster } from "sonner";
import { themeScript } from "@/components/theme";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], display: "swap", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "MOVIX — Sua frota sempre conectada", template: "%s · MOVIX" },
  description:
    "Plataforma SaaS para gestão de pequenas frotas de locação: veículos, contratos com aceite eletrônico, pagamentos, vistorias, manutenção e alertas.",
  applicationName: "MOVIX",
  appleWebApp: { capable: true, title: "MOVIX", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icons/180" },
  openGraph: { title: "MOVIX — Sua frota sempre conectada", locale: "pt_BR", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#05070d" },
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${sora.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-white"
        >
          Pular para o conteúdo
        </a>
        {children}
        <Toaster richColors closeButton position="top-right" toastOptions={{ duration: 4500 }} />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
