import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TATIANE By Lash",
    short_name: "Tatiane Lash",
    description: "Cílios e sobrancelhas com hora marcada: agende, acompanhe seus horários e, para a lash designer, agenda, clientes, financeiro e IA.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf7f7",
    theme_color: "#faf7f7",
    lang: "pt-BR",
    categories: ["beauty", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agenda", url: "/painel/agenda", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Novo agendamento", url: "/painel/agenda?novo=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Bloquear horário", url: "/painel/agenda/semana?bloquear=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
