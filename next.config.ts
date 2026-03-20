import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverActions: {
    bodySizeLimit: "20mb",
  },
  experimental: {
    proxyClientMaxBodySize: "20mb",
  },
};

export default nextConfig;
