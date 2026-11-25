import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tatiane By Lash · Agenda", template: "%s · Tatiane By Lash" },
  description: "Agende seu horário online e gerencie sua agenda.",
  applicationName: "Agenda Tatiane By Lash",
  appleWebApp: { capable: true, title: "Agenda TBL", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#8a3d5c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
