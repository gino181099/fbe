import type { MetadataRoute } from "next";

/** Permite instalar el ERP en el teléfono (requisito de iPhone para recibir notificaciones). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Frabel ERP",
    short_name: "Frabel",
    description: "Gestión de clientes, recorridos y finanzas de Frabel",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#7539FF",
    lang: "es-AR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
