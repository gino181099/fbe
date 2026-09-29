import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf usa módulos de Node que no conviene empaquetar.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
