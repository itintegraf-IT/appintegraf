import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Next 16: výchozí build = Turbopack; prázdný objekt + webpack níže = explicitní souhlas s oběma. */
  turbopack: {},
  serverExternalPackages: ["pdf-parse", "unzipper", "archiver"],
  /** Pomalejší Windows / první kompilace chunků ve vývoji s `next dev --webpack`. */
  webpack: (config, { dev, isServer }) => {
    if (isServer) {
      // unzipper má volitelnou závislost na AWS S3 – v aplikaci ji nepoužíváme
      const { IgnorePlugin } = require("webpack") as typeof import("webpack");
      config.plugins.push(
        new IgnorePlugin({ resourceRegExp: /^@aws-sdk\/client-s3$/ })
      );
    }
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
