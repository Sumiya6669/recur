import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@recur/sdk"],
  reactStrictMode: true,
};

export default nextConfig;
