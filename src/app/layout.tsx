import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { DM_Sans, Libre_Baskerville } from "next/font/google";

import { publicMetadataBase } from "@/lib/public-base-url";

import "./globals.css";

const libre = Libre_Baskerville({
  variable: "--font-libre",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: publicMetadataBase(),
  title: {
    default: "Meraki · pedidos",
    template: "%s · Meraki",
  },
  description:
    "Carta digital y pedidos por mesa para Meraki beer company — bar pet friendly.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Meraki",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#3d291c",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = await headers();
  const uiLang = h.get("x-ui-lang") === "en" ? "en" : "es";
  const skipLabel = uiLang === "en" ? "Skip to content" : "Ir al contenido";

  return (
    <html
      lang={uiLang === "en" ? "en" : "es"}
      className={`${libre.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <a
          href="#contenido"
          className="fixed left-[-9999px] top-3 z-[100] rounded-lg bg-[#fff9ec] px-3 py-2 text-sm font-medium text-[#2c1f14] shadow ring-2 ring-[#c2763a] focus:left-3 focus:outline-none"
        >
          {skipLabel}
        </a>
        <div id="contenido" className="flex flex-1 flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
