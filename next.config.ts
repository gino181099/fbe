import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf usa módulos de Node que no conviene empaquetar.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Los PDFs leen el logo con fs desde public/brand (no lo detecta el tracing).
  outputFileTracingIncludes: {
    "/api/**": ["./public/brand/**"],
  },
  poweredByHeader: false,
  // Caché del router en el navegador: volver a una pantalla vista hace < 30 s no pide nada al servidor.
  // Las acciones propias (revalidatePath) la invalidan; lo que carga otro usuario puede tardar hasta 30 s.
  experimental: {
    staleTimes: { dynamic: 30 },
  },
  // Headers de seguridad: no se puede embeber en otro sitio (clickjacking), sin sniffing de tipos, HTTPS forzado.
  // Sin CSP de scripts: con App Router exige nonces por request (vuelve dinámico todo y complica el SW).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
