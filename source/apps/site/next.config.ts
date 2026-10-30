import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@task/contracts"],
};

export default nextConfig;
