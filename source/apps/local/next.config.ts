import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@task/contracts", "@task/ui"],
};

export default nextConfig;
