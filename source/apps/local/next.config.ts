import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@task/contracts", "@task/ui", "@task/workspace"],
};

export default nextConfig;
