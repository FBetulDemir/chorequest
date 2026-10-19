import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root so Next.js doesn't pick up the lockfile in the parent folder
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
