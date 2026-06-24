import type { NextConfig } from 'next';

/**
 * Next.js configuration.
 *
 * @remarks
 * Kept minimal — framework defaults are intentional. Do not add rewrites,
 * redirects, or headers here without an ADR. Security headers are applied
 * via middleware (src/interfaces/api/middleware.ts, added in Stage 1).
 */
const nextConfig: NextConfig = {
  // Enforce strict React mode; catches lifecycle bugs early
  reactStrictMode: true,
};

export default nextConfig;
