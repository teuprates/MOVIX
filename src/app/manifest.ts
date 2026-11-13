import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MOVIX — Sua frota sempre conectada",
    short_name: "MOVIX",
    description: "Gestão de frotas de locação: veículos, contratos, pagamentos, vistorias e alertas.",
    lang: "pt-BR",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#05070d",
    theme_color: "#05070d",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Painel do proprietário", url: "/painel" },
      { name: "Minhas locações", url: "/app" },
    ],
  };
}
