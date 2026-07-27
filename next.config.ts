import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root so stray lockfiles outside the repo can't
    // change how the build resolves files.
    root: __dirname,
  },
};

export default nextConfig;
