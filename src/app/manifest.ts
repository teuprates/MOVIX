import type { MetadataRoute } from "next";

/** Manifest do PWA. Ícones gerados em /icons/[size] (inclui maskable com área segura de 30%). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/inicio",
    name: "MOVIX — Sua frota sempre conectada",
    short_name: "MOVIX",
    description: "Gestão de frotas de locação: veículos, contratos, pagamentos, vistorias e alertas.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/inicio?origem=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#05070d",
    theme_color: "#070d1f",
    categories: ["business", "productivity", "travel"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Painel do proprietário", short_name: "Painel", url: "/painel", icons: [{ src: "/icons/192", sizes: "192x192", type: "image/png" }] },
      { name: "Novo contrato", short_name: "Contrato", url: "/painel/contratos/novo", icons: [{ src: "/icons/192", sizes: "192x192", type: "image/png" }] },
      { name: "Minhas locações", short_name: "Locações", url: "/app", icons: [{ src: "/icons/192", sizes: "192x192", type: "image/png" }] },
      { name: "Pagamentos", short_name: "Pagamentos", url: "/app/parcelas", icons: [{ src: "/icons/192", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
