import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // Pin the workspace root so stray lockfiles outside the repo can't
    // change how the build resolves files.
    root: __dirname,
  },
  images: {
    // Repository owner avatars rendered on the public snapshot route.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
