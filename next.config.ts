import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Backend libraries that rely on native Node.js behavior and must not be
  // bundled into the server build (they run in Route Handlers / instrumentation).
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "bullmq",
    "ioredis",
    "google-auth-library",
  ],
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return [
        {
          source: "/api/:path*",
          destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
