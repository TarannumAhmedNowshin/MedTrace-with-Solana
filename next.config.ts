import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Anchor / web3.js are only used in client components and server route handlers.
  serverExternalPackages: ["@coral-xyz/anchor"],
};

export default nextConfig;
