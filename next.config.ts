import type { NextConfig } from "next";

const basePath = process.env.DRAWLOOM_BASE_PATH ?? "/drawloom";
if (!["/drawloom", "/drawloom/experimental"].includes(basePath)) throw new Error("Unsupported publication path");

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
