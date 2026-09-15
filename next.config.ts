/**
 * NEXT_CONFIG
 *
 * Purpose: Defines framework-level Next.js behavior for the application foundation.
 * Connections: Next.js build pipeline and TypeScript route generation.
 * Risk: Medium because framework configuration affects every deployment.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;
