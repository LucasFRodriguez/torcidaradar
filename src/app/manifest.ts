import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TorcidaRadar",
    short_name: "TorcidaRadar",
    description: "Seus times. Seu futebol. Tudo no radar.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafbf9",
    theme_color: "#0f766e",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
