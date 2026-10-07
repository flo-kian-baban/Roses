import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Photos are linked from the venues' own hosts for the MVP and served as plain <img>; no optimizer.
  images: { unoptimized: true },
  // Nothing vendor-specific: the output must run on any Node host.
  output: 'standalone',
  poweredByHeader: false,
  // pg is loaded by Node at build/run time, never bundled (its optional Cloudflare socket module cannot be resolved by a bundler).
  serverExternalPackages: ['pg'],
};

export default nextConfig;
