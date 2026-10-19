import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf usa módulos de Node que no conviene empaquetar.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Los PDFs leen el logo con fs desde public/brand (no lo detecta el tracing).
  outputFileTracingIncludes: {
    "/api/**": ["./public/brand/**"],
  },
};

export default nextConfig;
