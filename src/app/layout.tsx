import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Pwa } from "@/components/pwa";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "TorcidaRadar — Seu futebol, em um só lugar",
    template: "%s | TorcidaRadar",
  },
  description: "Seus times. Seu futebol. Tudo no radar.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip" href="#conteudo">
          Pular para o conteúdo
        </a>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
