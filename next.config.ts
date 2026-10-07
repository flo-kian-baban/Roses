import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Photos are linked from the venues' own hosts for the MVP and served as plain <img>; no optimizer.
  images: { unoptimized: true },
  // Nothing vendor-specific: the output must run on any Node host.
  output: 'standalone',
  // The check suite builds into .next-check (NEXT_DIST_DIR) so a running production server and its .next are untouched.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  // pg is loaded by Node at build/run time, never bundled (its optional Cloudflare socket module cannot be resolved by a bundler).
  serverExternalPackages: ['pg'],
};

export default nextConfig;
