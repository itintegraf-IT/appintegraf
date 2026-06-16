import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Next 16: výchozí build = Turbopack; prázdný objekt + webpack níže = explicitní souhlas s oběma. */
  turbopack: {},
  serverExternalPackages: [
    "pdf-parse",
    "unzipper",
    "archiver",
    "@napi-rs/canvas",
    "@napi-rs/canvas-linux-x64-gnu",
    "pdfjs-dist",
  ],
  /** Pomalejší Windows / první kompilace chunků ve vývoji s `next dev --webpack`. */
  webpack: (config, { dev, isServer, webpack }) => {
    if (isServer) {
      // unzipper má volitelnou závislost na AWS S3 – v aplikaci ji nepoužíváme
      config.plugins = config.plugins ?? [];
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /^@aws-sdk\/client-s3$/ })
      );
    }
    if (dev && !isServer && config.output) {
      config.output.chunkLoadTimeout = 300_000;
    }
    return config;
  },
  experimental: {
    serverActions: {
      // Musí být vyšší než nejvyšší aplikační limit (IML ZIP import = 500 MB).
      bodySizeLimit: "500mb",
    },
    // ZIP až 500 MB; dávky složky až cca 100 MB (IML_PRODUCT_IMPORT_BATCH_MAX_BYTES).
    proxyClientMaxBodySize: "500mb",
  },
};

export default nextConfig;
