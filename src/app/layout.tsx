import type { Metadata, Viewport } from "next";
import "@fontsource-variable/montserrat";
import "./globals.css";
import { RegisterSW } from "@/components/pwa";

export const metadata: Metadata = {
  title: { default: "TATIANE By Lash", template: "%s · TATIANE By Lash" },
  description: "Cílios e sobrancelhas com hora marcada. Veja procedimentos, valores e horários livres e peça o seu horário.",
  applicationName: "TATIANE By Lash",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Tatiane By Lash", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#faf7f7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
