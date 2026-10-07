import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Photos are linked from the venues' own hosts for the MVP and served as plain <img>; no optimizer.
  images: { unoptimized: true },
  // Nothing vendor-specific: the output must run on any Node host.
  output: 'standalone',
  poweredByHeader: false,
};

export default nextConfig;
