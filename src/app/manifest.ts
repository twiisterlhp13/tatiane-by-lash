import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/painel",
    name: "Agenda · Tatiane By Lash",
    short_name: "Agenda TBL",
    description: "Painel de agendamentos: agenda, clientes, serviços e bloqueios.",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf7f4",
    theme_color: "#8a3d5c",
    lang: "pt-BR",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agenda", url: "/painel/agenda", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Bloquear horário", url: "/painel/agenda?bloquear=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Novo agendamento", url: "/painel/agenda?novo=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
