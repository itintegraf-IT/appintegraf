import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Next 16: výchozí build = Turbopack; prázdný objekt + webpack níže = explicitní souhlas s oběma. */
  turbopack: {},
  serverExternalPackages: ["pdf-parse"],
  /** Pomalejší Windows / první kompilace chunků ve vývoji s `next dev --webpack`. */
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer && config.output) {
      config.output.chunkLoadTimeout = 300_000;
    }
    return config;
  },
  experimental: {
    serverActions: {
      // Musí být vyšší než nejvyšší aplikační limit (IML PDF upload = 50 MB).
      bodySizeLimit: "60mb",
    },
    proxyClientMaxBodySize: "60mb",
  },
};

export default nextConfig;
